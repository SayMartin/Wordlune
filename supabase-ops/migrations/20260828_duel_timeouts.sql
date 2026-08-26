-- Duels that end. Today, some don't.
--
-- Nothing in the app reads a clock as a limit. `duelElapsed` counts upward for
-- display only; the sole timer is sudden death (60s), and it fires only once
-- the opponent has definitively lost. A player who walks away with the tab open
-- is still "present" as far as presence sync is concerned, so their opponent
-- waits forever and the row sits at status='playing' until the account cleanup
-- job eventually cascades it away.
--
-- THE TWO RULES
-- -------------
--   * INACTIVITY, 2 minutes. No guess for two minutes and you forfeit — but
--     only while your opponent is still able to act and is not also idle. The
--     rule exists to stop one player stalling while the other works, not to
--     punish a slow duel.
--
--     ACTIVITY MEANS AN ACCEPTED GUESS: a word that was in the candidate pool
--     and therefore consumed one of the six attempts. Not typing, not presence,
--     not a rejected word. A rejected word costs nothing, so if it counted the
--     way to stall forever would be to hammer Enter on gibberish. The clients
--     only call record_duel_progress() when their guess count actually rises,
--     so p_guesses is what enforces this — the timestamp moves only alongside a
--     real attempt.
--
--   * SILENCE, 8 minutes. When BOTH players have gone quiet there is no active
--     opponent to hand the win to, so the match runs down an 8-minute clock
--     that any guess from either player resets. When it expires, proximity
--     decides.
--
-- Those two interlock deliberately. An 8-minute cap that resets on activity can
-- never fire on its own — the 2-minute rule resets on exactly the same events
-- and is shorter, so it always fires first. Restricting the forfeit to "your
-- opponent is still playing" is what leaves the both-idle case for the longer
-- clock, and makes both numbers reachable.
--
-- NEVER A DRAW. The proximity ladder below is a strict total order, so it always
-- names a winner:
--
--   1. more correct (green) letters in the player's best single guess
--   2. then more present (yellow) letters in any single guess
--   3. then fewer guesses used
--   4. then whoever acted most recently — the other one left first
--   5. then player1, so the function is deterministic even in a total tie
--
-- PROXIMITY, NOT SCORE. The obvious tiebreak — whoever leads on points — is the
-- wrong one, and it is worth writing down why, because the app already does it
-- in one place (GameScreen's both-lost branch). Duel score sums every letter of
-- every guess, so it grows with the NUMBER of guesses rather than with how close
-- the player is: five sloppy guesses at two yellows each score 20, exactly like
-- one guess with four greens. Under a timeout rule that would become a strategy
-- — fire off junk guesses to bank points, then stall out the clock. Best-guess
-- greens measure what the tiebreak is supposed to measure.
--
-- WHY THE SERVER DECIDES. Both clients run the same countdowns and either may
-- call resolve_duel() when one expires; the row is locked and the function is a
-- no-op once status <> 'playing', so they cannot reach different answers. That
-- also fixes two live bugs in the both-lost path, where only the client that
-- believes it leads calls claimVictory: on an exact tie neither writes and the
-- match stays 'playing' forever behind a "Draw!" dialog, and if the score
-- broadcasts disagree both may write. Same class of bug as the read-modify-write
-- that 20260826_record_challenge_progress.sql replaced.
--
-- And a pg_cron sweeper, because a client-side timer cannot fire when both
-- clients are gone — which is precisely the case that leaks rows.
--
-- RUN AS THE TABLE OWNER. One DO block, atomic. Non-destructive: adds columns
-- with defaults, replaces functions, schedules one job.

DO $mig$
DECLARE
  left_over INT;
BEGIN
  --------------------------------------------------------------------------
  -- 1. What the server needs in order to be able to judge
  --------------------------------------------------------------------------
  -- None of this existed: guesses and evaluations lived only in the two
  -- clients' React state and in the realtime broadcasts between them, so the
  -- database could not have adjudicated anything even if asked.
  ALTER TABLE public.duel_matches
    ADD COLUMN IF NOT EXISTS started_at               TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS finish_reason            TEXT,
    ADD COLUMN IF NOT EXISTS player1_guesses          INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS player2_guesses          INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS player1_best_correct     INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS player2_best_correct     INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS player1_best_present     INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS player2_best_present     INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS player1_last_activity_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS player2_last_activity_at TIMESTAMPTZ;

  COMMENT ON COLUMN public.duel_matches.finish_reason IS
    'How the duel ended: solved, surrender, disconnect, inactivity, timeout, both_lost. NULL for duels finished before 20260828.';
  COMMENT ON COLUMN public.duel_matches.player1_best_correct IS
    'Most correct (green) letters player1 achieved in any single guess. The timeout tiebreak — deliberately not the score, which sums every guess and so rewards guessing often rather than guessing well.';

  --------------------------------------------------------------------------
  -- 2. Stamp started_at when the duel actually begins
  --------------------------------------------------------------------------
  -- Reproduces 20260825_join_duel_match_rpc.sql verbatim apart from the one
  -- added assignment. started_at is the baseline the clocks run from before
  -- either player has guessed; created_at is when the *invitation* was made,
  -- which can be up to the 15 minutes below earlier.
  CREATE OR REPLACE FUNCTION public.join_duel_match(p_match_id uuid)
  RETURNS public.duel_matches
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $join$
  DECLARE
    m public.duel_matches;
  BEGIN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.duel_matches
       SET player2_id = auth.uid(),
           status     = 'playing',
           started_at = now(),
           player1_last_activity_at = now(),
           player2_last_activity_at = now()
     WHERE id = p_match_id
       AND status = 'waiting'
       AND player2_id IS NULL
       -- Can't duel yourself; without this a player could join their own
       -- invitation and see both boards.
       AND player1_id <> auth.uid()
       -- Mirrors the 5-minute window duel_lobby advertises, with slack for a
       -- player who took a moment to click. An abandoned invitation shouldn't
       -- stay joinable forever.
       AND created_at > now() - interval '15 minutes'
    RETURNING * INTO m;

    IF m.id IS NULL THEN
      RAISE EXCEPTION 'Match is no longer available';
    END IF;

    RETURN m;
  END;
  $join$;

  GRANT EXECUTE ON FUNCTION public.join_duel_match(uuid) TO authenticated;

  --------------------------------------------------------------------------
  -- 3. Clients report their own progress
  --------------------------------------------------------------------------
  -- Called after every submitted guess. Writes only the caller's own side, and
  -- only while the duel is running, so a finished match can't be edited after
  -- the fact. Security definer for the participant check; the caller is never
  -- trusted to say WHICH side it is.
  CREATE OR REPLACE FUNCTION public.record_duel_progress(
    p_match_id     uuid,
    p_guesses      integer,
    p_best_correct integer,
    p_best_present integer,
    p_score        integer
  )
  RETURNS void
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = public
  AS $rec$
  DECLARE
    m public.duel_matches;
  BEGIN
    SELECT * INTO m FROM public.duel_matches WHERE id = p_match_id;
    IF m.id IS NULL THEN
      RAISE EXCEPTION 'No such duel';
    END IF;
    IF auth.uid() IS NULL OR auth.uid() NOT IN (m.player1_id, m.player2_id) THEN
      RAISE EXCEPTION 'Not a participant in this duel';
    END IF;
    IF m.status <> 'playing' THEN
      RETURN;
    END IF;

    -- greatest() so a late-arriving or retried call can never walk a counter
    -- backwards, the same monotonicity record_challenge_progress() applies to
    -- progress_index.
    IF auth.uid() = m.player1_id THEN
      UPDATE public.duel_matches
         SET player1_guesses          = greatest(player1_guesses,      p_guesses),
             player1_best_correct     = greatest(player1_best_correct, p_best_correct),
             player1_best_present     = greatest(player1_best_present, p_best_present),
             player1_score            = greatest(coalesce(player1_score, 0), p_score),
             player1_last_activity_at = now()
       WHERE id = p_match_id;
    ELSE
      UPDATE public.duel_matches
         SET player2_guesses          = greatest(player2_guesses,      p_guesses),
             player2_best_correct     = greatest(player2_best_correct, p_best_correct),
             player2_best_present     = greatest(player2_best_present, p_best_present),
             player2_score            = greatest(coalesce(player2_score, 0), p_score),
             player2_last_activity_at = now()
       WHERE id = p_match_id;
    END IF;
  END;
  $rec$;

  COMMENT ON FUNCTION public.record_duel_progress(uuid, integer, integer, integer, integer) IS
    'Records the calling participant''s duel progress (guess count, best-guess greens/yellows, score) and stamps their activity. Writes only the caller''s own side; counters are monotonic.';

  GRANT EXECUTE ON FUNCTION public.record_duel_progress(uuid, integer, integer, integer, integer) TO authenticated;

  --------------------------------------------------------------------------
  -- 4. The judge
  --------------------------------------------------------------------------
  CREATE OR REPLACE FUNCTION public.resolve_duel(
    p_match_id           uuid,
    p_inactivity_seconds integer DEFAULT 120,
    p_silence_seconds    integer DEFAULT 480
  )
  RETURNS public.duel_matches
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = public
  AS $res$
  DECLARE
    m             public.duel_matches;
    p1_idle       numeric;
    p2_idle       numeric;
    quiet         numeric;
    p1_can_act    boolean;
    p2_can_act    boolean;
    p1_delinquent boolean;
    p2_delinquent boolean;
    winner        uuid;
    reason        text;
  BEGIN
    -- FOR UPDATE, so two clients calling at the same instant serialise instead
    -- of both deciding.
    SELECT * INTO m FROM public.duel_matches WHERE id = p_match_id FOR UPDATE;

    IF m.id IS NULL THEN
      RAISE EXCEPTION 'No such duel';
    END IF;

    -- auth.uid() IS NULL is the sweeper below, which runs without a JWT.
    -- Everyone else must be a participant: this function is security definer
    -- and returns the whole row, secret_word included.
    IF auth.uid() IS NOT NULL AND auth.uid() NOT IN (m.player1_id, m.player2_id) THEN
      RAISE EXCEPTION 'Not a participant in this duel';
    END IF;

    -- Idempotent: whoever calls second simply reads the settled result.
    IF m.status <> 'playing' OR m.player2_id IS NULL THEN
      RETURN m;
    END IF;

    p1_idle := extract(epoch FROM now() - coalesce(m.player1_last_activity_at, m.started_at, m.created_at));
    p2_idle := extract(epoch FROM now() - coalesce(m.player2_last_activity_at, m.started_at, m.created_at));
    -- Time since EITHER player last acted — the 8-minute clock, reset by any
    -- guess from either side.
    quiet := least(p1_idle, p2_idle);

    -- A player who has used all six guesses is finished, not idle. They can
    -- neither be forfeited for inactivity nor be handed a win by the other
    -- player's inactivity — being unable to act is not the same as playing.
    p1_can_act := m.player1_guesses < 6;
    p2_can_act := m.player2_guesses < 6;

    p1_delinquent := p1_can_act AND p1_idle > p_inactivity_seconds;
    p2_delinquent := p2_can_act AND p2_idle > p_inactivity_seconds;

    IF p1_delinquent AND p2_can_act AND NOT p2_delinquent THEN
      winner := m.player2_id;
      reason := 'inactivity';
    ELSIF p2_delinquent AND p1_can_act AND NOT p1_delinquent THEN
      winner := m.player1_id;
      reason := 'inactivity';
    ELSIF quiet > p_silence_seconds AND m.player1_guesses = 0 AND m.player2_guesses = 0 THEN
      -- Nobody ever guessed. This is not a duel to be decided, it is a duel
      -- that never happened, and "never a draw" was about deciding contests —
      -- not about inventing a winner where there was no contest. Voided:
      -- finished, but with no winner, so it appears in neither duel_leaderboard
      -- nor my_duel_history (both require winner_id IS NOT NULL).
      --
      -- Without this the proximity ladder falls all the way through — greens
      -- tied at 0, yellows tied at 0, guesses tied at 0, activity tied at the
      -- join timestamp — and hands player1 the win on the final deterministic
      -- fallback. Every abandoned lobby would have become a free win.
      winner := NULL;
      reason := 'abandoned';
    ELSIF quiet > p_silence_seconds THEN
      reason := 'timeout';
      -- Proximity ladder. Strict total order, so it always names someone.
      IF m.player1_best_correct <> m.player2_best_correct THEN
        winner := CASE WHEN m.player1_best_correct > m.player2_best_correct
                       THEN m.player1_id ELSE m.player2_id END;
      ELSIF m.player1_best_present <> m.player2_best_present THEN
        winner := CASE WHEN m.player1_best_present > m.player2_best_present
                       THEN m.player1_id ELSE m.player2_id END;
      ELSIF m.player1_guesses <> m.player2_guesses THEN
        winner := CASE WHEN m.player1_guesses < m.player2_guesses
                       THEN m.player1_id ELSE m.player2_id END;
      ELSIF p1_idle <> p2_idle THEN
        winner := CASE WHEN p1_idle < p2_idle
                       THEN m.player1_id ELSE m.player2_id END;
      ELSE
        winner := m.player1_id;
      END IF;
    ELSE
      -- Neither clock has run out. Nothing to do.
      RETURN m;
    END IF;

    UPDATE public.duel_matches
       SET status        = 'finished',
           winner_id     = winner,
           finish_reason = reason,
           finished_at   = now()
     WHERE id = p_match_id
     RETURNING * INTO m;

    RETURN m;
  END;
  $res$;

  COMMENT ON FUNCTION public.resolve_duel(uuid, integer, integer) IS
    'Ends a duel if one of its clocks has run out: 2 minutes of one-sided inactivity forfeits the idle player, 8 minutes with neither player acting is decided on proximity (best-guess greens, then yellows, then fewer guesses, then most recent activity, then player1). Idempotent and row-locked, so both clients calling it reach the same answer. Returns the match unchanged when no clock has expired.';

  GRANT EXECUTE ON FUNCTION public.resolve_duel(uuid, integer, integer) TO authenticated;

  --------------------------------------------------------------------------
  -- 5. The backstop
  --------------------------------------------------------------------------
  -- Client timers cannot fire when both clients are gone, which is exactly the
  -- case that leaves rows stuck at 'playing'.
  CREATE OR REPLACE FUNCTION public.sweep_stale_duels()
  RETURNS integer
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = public
  AS $sweep$
  DECLARE
    r        RECORD;
    resolved INTEGER := 0;
    m        public.duel_matches;
  BEGIN
    FOR r IN
      SELECT id FROM public.duel_matches
       WHERE status = 'playing'
         AND player2_id IS NOT NULL
    LOOP
      m := public.resolve_duel(r.id);
      IF m.status = 'finished' THEN
        resolved := resolved + 1;
      END IF;
    END LOOP;

    -- Invitations nobody ever joined. duel_lobby only advertises them for five
    -- minutes and join_duel_match refuses them after fifteen, so past that they
    -- are unreachable rows rather than pending games.
    DELETE FROM public.duel_matches
     WHERE status = 'waiting'
       AND created_at < now() - interval '1 hour';

    RETURN resolved;
  END;
  $sweep$;

  COMMENT ON FUNCTION public.sweep_stale_duels() IS
    'Applies resolve_duel() to every running duel and deletes invitations older than an hour that were never joined. Scheduled every 5 minutes via pg_cron; the clients handle the live case, this is for matches both players have abandoned.';

  --------------------------------------------------------------------------
  -- 5b. Clean up the duels that predate all of this
  --------------------------------------------------------------------------
  -- Before this migration nothing ever closed a duel that both players walked
  -- away from, so the table accumulated rows stuck at 'playing' — 41 of them on
  -- the shared project when this was first applied. They have no recorded play
  -- at all (the guess counters did not exist), so the sweeper would have voided
  -- them under the rule above — but only after the first version of that rule
  -- had already handed player1 a win for each one. This repairs both states:
  --
  --   * still 'playing' and long silent  -> void
  --   * already closed as 'timeout' with no guesses on either side -> void,
  --     undoing exactly the wins the first version awarded
  --
  -- Scoped to 0-guesses-on-both-sides, so a real duel that timed out with play
  -- on the board is never touched. Idempotent.
  UPDATE public.duel_matches
     SET status        = 'finished',
         winner_id     = NULL,
         finish_reason = 'abandoned',
         finished_at   = coalesce(finished_at, now())
   WHERE player2_id IS NOT NULL
     AND player1_guesses = 0
     AND player2_guesses = 0
     AND (
           (status = 'finished' AND finish_reason = 'timeout')
           OR (status = 'playing'
               AND greatest(coalesce(player1_last_activity_at, started_at, created_at),
                            coalesce(player2_last_activity_at, started_at, created_at))
                   < now() - interval '8 minutes')
         );
  GET DIAGNOSTICS left_over = ROW_COUNT;
  RAISE NOTICE 'Voided % duel(s) that nobody ever played.', left_over;

  --------------------------------------------------------------------------
  -- 6. Assertions
  --------------------------------------------------------------------------
  SELECT COUNT(*) INTO left_over
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'duel_matches'
     AND column_name IN ('started_at','finish_reason','player1_guesses','player2_guesses',
                         'player1_best_correct','player2_best_correct',
                         'player1_best_present','player2_best_present',
                         'player1_last_activity_at','player2_last_activity_at');
  IF left_over <> 10 THEN
    RAISE EXCEPTION 'Expected 10 new duel_matches columns, found %.', left_over;
  END IF;

  SELECT COUNT(*) INTO left_over
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('resolve_duel','record_duel_progress','sweep_stale_duels');
  IF left_over <> 3 THEN
    RAISE EXCEPTION 'Expected 3 duel functions, found %.', left_over;
  END IF;

  RAISE NOTICE 'Done. Schedule the sweeper with the cron.schedule() call below.';
END
$mig$;

-- Scheduling is a separate statement on purpose: cron.schedule() cannot run
-- inside the DO block above (it commits its own work), and re-running it would
-- otherwise stack duplicate jobs. Unschedule first so this file stays
-- re-runnable, matching 20260818_cleanup_anonymous_users.sql.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.unschedule('sweep-stale-duels')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-stale-duels');

SELECT cron.schedule(
  'sweep-stale-duels',
  '*/5 * * * *',
  $cron$ SELECT public.sweep_stale_duels(); $cron$
);

-- Verify -----------------------------------------------------------------
--
-- The job is scheduled exactly once:
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'sweep-stale-duels';
--
-- Nothing is stuck (expect 0 rows, or only duels started in the last 8 minutes):
--   SELECT id, created_at, player1_guesses, player2_guesses,
--          now() - greatest(player1_last_activity_at, player2_last_activity_at) AS quiet_for
--     FROM public.duel_matches WHERE status = 'playing' ORDER BY created_at;
--
-- How duels have been ending:
--   SELECT finish_reason, count(*) FROM public.duel_matches
--    WHERE status = 'finished' GROUP BY 1 ORDER BY 2 DESC;
