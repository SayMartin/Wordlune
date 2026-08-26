-- Rebuild competitive challenges: wipe the old set, give challenges a real
-- schedule window, stop leaking unpublished answers, and resolve category names
-- at read time instead of freezing them into the row.
--
-- WHY ALL FOUR IN ONE MIGRATION: they are one change. The eight challenges
-- generated on 2026-01-26/27 name subcategories that no longer exist
-- ("At sea", "Bicycle Brands", retired in 20260825_remove_bicycle_brands_and_at_sea.sql),
-- and they name them because `description` is a snapshot of the category names
-- taken at generation time. Fixing the data without fixing that would just
-- schedule the same rot again. And the schedule window cannot be added without
-- the RLS fix, because a challenge that exists but has not started yet is a
-- published answer key (see below).
--
-- WHAT GETS DELETED, deliberately and on request:
--
--   * every competitive_challenges row;
--   * every challenge_attempts row (cascades from the above anyway, deleted
--     explicitly so the count can be asserted);
--   * every challenge_results row (same);
--   * every game_scores row with a challenge_id.
--
-- That last one is not optional housekeeping. game_scores.challenge_id
-- references competitive_challenges(id) with no ON DELETE behaviour
-- (20260127_competitive_challenges.sql), so those rows would block the delete
-- outright. They are competitive-mode scores belonging to the challenges being
-- removed — the current code path does not even write them (useChallengeMode
-- saves only the aggregate), so in practice this is old data. Practice scores
-- have challenge_id IS NULL and are untouched.
--
-- Scores are also being wiped because the scoring formula changed on the same
-- day: a word is now worth up to 150 points (guess points plus a time bonus,
-- src/utils/scoring.ts) instead of a flat maximum of 100. Keeping the old
-- results would put two incompatible scales on one leaderboard with no way for
-- a player to tell which is which.
--
-- THE LEAK THIS CLOSES. public.competitive_challenges has carried
-- `SELECT USING (true)` since 20260127; the GDPR lockdown in August
-- (20260822_gdpr_rls_lockdown.sql) covered the personal-data tables and never
-- touched this one. word_ids and start_date are therefore readable by anyone
-- holding the anon key, which ships in the web bundle. Today that exposes eight
-- challenges. The point of this migration is to publish a rotating schedule
-- months ahead, which would turn the same hole into a months-long answer key.
-- The new policy hides any challenge that has not started yet. It deliberately
-- does NOT hide the words of a challenge that is currently running: those have
-- to reach the client to be playable, and no RLS policy changes that.
--
-- POLICIES ARE DROPPED BY LOOKUP, NEVER BY NAME. The live policy names on this
-- project have drifted from what the repo's migrations say they are, so
-- `DROP POLICY "Everyone can read challenges"` is a coin flip that fails
-- loudly at best and silently leaves a permissive policy in place at worst —
-- and policies are OR'ed, so one surviving `USING (true)` defeats the new one
-- completely. Every SELECT/ALL policy on the table is looked up in pg_policies
-- and dropped by its actual name, with a NOTICE for each.
--
-- RUN THIS AS THE TABLE OWNER — the Supabase SQL editor does. The DDL fails
-- loudly for anyone else, but the DELETEs would not: the tables have RLS
-- enabled with no DELETE policy for anon/authenticated, so a delete under the
-- wrong role removes zero rows and Postgres reports success. The assertions at
-- the end exist to catch exactly that.
--
-- ONE STATEMENT, DELIBERATELY. The Supabase SQL editor commits every top-level
-- statement separately, so a multi-statement migration can half-apply — which
-- is how 20260825_remove_bicycle_brands_and_at_sea.sql died with its DELETEs
-- already committed and its assertions unrun. A DO block is one statement and
-- is atomic on its own. No BEGIN/COMMIT wrapper: it would buy nothing here and
-- the trailing COMMIT would warn about a transaction that never started.

DO $mig$
DECLARE
  pol              RECORD;
  dropped_policies INT := 0;
  deleted_scores   INT;
  deleted_results  INT;
  deleted_attempts INT;
  deleted_challs   INT;
  left_over        INT;
