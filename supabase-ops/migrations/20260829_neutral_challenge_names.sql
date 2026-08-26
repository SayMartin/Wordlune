-- Take the theme out of the challenge name.
--
-- generate_challenge.mjs named its first batch after the theme it drew from —
-- "Africa — week of 2026-09-21", "Nature — week of 2026-08-31" — and 35 rows
-- carrying those names are already scheduled on the shared project.
--
-- That name is the one thing a player sees before starting, and starting is
-- what begins a clock that counts towards the leaderboard: time is part of the
-- score now (src/utils/scoring.ts). "Africa" in the menu is an invitation to
-- read up on African capitals and then press Play against a timer that has
-- already been beaten. Hiding the category list on the card, which the app now
-- does, achieves nothing while the heading says it anyway.
--
-- The theme still decides the words, and still reaches the player — as a
-- per-word hint that appears once the round is running, the same hint practice
-- and duel show. Later, not never.
--
-- "5x5" survives because it is a rule rather than content: it says every word
-- is five letters, which the badge on the card already shows and which gives
-- nothing away about what the words are.
--
-- Scoped by the name pattern the generator produced, so a challenge named by
-- hand is left alone. Idempotent: re-running matches nothing the second time,
-- because the new names have no ' — week of ' in them.
--
-- RUN AS THE TABLE OWNER (the Supabase SQL editor does). Non-destructive: this
-- only rewrites a display string. Word lists, dates, difficulty and every
-- attempt or result are untouched.

DO $mig$
DECLARE
  renamed INT;
  leftover INT;
BEGIN
  UPDATE public.competitive_challenges
     SET name = CASE WHEN is_five_chars THEN '5x5 Challenge — ' ELSE 'Weekly Challenge — ' END
                || to_char(start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD')
   WHERE name LIKE '%— week of %'
     AND start_date IS NOT NULL;
  GET DIAGNOSTICS renamed = ROW_COUNT;

  RAISE NOTICE 'Renamed % challenge(s).', renamed;

  -- The assertion that matters is not "did we rename something" — a second run
  -- correctly renames nothing — but "is anything still advertising its theme".
  SELECT COUNT(*) INTO leftover
    FROM public.competitive_challenges
   WHERE name LIKE '%— week of %';

  IF leftover <> 0 THEN
    RAISE EXCEPTION
      '% challenge(s) still carry a theme in their name. Running as the wrong role removes zero rows and reports success — check you are the table owner.',
      leftover;
  END IF;
END
$mig$;

-- Verify -----------------------------------------------------------------
--
-- Names should be dates and nothing else (expect "Weekly Challenge — <date>"
-- and "5x5 Challenge — <date>"):
--   SELECT name, difficulty, is_five_chars, start_date::date
--     FROM public.competitive_challenges ORDER BY start_date LIMIT 10;
--
-- Nothing leaks a theme (expect 0):
--   SELECT count(*) FROM public.competitive_challenges WHERE name LIKE '%— week of %';
--
-- The categories still exist where they belong — resolved by the menu view for
-- the active week, and used by GameScreen's per-word hint mid-round:
--   SELECT name, subcategory_names_en FROM public.challenge_menu_stats;
