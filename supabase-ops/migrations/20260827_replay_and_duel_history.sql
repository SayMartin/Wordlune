-- Replayable challenges, a real duel history, and the RLS hole that would have
-- made the new Progress screen a lie.
--
-- Four things, one migration, because the Progress rebuild needs all of them:
--
--   1. challenge_results is world-readable to any signed-in user. Fix that
--      first — everything else here assumes "private" means private.
--   2. Challenges become replayable while their week is open, with only the
--      FIRST run counting for the leaderboard.
--   3. duel_matches gains the final scores, which were never persisted.
--   4. duel_leaderboard gains losses, and own duel history gets a view.
--
-- ---------------------------------------------------------------------------
-- 1. challenge_results was never actually locked down
-- ---------------------------------------------------------------------------
-- The GDPR lockdown (20260822 + 20260824) put every personal-data table on
-- own-row-only, and challenge_results is listed among them — but the shared
-- project still carries, verifiably in the 20260825 baseline dump:
--
--   CREATE POLICY "Authenticated can read challenge_results"
--     ON public.challenge_results FOR SELECT TO authenticated USING (true);
--
-- sitting alongside "Users can view own challenge results". Policies are OR'ed,
-- so the own-row policy has been decorative: any signed-in account — including
-- a guest, which anyone can create by pressing "Play as Guest" — could read
-- every player's challenge scores straight off PostgREST, `is_public` or not.
--
-- That is the same shape of bug CLAUDE.md describes for the pre-August tables:
-- the visibility flag lived only in the view, so it protected nothing against a
-- direct table query. It matters more now than it did yesterday, because the
-- rebuilt Progress screen presents a private column and a public list side by
-- side and stakes the distinction on this flag.
--
-- Dropped by enumeration, never by name — see 20260824_gdpr_rls_lockdown_fix.sql
-- and 20260826_challenge_rotation_reset.sql for why.
--
-- ---------------------------------------------------------------------------
-- 2. Replay: allowed while the week is open, only the first run ranks
-- ---------------------------------------------------------------------------
-- Until now a challenge was one attempt, forever: ChallengeSelector refused to
-- open anything already completed or forfeited, including a forfeit made by
-- mistake, and challenge_attempts enforces it with UNIQUE(player_id,
-- challenge_id).
--
-- That constraint is kept. Replay resets the existing attempt row rather than
-- inserting a second one, so nothing downstream has to learn about multiple
-- attempts — and challenge_results still gains one row per completed run, so
-- the player's own history shows every attempt.
--
-- ONLY THE FIRST COMPLETED RUN COUNTS FOR THE LEADERBOARD, and that is the
-- whole design, not a detail. On a replay the player already knows all five
-- words, so a second run is worth a guaranteed maximum. Ranking by best score
-- would mean the leaderboard measured willingness to replay and nothing else;
-- ranking by first score means a replay is what it should be — practice, and a
-- way out of a misclicked forfeit. leaderboard_entries therefore takes the
-- EARLIEST result per player per challenge instead of every public one.
--
-- No new column for this: DISTINCT ON does it from completed_at, which is
-- already there and already correct after a restore.
--
-- ---------------------------------------------------------------------------
-- 3 & 4. Duels
-- ---------------------------------------------------------------------------
-- duel_matches records who won and nothing about how. The scores exist only in
-- useDuelMode's React state and in the realtime broadcasts, and vanish when the
-- match ends — so "your duels, with the score" could not be built at all. Two
-- nullable score columns fix that going forward; duels played before this show
-- no score, which is honest and cannot be backfilled from anywhere.
--
-- duel_leaderboard counted wins by joining on winner_id, so a player who had
-- only ever lost did not appear and losses were unknowable. It now unions both
-- sides of every finished duel. The is_public gate from 20260822 is preserved
-- exactly.
--
-- my_duel_history is security definer BY NECESSITY: the opponent's display name
-- lives in player_profiles, which is own-row locked, so an invoker-rights view
-- would show every opponent as blank. The auth.uid() filter inside the view is
-- therefore the only gate, and is written twice — once to pick the opponent's
-- side and once in the WHERE — so it cannot be satisfied by a caller who is not
-- a participant.
--
-- ---------------------------------------------------------------------------
-- RUN AS THE TABLE OWNER (the Supabase SQL editor does). One DO block, one
-- statement, atomic — see 20260826_challenge_rotation_reset.sql for why that
-- matters in the editor. Non-destructive: nothing here deletes a row.

