-- The class of unspellable word that 20260825_fix_unspellable_words.sql missed:
-- diaereses and umlauts — Ï and Ë in French, and anything outside ÅÄÖ in
-- Swedish.
--
-- That audit checked every word column against "the characters its language can
-- actually produce", but treated GameScreen.tsx's LETTER_PATTERNS.fr as the
-- authority. That regex is the *physical* keyboard filter and is deliberately
-- generous — it accepts Ë, Ï, Ü, Æ and Œ. The on-screen keyboard is the binding
-- constraint, and Keyboard.tsx's LAYOUTS.fr offers only:
--
--     AZERTYUIOP / QSDFGHJKLM / WXCVBNÄÖÅ / ÉÈÊÀÂÇÎÔÙÛ
--
-- No Ï, no Ë, no Ü. So a player who drew THAÏLANDE in French had no key for the
-- Ï and could never finish the round — the same unwinnable state the earlier
-- migrations were written to eliminate, in a category nobody had re-checked.
-- Swedish has the trap in reverse: LAYOUTS.sv is QWERTYUIOPÅ / ASDFGHJKLÖÄ /
-- ZXCVBNM, so É is unreachable there even though it is an ordinary Swedish
-- loan spelling.
--
-- Typeability wins over orthography, exactly as it already does for MOÇAMBIQUE
-- and MÜSLI: a word nobody can enter is worth nothing however correctly it is
-- spelled.
--
-- The matching seed CSVs (countries.csv, countries-europe.csv,
-- capital-cities.csv, car-brands.csv, hydrocarbons/vegetables.csv,
-- hydrocarbons/plants.csv) are already fixed for future reseeding; this patches
-- the live rows, including any the CSVs never had — the database holds content
-- they don't.
--
-- RUN THIS AS THE TABLE OWNER (the Supabase SQL editor does). public.words has
-- RLS enabled with only a `FOR SELECT USING (true)` policy and is not marked
-- FORCE ROW LEVEL SECURITY, so as owner or service_role RLS is bypassed and
-- these updates apply — while as anon or authenticated they match no UPDATE
-- policy, change zero rows, and raise no error at all. The assertion at the
-- end turns that silent no-op into a failure.

-- Matched on the offending characters rather than on a list of exact spellings.
--
-- The enumerated version was fragile in a way that only showed up once it was
-- clear no migration had been applied yet: 'RIESE & MÜLLER' does not become
-- 'RIESE MÜLLER' until 20260825_fix_unspellable_words.sql strips the ampersand.
-- Run in the other order, an exact-match UPDATE would quietly hit nothing, the
-- assertion would pass, and the row would keep its untypeable Ü forever. Going
-- by character makes the two migrations order-independent, and picks up any row
-- the seed CSVs never had — the database holds content they don't.
--
-- ONE STATEMENT, DELIBERATELY — same reason as the sibling migration
-- 20260825_remove_bicycle_brands_and_at_sea.sql. The first draft staged the
-- affected rows in a `CREATE TEMP TABLE ... ON COMMIT DROP` and read it back
-- from two later statements. psql keeps one session for a whole file so that
-- worked when rehearsed; the Supabase SQL editor does not, and the temp table
-- was gone by the next statement. Everything lives in one DO block instead,
-- which is a single atomic statement with its own local variables.
--
-- translate() is idempotent, so applying it directly in the UPDATE needs no
-- staging table: a row with no diaeresis is rewritten to itself, and the WHERE
-- clause keeps even that from happening.
DO $$
DECLARE
  r         RECORD;
  changed   INT;
  left_over INT;
BEGIN
  -- Report before changing, so the run is auditable rather than a silent bulk
  -- update.
  FOR r IN
    SELECT word_sv AS old_sv,
           word_fr AS old_fr,
           -- French keeps ÉÈÊÀÂÇÎÔÙÛ and ÄÖÅ; only these have no key on its layout.
           translate(word_fr, 'ÏËÜŸïëüÿ', 'IEUYieuy') AS new_fr,
           -- Swedish keeps only ÅÄÖ.
           translate(word_sv, 'ÉÈÊÀÂÇÎÔÙÛÏËÜŸéèêàâçîôùûïëüÿ',
                              'EEEAACIOUUIEUYeeeaaciouuieuy') AS new_sv
      FROM public.words
     WHERE word_fr ~ '[ÏËÜŸïëüÿ]'
        OR word_sv ~ '[ÉÈÊÀÂÇÎÔÙÛÏËÜŸéèêàâçîôùûïëüÿ]'
  LOOP
    IF r.old_fr IS DISTINCT FROM r.new_fr THEN
      RAISE NOTICE 'word_fr: % -> %', r.old_fr, r.new_fr;
    END IF;
    IF r.old_sv IS DISTINCT FROM r.new_sv THEN
      RAISE NOTICE 'word_sv: % -> %', r.old_sv, r.new_sv;
    END IF;
  END LOOP;

  UPDATE public.words w
     SET word_fr = translate(w.word_fr, 'ÏËÜŸïëüÿ', 'IEUYieuy'),
         word_sv = translate(w.word_sv, 'ÉÈÊÀÂÇÎÔÙÛÏËÜŸéèêàâçîôùûïëüÿ',
                                        'EEEAACIOUUIEUYeeeaaciouuieuy')
   WHERE w.word_fr ~ '[ÏËÜŸïëüÿ]'
      OR w.word_sv ~ '[ÉÈÊÀÂÇÎÔÙÛÏËÜŸéèêàâçîôùûïëüÿ]';
  GET DIAGNOSTICS changed = ROW_COUNT;

  RAISE NOTICE 'Rewrote % row(s).', changed;

  SELECT COUNT(*) INTO left_over
    FROM public.words
   WHERE word_fr ~ '[ÏËÜŸïëüÿ]'
      OR word_sv ~ '[ÉÈÊÀÂÇÎÔÙÛÏËÜŸéèêàâçîôùûïëüÿ]';

  IF left_over > 0 THEN
    RAISE EXCEPTION
      '% row(s) unchanged. On a first run that almost always means you are a role RLS applies to — re-run as the table owner.',
      left_over;
  END IF;

  -- Untypeable for some other reason (apostrophe, parenthesis, ampersand):
  -- reported, not fatal. That is 20260825_fix_unspellable_words.sql's job, and
  -- this migration must not depend on whether that has been run yet.
  SELECT COUNT(*) INTO left_over
    FROM public.words
   WHERE upper(word_en) !~ '^[A-Z /-]*$'
      OR upper(word_sv) !~ '^[A-ZÅÄÖ /-]*$'
      OR upper(word_fr) !~ '^[A-ZÄÖÅÉÈÊÀÂÇÎÔÙÛ /-]*$';

  IF left_over > 0 THEN
    RAISE NOTICE
      '% row(s) still contain characters their language keyboard cannot produce, for reasons other than a diaeresis. Run 20260825_fix_unspellable_words.sql, then the audit query below.',
      left_over;
  END IF;
END $$;

-- Verify: should return zero rows. This is the check from supabase-ops/README.md
-- narrowed to the characters the on-screen keyboards actually offer.
--
-- SELECT id, word_en, word_sv, word_fr FROM public.words
--  WHERE word_en !~ '^[A-Z /-]*$'
--     OR word_sv !~ '^[A-ZÅÄÖ /-]*$'
--     OR word_fr !~ '^[A-ZÄÖÅÉÈÊÀÂÇÎÔÙÛ /-]*$';
