-- Retire two subcategories from "Vehicles": "Bicycle Brands" (Cykelmärken) and
-- "At sea" (Till havs).
--
-- Both are brand-name lists — Trek, Specialized, Sunseeker, Princess — which
-- make poor word-game content: proper nouns nobody can reason their way to,
-- identical in all three languages so the category hint tells a player nothing.
--
-- "Car Brands" and "Motorcycle Brands" stay, so the Vehicles category itself is
-- NOT deleted.
--
-- WHAT THIS DOES NOT DO: it does not delete the `words` rows. That was the
-- first draft, and rehearsing it against a local `supabase start` stack showed
-- why it can't be done — two independent reasons:
--
--   1. Eight competitive_challenges from 2026-01-26/27 reference those words.
--      competitive_challenges.word_ids is a plain UUID[] with no foreign key
--      (20260127_competitive_challenges.sql), so nothing in the database would
--      have stopped the delete from leaving dangling ids in published
--      challenges — they would simply break for anyone who opened them, taking
--      the challenge_results history with them.
--
--   2. Four of the words involved — BULLS, FERRY, REGAL, SURLY — are ordinary
--      English words that merely happen to also be brands. Since the candidate
--      pool doubles as the list of accepted guesses (see CLAUDE.md), deleting
--      them would make the game reject perfectly good guesses.
--
-- Dropping only the subcategory and its join rows gets everything that was
-- actually wanted, and nothing that wasn't:
--
--   * the subcategory disappears from the category picker, so it can never be
--     played or drawn from again;
--   * the old challenges keep working, because they address words by id;
--   * the words stay valid guesses, which for FERRY and REGAL is a gain;
--   * the words become subcategory-less, and `answer_eligible_words`
--     (20260825_answer_eligible_subcategories.sql) requires at least one
--     eligible subcategory — so they can never be chosen as a secret either.
--
-- RUN THIS AS THE TABLE OWNER — the Supabase SQL editor does, which is what
-- this is written for. 20260124_force_public_permissions.sql enables row level
-- security on these tables and grants only `FOR SELECT USING (true)`; there is
-- no DELETE policy and no table is FORCE ROW LEVEL SECURITY. As owner (or
-- service_role) RLS is bypassed and the deletes apply. As anon or authenticated
-- they match no DELETE policy, remove zero rows, and Postgres raises NO ERROR —
-- it just reports success. The assertion at the end exists to catch that.
-- Reads are unaffected either way, so the target set is collected regardless.
--
-- ONE STATEMENT, DELIBERATELY. The first draft collected the doomed ids into a
-- `CREATE TEMP TABLE ... ON COMMIT DROP` and then read it from three following
-- statements. That works in psql, which holds one session for the whole file,
-- and it is how this was rehearsed — but the Supabase SQL editor does not keep
-- a session across the statements in a script, so the temp table was already
-- gone by the next statement and the run died on
-- `relation "doomed_subcats" does not exist` before either DELETE. Since the
-- editor is the documented way to run this, the migration must not depend on
-- session state at all: a single DO block is one statement, runs atomically,
-- and carries its own local variables instead.
--
-- No explicit BEGIN/COMMIT either. A DO block is already atomic — it commits
-- as a whole or not at all — and an explicit transaction wrapper is one more
-- thing for the editor to disagree with.

DO $$
DECLARE
  doomed        UUID[];
  targeted      INT;
  affected      INT;
  deleted_links INT;
  deleted_subs  INT;
  left_over     INT;
  orphans       INT;
BEGIN
  -- By name rather than by hardcoded id: the ids differ between the shared
  -- project and a local `supabase start` stack.
  SELECT array_agg(s.id) INTO doomed
    FROM public.subcategories s
    JOIN public.categories c ON c.id = s.category_id
   WHERE c.name_en ILIKE 'vehicles'
     AND s.name_en IN ('Bicycle Brands', 'At sea');

  targeted := COALESCE(array_length(doomed, 1), 0);

  IF targeted = 0 THEN
    RAISE NOTICE 'Nothing to do: no subcategory named "Bicycle Brands" or "At sea" under Vehicles. Already applied?';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO affected
    FROM public.competitive_challenges cc
   WHERE EXISTS (
     SELECT 1 FROM unnest(cc.subcategory_ids) sid WHERE sid = ANY(doomed)
   );

  IF affected > 0 THEN
    -- Inert, but worth stating: challenge_menu_stats passes subcategory_ids
    -- through as a raw array without joining it to anything, so an id that no
    -- longer resolves is carried around and never read.
    RAISE NOTICE '% challenge(s) still list one of these subcategory ids for display. Harmless — nothing joins on it.', affected;
  END IF;

  DELETE FROM public.words_subcategories WHERE subcategory_id = ANY(doomed);
  GET DIAGNOSTICS deleted_links = ROW_COUNT;

  DELETE FROM public.subcategories WHERE id = ANY(doomed);
  GET DIAGNOSTICS deleted_subs = ROW_COUNT;

  RAISE NOTICE 'Deleted % words_subcategories row(s) and % subcategory/ies.', deleted_links, deleted_subs;

  -- Prove it happened. Without this, running as the wrong role silently changes
  -- nothing and looks like success (see the RLS note above).
  SELECT COUNT(*) INTO left_over
    FROM public.subcategories
   WHERE id = ANY(doomed);

  IF left_over > 0 THEN
    RAISE EXCEPTION
      'Delete affected no rows: % of % target subcategories still present. Almost certainly running as a role RLS applies to — re-run as the table owner (the Supabase SQL editor) or via service_role.',
      left_over, targeted;
  END IF;

  SELECT COUNT(*) INTO orphans
    FROM public.words w
   WHERE NOT EXISTS (
     SELECT 1 FROM public.words_subcategories ws WHERE ws.word_id = w.id
   );

  RAISE NOTICE '% word(s) now belong to no subcategory. Expected: they stay valid guesses and stay addressable by old challenges, but answer_eligible_words excludes them, so they can never be the secret.', orphans;
END $$;

-- Verify -----------------------------------------------------------------
--
-- Gone from the picker (expect zero rows):
--   SELECT s.name_en FROM public.subcategories s
--     JOIN public.categories c ON c.id = s.category_id
--    WHERE c.name_en ILIKE 'vehicles' AND s.name_en IN ('Bicycle Brands', 'At sea');
--
-- Vehicles still has its other two (expect Car Brands, Motorcycle Brands):
--   SELECT s.name_en FROM public.subcategories s
--     JOIN public.categories c ON c.id = s.category_id
--    WHERE c.name_en ILIKE 'vehicles' ORDER BY s.name_en;
--
-- Old challenges still resolve every word they point at (expect zero rows):
--   SELECT cc.name, w AS missing_word_id
--     FROM public.competitive_challenges cc, unnest(cc.word_ids) w
--    WHERE NOT EXISTS (SELECT 1 FROM public.words x WHERE x.id = w);