DO $mig$
DECLARE
  pol         RECORD;
  dropped     INT := 0;
  left_over   INT;
BEGIN
  --------------------------------------------------------------------------
  -- 1. challenge_results: own-row only, for real this time
  --------------------------------------------------------------------------
  FOR pol IN
    SELECT policyname, qual
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'challenge_results'
       AND cmd IN ('SELECT', 'ALL')
  LOOP
    -- Keep anything already scoped to the caller; drop the rest.
    IF pol.qual IS NULL OR pol.qual NOT LIKE '%auth.uid()%' THEN
      EXECUTE format('DROP POLICY %I ON public.challenge_results', pol.policyname);
      dropped := dropped + 1;
      RAISE NOTICE 'Dropped over-permissive policy % on challenge_results (was: %).', pol.policyname, pol.qual;
    END IF;
  END LOOP;

  IF dropped = 0 THEN
    RAISE NOTICE 'challenge_results had no over-permissive SELECT policy — nothing to drop.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'challenge_results'
       AND cmd = 'SELECT' AND qual LIKE '%auth.uid()%'
  ) THEN
    CREATE POLICY "Users can view own challenge results"
      ON public.challenge_results FOR SELECT
      USING ( auth.uid() = player_id );
    RAISE NOTICE 'Created the own-row SELECT policy on challenge_results.';
  END IF;

  --------------------------------------------------------------------------
  -- 2. Leaderboard ranks the first run only
  --------------------------------------------------------------------------
  -- security_invoker stays false (pinned by 20260822): the view is the gate,
  -- and it has to out-rank the own-row policy just restored above in order to
  -- show anyone else at all.
  CREATE OR REPLACE VIEW public.leaderboard_entries
  WITH (security_invoker = false) AS
  SELECT DISTINCT ON (cr.player_id, cr.challenge_id)
      cr.id,
      cr.player_id,
      pp.display_name,
      pp.avatar_url,
      cr.total_score AS score,
      NULL::text     AS word,       -- placeholder kept for client compatibility
      cr.total_guesses AS guesses_count,
      cr.completed_at,
      cr.challenge_id,
      cc.name        AS challenge_name
    FROM public.challenge_results cr
    JOIN public.player_profiles pp       ON pp.id = cr.player_id
    JOIN public.competitive_challenges cc ON cc.id = cr.challenge_id
   WHERE cr.is_public = true
   ORDER BY cr.player_id, cr.challenge_id, cr.completed_at ASC;

  COMMENT ON VIEW public.leaderboard_entries IS
    'Public challenge results, one row per player per challenge: the FIRST completed run. Replays are practice — the words are already known on a second run, so ranking by best score would rank willingness to replay.';

  GRANT SELECT ON public.leaderboard_entries TO authenticated;

  --------------------------------------------------------------------------
  -- 2b. Restarting an attempt
  --------------------------------------------------------------------------
  -- security invoker, matching record_challenge_progress(): challenge_attempts
  -- is own-row under RLS and the caller is always acting on their own attempt,
  -- so invoker rights are both sufficient and safer. The player_id predicate is
  -- stated anyway so ownership is part of the write itself.
  CREATE OR REPLACE FUNCTION public.restart_challenge_attempt(p_challenge_id uuid)
  RETURNS public.challenge_attempts
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  SET search_path = public
  AS $fn$
  DECLARE
    updated public.challenge_attempts;
  BEGIN
    UPDATE public.challenge_attempts a
       SET status         = 'in_progress',
           progress_index = 0,
           total_score    = 0,
           total_duration = 0,
           total_guesses  = 0,
           completed_at   = NULL,
           started_at     = timezone('utc', now())
     WHERE a.challenge_id = p_challenge_id
       AND a.player_id    = auth.uid()
       -- Only while the challenge is actually being offered. Without this a
       -- player could reopen last month's challenge and add a result to a
       -- closed leaderboard.
       AND EXISTS (
             SELECT 1
               FROM public.competitive_challenges c
              WHERE c.id = p_challenge_id
                AND c.start_date <= now()
                AND (c.end_date IS NULL OR c.end_date > now())
           )
    RETURNING a.* INTO updated;

    IF updated.id IS NULL THEN
      RAISE EXCEPTION
        'Cannot restart: this challenge is not currently open, or you have no attempt on it.';
    END IF;

    RETURN updated;
  END
  $fn$;

  COMMENT ON FUNCTION public.restart_challenge_attempt(uuid) IS
    'Resets the caller''s attempt on an open challenge so it can be replayed. Keeps UNIQUE(player_id, challenge_id) by resetting the row rather than inserting a second one. Previous challenge_results rows are untouched, and only the earliest one ranks.';

  GRANT EXECUTE ON FUNCTION public.restart_challenge_attempt(uuid) TO authenticated;

  --------------------------------------------------------------------------
  -- 3. Duel scores
  --------------------------------------------------------------------------
  ALTER TABLE public.duel_matches
    ADD COLUMN IF NOT EXISTS player1_score INTEGER,
    ADD COLUMN IF NOT EXISTS player2_score INTEGER,
    ADD COLUMN IF NOT EXISTS finished_at   TIMESTAMPTZ;

  COMMENT ON COLUMN public.duel_matches.player1_score IS
    'Final duel score for player1 (5 per correct letter, 2 per present — src/utils/scoring.ts). NULL for duels played before 20260827, when scores lived only in client state.';

  --------------------------------------------------------------------------
  -- 4. Duel leaderboard: wins AND losses
  --------------------------------------------------------------------------
  CREATE OR REPLACE VIEW public.duel_leaderboard
  WITH (security_invoker = false) AS
  WITH sides AS (
    SELECT dm.player1_id AS pid, (dm.winner_id = dm.player1_id) AS won
      FROM public.duel_matches dm
     WHERE dm.status = 'finished' AND dm.winner_id IS NOT NULL AND dm.player1_id IS NOT NULL
    UNION ALL
    SELECT dm.player2_id, (dm.winner_id = dm.player2_id)
      FROM public.duel_matches dm
     WHERE dm.status = 'finished' AND dm.winner_id IS NOT NULL AND dm.player2_id IS NOT NULL
  )
  SELECT s.pid AS player_id,
         pp.display_name,
         pp.avatar_url,
         COUNT(*) FILTER (WHERE s.won)     AS wins,
         COUNT(*) FILTER (WHERE NOT s.won) AS losses,
         COUNT(*)                          AS played,
         -- The ranking value. Wins alone rank whoever has played most: someone
         -- 20–15 outranks someone 9–0, which is the opposite of what the table
         -- is supposed to say. Goal difference is the football answer and it is
         -- the right one here — it rewards winning more than you lose rather
         -- than simply turning up.
         (COUNT(*) FILTER (WHERE s.won) - COUNT(*) FILTER (WHERE NOT s.won))::int AS diff
    FROM sides s
    JOIN public.player_profiles pp ON pp.id = s.pid
   WHERE pp.is_public = true
   GROUP BY s.pid, pp.display_name, pp.avatar_url;

  COMMENT ON VIEW public.duel_leaderboard IS
    'Duel record for players who made their profile public, ranked by diff (wins - losses) rather than wins. Unions both sides of every finished duel, so a player who has only lost still appears — the previous version joined on winner_id alone, which made losses unknowable. The is_public gate is from 20260822.';

  GRANT SELECT ON public.duel_leaderboard TO authenticated;

  --------------------------------------------------------------------------
  -- 4b. Own duel history
  --------------------------------------------------------------------------
  -- Definer rights are required, not convenient: the opponent's display name is
  -- in player_profiles, which is own-row locked, so invoker rights would blank
  -- every opponent. auth.uid() therefore has to do all the gating from inside.
  CREATE OR REPLACE VIEW public.my_duel_history
  WITH (security_invoker = false) AS
  SELECT
      dm.id,
      dm.created_at,
      dm.finished_at,
      dm.language,
      CASE WHEN dm.player1_id = auth.uid() THEN dm.player2_id    ELSE dm.player1_id    END AS opponent_id,
      CASE WHEN dm.player1_id = auth.uid() THEN dm.player1_score ELSE dm.player2_score END AS my_score,
      CASE WHEN dm.player1_id = auth.uid() THEN dm.player2_score ELSE dm.player1_score END AS opponent_score,
      opp.display_name AS opponent_name,
      (dm.winner_id = auth.uid()) AS won
    FROM public.duel_matches dm
    LEFT JOIN public.player_profiles opp
      ON opp.id = CASE WHEN dm.player1_id = auth.uid() THEN dm.player2_id ELSE dm.player1_id END
   WHERE auth.uid() IS NOT NULL
     AND (dm.player1_id = auth.uid() OR dm.player2_id = auth.uid())
     AND dm.status = 'finished'
     AND dm.winner_id IS NOT NULL;

  COMMENT ON VIEW public.my_duel_history IS
    'The caller''s own finished duels, with the opponent''s display name and both scores. Security definer because player_profiles is own-row locked; the auth.uid() filter inside is the only gate and must not be removed.';

  GRANT SELECT ON public.my_duel_history TO authenticated;

  --------------------------------------------------------------------------
  -- 5. Prove it
  --------------------------------------------------------------------------
  SELECT COUNT(*) INTO left_over
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'challenge_results'
     AND cmd IN ('SELECT', 'ALL')
     AND (qual IS NULL OR qual NOT LIKE '%auth.uid()%');
  IF left_over <> 0 THEN
    RAISE EXCEPTION
      'challenge_results still has % permissive SELECT policy/ies. Policies are OR''ed, so one is enough to keep the table world-readable.',
      left_over;
  END IF;

  SELECT COUNT(*) INTO left_over
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'duel_matches'
     AND column_name IN ('player1_score', 'player2_score', 'finished_at');
  IF left_over <> 3 THEN
    RAISE EXCEPTION 'Expected 3 new duel_matches columns, found %.', left_over;
  END IF;

  SELECT COUNT(*) INTO left_over
    FROM information_schema.views
   WHERE table_schema = 'public' AND table_name = 'my_duel_history';
  IF left_over <> 1 THEN
    RAISE EXCEPTION 'my_duel_history was not created.';
  END IF;

  RAISE NOTICE 'Done.';
END
$mig$;

-- Verify -----------------------------------------------------------------
--
-- challenge_results is own-row only (every row must mention auth.uid()):
--   SELECT policyname, cmd, qual FROM pg_policies
--    WHERE schemaname='public' AND tablename='challenge_results' ORDER BY cmd;
--
-- The leaderboard shows one row per player per challenge (expect 0):
--   SELECT player_id, challenge_id, count(*) FROM public.leaderboard_entries
--    GROUP BY 1,2 HAVING count(*) > 1;
--
-- From OUTSIDE, signed in as any player, challenge_results must return only
-- that player's own rows. The SQL editor runs as owner and bypasses RLS, so it
-- cannot see this bug — use a REST client with a real user token:
--   GET /rest/v1/challenge_results?select=player_id