BEGIN
  --------------------------------------------------------------------------
  -- 1. Schedule window
  --------------------------------------------------------------------------
  -- start_date has existed since 20260127 but nothing ever filtered on it, so
  -- every challenge ever generated was visible forever. end_date is the other
  -- half: without it "active" cannot be expressed, and a challenge can only be
  -- retired by deleting it, which takes its results with it.
  ALTER TABLE public.competitive_challenges
    ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

  COMMENT ON COLUMN public.competitive_challenges.end_date IS
    'When this challenge stops being offered. NULL means it never expires. Rows are visible to players only between start_date and end_date.';

  -- is_five_chars was added to the table by 20260131_add_is_five_restricted.sql
  -- but that migration never recreated challenge_menu_stats, so the column has
  -- never reached the client: ChallengeSelector reads c.is_five_chars off the
  -- view, gets undefined, never renders the 5x5 badge, and passes undefined
  -- into handleChallengeSelect so setOverrideFive(true) has never once run.
  -- The view rebuilt below includes it.
  ALTER TABLE public.competitive_challenges
    ADD COLUMN IF NOT EXISTS is_five_chars BOOLEAN DEFAULT FALSE;

  --------------------------------------------------------------------------
  -- 2. Wipe the old challenges and everything derived from them
  --------------------------------------------------------------------------
  DELETE FROM public.game_scores WHERE challenge_id IS NOT NULL;
  GET DIAGNOSTICS deleted_scores = ROW_COUNT;

  DELETE FROM public.challenge_results;
  GET DIAGNOSTICS deleted_results = ROW_COUNT;

  DELETE FROM public.challenge_attempts;
  GET DIAGNOSTICS deleted_attempts = ROW_COUNT;

  DELETE FROM public.competitive_challenges;
  GET DIAGNOSTICS deleted_challs = ROW_COUNT;

  RAISE NOTICE 'Deleted % challenge-linked game_scores, % challenge_results, % challenge_attempts, % challenges.',
    deleted_scores, deleted_results, deleted_attempts, deleted_challs;

  --------------------------------------------------------------------------
  -- 3. Stop serving unpublished challenges
  --------------------------------------------------------------------------
  FOR pol IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'competitive_challenges'
       AND cmd IN ('SELECT', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.competitive_challenges', pol.policyname);
    dropped_policies := dropped_policies + 1;
    RAISE NOTICE 'Dropped policy % on competitive_challenges.', pol.policyname;
  END LOOP;

  IF dropped_policies = 0 THEN
    RAISE NOTICE 'No pre-existing SELECT/ALL policy found on competitive_challenges — creating the new one from scratch.';
  END IF;

  -- Expired challenges stay readable on purpose: getMyChallengeResults() joins
  -- competitive_challenges(name) to label a player's own history, and that
  -- history should not turn into "Challenge" the day a challenge closes.
  CREATE POLICY "Started challenges are readable"
    ON public.competitive_challenges FOR SELECT
    USING ( start_date IS NOT NULL AND start_date <= now() );

  --------------------------------------------------------------------------
  -- 4. Menu view: resolve category names at read time, hide inactive rows
  --------------------------------------------------------------------------
  -- DROP first rather than CREATE OR REPLACE: replacing a view can only append
  -- columns, and this changes the column list.
  DROP VIEW IF EXISTS public.challenge_menu_stats;

  -- security_invoker pinned false, matching the leaderboard views: the view is
  -- the gate. It applies the date window itself, so it must not also inherit
  -- the caller's RLS — and pinning it means a future change to the server
  -- default cannot silently empty the challenge menu for every player.
  CREATE VIEW public.challenge_menu_stats
  WITH (security_invoker = false) AS
  SELECT
      c.id,
      c.name,
      c.difficulty,
      c.is_five_chars,
      c.start_date,
      c.end_date,
      c.subcategory_ids,
      COALESCE(array_length(c.word_ids, 1), 0) AS word_count,
      -- Resolved here, not stored on the row. A name frozen at generation time
      -- is what let two retired subcategories keep advertising themselves for a
      -- day short of a year; resolving on read means a renamed category renames
      -- itself everywhere and a deleted one simply disappears from the list.
      COALESCE(n.names_en, ARRAY[]::text[]) AS subcategory_names_en,
      COALESCE(n.names_sv, ARRAY[]::text[]) AS subcategory_names_sv,
      COALESCE(n.names_fr, ARRAY[]::text[]) AS subcategory_names_fr,
      COUNT(ca.id) FILTER (WHERE ca.status = 'completed') AS completions_count
    FROM public.competitive_challenges c
    LEFT JOIN LATERAL (
      SELECT array_agg(s.name_en                        ORDER BY s.name_en) AS names_en,
             array_agg(COALESCE(s.name_sv, s.name_en)   ORDER BY s.name_en) AS names_sv,
             array_agg(COALESCE(s.name_fr, s.name_en)   ORDER BY s.name_en) AS names_fr
        FROM public.subcategories s
       WHERE s.id = ANY (c.subcategory_ids)
    ) n ON TRUE
    LEFT JOIN public.challenge_attempts ca ON ca.challenge_id = c.id
   WHERE c.start_date IS NOT NULL
     AND c.start_date <= now()
     AND (c.end_date IS NULL OR c.end_date > now())
   GROUP BY c.id, c.name, c.difficulty, c.is_five_chars, c.start_date,
            c.end_date, c.subcategory_ids, c.word_ids,
            n.names_en, n.names_sv, n.names_fr;

  GRANT SELECT ON public.challenge_menu_stats TO anon, authenticated;

  --------------------------------------------------------------------------
  -- 5. Prove it happened
  --------------------------------------------------------------------------
  -- Without these, running as anon or authenticated deletes nothing, changes
  -- nothing, and reports success.
  SELECT COUNT(*) INTO left_over FROM public.competitive_challenges;
  IF left_over <> 0 THEN
    RAISE EXCEPTION 'Expected 0 challenges after the wipe, found %. Are you running as the table owner?', left_over;
  END IF;

  SELECT COUNT(*) INTO left_over FROM public.challenge_results;
  IF left_over <> 0 THEN
    RAISE EXCEPTION 'Expected 0 challenge_results after the wipe, found %.', left_over;
  END IF;

  SELECT COUNT(*) INTO left_over FROM public.challenge_attempts;
  IF left_over <> 0 THEN
    RAISE EXCEPTION 'Expected 0 challenge_attempts after the wipe, found %.', left_over;
  END IF;

  SELECT COUNT(*) INTO left_over FROM public.game_scores WHERE challenge_id IS NOT NULL;
  IF left_over <> 0 THEN
    RAISE EXCEPTION 'Expected 0 challenge-linked game_scores after the wipe, found %.', left_over;
  END IF;

  SELECT COUNT(*) INTO left_over
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename  = 'competitive_challenges'
     AND cmd IN ('SELECT', 'ALL');
  IF left_over <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly 1 SELECT policy on competitive_challenges, found %. A surviving permissive policy would re-open the leak, since policies are OR''ed.',
      left_over;
  END IF;

  RAISE NOTICE 'Done. Now run supabase-ops/scripts/generate_challenge.mjs to populate the schedule.';
END
$mig$;

-- Verify -----------------------------------------------------------------
--
-- Nothing left of the old set (expect 0, 0, 0, 0):
--   SELECT (SELECT count(*) FROM public.competitive_challenges) AS challenges,
--          (SELECT count(*) FROM public.challenge_results)      AS results,
--          (SELECT count(*) FROM public.challenge_attempts)     AS attempts,
--          (SELECT count(*) FROM public.game_scores WHERE challenge_id IS NOT NULL) AS scores;
--
-- Exactly one read policy, and it is date-gated:
--   SELECT policyname, cmd, qual FROM pg_policies
--    WHERE schemaname='public' AND tablename='competitive_challenges';
--
-- After generating: how much of the schedule is live right now versus queued
-- (the menu should show only a couple of rows even though the table holds ~39):
--   SELECT count(*) FROM public.competitive_challenges;
--   SELECT count(*) FROM public.challenge_menu_stats;
--
-- The leak, checked from the outside: with the anon key, this must return only
-- challenges that have already started. Run it in a REST client, not here —
-- the SQL editor runs as owner and bypasses RLS, so it cannot see the bug.
--   GET /rest/v1/competitive_challenges?select=name,start_date,word_ids
