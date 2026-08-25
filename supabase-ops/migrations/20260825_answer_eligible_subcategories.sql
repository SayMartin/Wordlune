-- Separate "may be a guess" from "may be the answer".
--
-- Duel's secret is now drawn from the whole dictionary rather than one category
-- (see words-repository.ts's getRandomFiveLetterWord). That is what makes guess
-- validation usable — the pool and the answer come from the same place, so a
-- player is no longer refused every ordinary word — but it also means a French
-- or English duel could hand someone "Dorby" or "Greby" as the word to guess.
-- Öland village names are unguessable to anyone not from Öland, and since
-- word_sv and word_fr are identical to word_en for them, the language the duel
-- is played in tells the player nothing either.
--
-- Deleting those categories would have been the blunt fix. They are fine
-- content in practice mode, where the player picks the category deliberately
-- and knows what they signed up for, and they are fine as *guesses* in any
-- mode — a larger accepted-guess list is a feature. The problem is only that
-- they can be the answer. So this marks eligibility rather than removing rows.
--
-- The flag lives on the subcategory because that is where the property belongs:
-- "Villages on Öland" is a proper-noun list, "Vegetables" is not. Following the
-- pattern the leaderboards already use (CLAUDE.md: visibility and aggregation
-- rules live in Postgres, not in the client), the client reads a view rather
-- than reassembling the rule itself.

-- RUN THIS AS THE TABLE OWNER (the Supabase SQL editor does). The ALTER TABLE
-- and CREATE VIEW below require ownership and will fail loudly for anyone else,
-- so unlike the two sibling migrations dated today this one cannot silently do
-- nothing — but the UPDATE in the middle could, if it were ever run on its own
-- under RLS (public.subcategories has a SELECT-only policy and is not FORCE'd),
-- so it is asserted anyway.

BEGIN;

ALTER TABLE public.subcategories
  ADD COLUMN IF NOT EXISTS is_answer_eligible BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.subcategories.is_answer_eligible IS
  'False for proper-noun lists that should never be picked as a secret word. Their words remain selectable in practice mode and remain valid guesses everywhere.';

UPDATE public.subcategories
   SET is_answer_eligible = FALSE
 WHERE name_en IN ('Cities in Sweden', 'Villages on Öland');

-- A word stays eligible if ANY of its subcategories is eligible: a real word
-- that also happens to be a place name is still a fair answer.
--
-- NOTE the EXISTS also excludes any word with no subcategory link at all. Every
-- seeded word gets one, but the verify query at the foot of this file reports
-- them so an orphan can't quietly shrink the answer pool.
CREATE OR REPLACE VIEW public.answer_eligible_words
WITH (security_invoker = true) AS
SELECT w.*
  FROM public.words w
 WHERE EXISTS (
         SELECT 1
           FROM public.words_subcategories ws
           JOIN public.subcategories s ON s.id = ws.subcategory_id
          WHERE ws.word_id = w.id
            AND s.is_answer_eligible
       );

GRANT SELECT ON public.answer_eligible_words TO anon, authenticated;

DO $$
DECLARE
  flagged INT;
BEGIN
  SELECT COUNT(*) INTO flagged
    FROM public.subcategories
   WHERE NOT is_answer_eligible;

  IF flagged <> 2 THEN
    RAISE EXCEPTION
      'Expected exactly 2 ineligible subcategories ("Cities in Sweden", "Villages on Öland"), found %. Check the names against public.subcategories before continuing.',
      flagged;
  END IF;
END $$;

COMMIT;

-- The flag survives reseeding: 20260819_master_seed_with_french.sql upserts
-- subcategories with ON CONFLICT (name_native) DO UPDATE and sets only the
-- name columns, so a column it doesn't know about is left alone.

-- Verify -----------------------------------------------------------------
--
-- Which subcategories are barred from supplying answers (expect exactly two):
--   SELECT name_en FROM public.subcategories WHERE NOT is_answer_eligible;
--
-- How many five-letter answers remain per language:
--   SELECT count(*) FILTER (WHERE length(word_en) = 5) AS en,
--          count(*) FILTER (WHERE length(word_sv) = 5) AS sv,
--          count(*) FILTER (WHERE length(word_fr) = 5) AS fr
--     FROM public.answer_eligible_words;
--
-- Orphaned words, excluded by the view as a side effect (expect none):
--   SELECT w.id, w.word_en FROM public.words w
--    WHERE NOT EXISTS (SELECT 1 FROM public.words_subcategories ws WHERE ws.word_id = w.id);
