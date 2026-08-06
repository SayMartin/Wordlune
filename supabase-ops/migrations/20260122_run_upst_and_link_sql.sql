-- Migration: Run UPSERT and link SQL for staging_import_rows
-- This migration processes the staging_import_rows table to upsert words,
-- categories, and subcategories into their respective tables, normalizing data
-- and linking words to categories and subcategories.

-- copy paste or drag and drop csv into the table: staging_import_rows


BEGIN;

-- 1) normalize into a temp table
DROP TABLE IF EXISTS tmp_norm;
CREATE TEMP TABLE tmp_norm AS
SELECT
  id,
  NULLIF(lower(trim(word_native)),'') AS word_native,
  NULLIF(NULLIF(initcap(trim(word_en)),'') , '') AS word_en,
  NULLIF(NULLIF(initcap(trim(word_sv)),'') , '') AS word_sv,
  NULLIF(lower(trim(category_name_native)),'') AS category_name_native,
  NULLIF(NULLIF(initcap(trim(category_name_en)),'') , '') AS category_name_en,
  NULLIF(NULLIF(initcap(trim(category_name_sv)),'') , '') AS category_name_sv,
  NULLIF(lower(trim(subcategory_name_native)),'') AS subcategory_name_native,
  NULLIF(NULLIF(initcap(trim(subcategory_name_en)),'') , '') AS subcategory_name_en,
  NULLIF(NULLIF(initcap(trim(subcategory_name_sv)),'') , '') AS subcategory_name_sv,
  difficulty, source, created_by, is_active, created_at
FROM public.staging_import_rows;

-- 2) upsert categories (dedup by exact conflict key)
INSERT INTO public.categories (name_native, name_en, name_sv, created_at, updated_at)
SELECT
  name_native, name_en, name_sv, now(), now()
FROM (
  SELECT DISTINCT ON (COALESCE(category_name_native, category_name_en))
    COALESCE(category_name_native, category_name_en) AS name_native,
    category_name_en AS name_en,
    category_name_sv AS name_sv
  FROM tmp_norm
  WHERE COALESCE(category_name_native, category_name_en) IS NOT NULL
  ORDER BY COALESCE(category_name_native, category_name_en)
) s
ON CONFLICT (name_native) DO UPDATE
SET
  name_en = COALESCE(EXCLUDED.name_en, categories.name_en),
  name_sv = COALESCE(EXCLUDED.name_sv, categories.name_sv),
  updated_at = now();

-- 3) upsert subcategories (resolve category_id then dedup by category_id + name_native)
WITH cats AS (
  SELECT id, name_native, name_en FROM public.categories
), sources AS (
  SELECT DISTINCT ON (COALESCE(category_name_native, category_name_en), COALESCE(subcategory_name_native, subcategory_name_en))
    COALESCE(category_name_native, category_name_en) AS category_key,
    COALESCE(subcategory_name_native, subcategory_name_en) AS subcategory_key,
    subcategory_name_en,
    subcategory_name_sv
  FROM tmp_norm
  WHERE COALESCE(subcategory_name_native, subcategory_name_en) IS NOT NULL
  ORDER BY COALESCE(category_name_native, category_name_en), COALESCE(subcategory_name_native, subcategory_name_en)
)
INSERT INTO public.subcategories (category_id, name_native, name_en, name_sv, created_at, updated_at)
SELECT
  c.id,
  s.subcategory_key AS name_native,
  s.subcategory_name_en AS name_en,
  s.subcategory_name_sv AS name_sv,
  now(), now()
FROM sources s
JOIN cats c ON (c.name_native = s.category_key OR c.name_en = s.category_key)
ON CONFLICT (name_native) DO UPDATE
SET
  name_en = COALESCE(EXCLUDED.name_en, subcategories.name_en),
  name_sv = COALESCE(EXCLUDED.name_sv, subcategories.name_sv),
  updated_at = now();

-- 4a) insert only truly new words (dedupe by canonical key)
INSERT INTO public.words (word_native, word_en, word_sv, difficulty, source, created_by, is_active, created_at, updated_at)
SELECT
  COALESCE(s.word_native, s.word_en) AS word_native,
  s.word_en,
  s.word_sv,
  s.difficulty,
  s.source,
  s.created_by,
  COALESCE(s.is_active, true),
  now(),
  now()
FROM (
  SELECT DISTINCT ON (COALESCE(word_native, word_en))
    word_native,
    word_en,
    word_sv,
    difficulty,
    source,
    created_by,
    is_active,
    id
  FROM tmp_norm
  WHERE COALESCE(word_native, word_en) IS NOT NULL
  ORDER BY COALESCE(word_native, word_en), (word_native IS NULL), id
) s
LEFT JOIN public.words w_existing
  ON (w_existing.word_native = s.word_native AND s.word_native IS NOT NULL)
     OR (w_existing.word_en = s.word_en AND s.word_en IS NOT NULL)
WHERE w_existing.id IS NULL;

-- 4b) update existing word rows
WITH src AS (
  SELECT DISTINCT ON (COALESCE(word_native, word_en))
    word_native,
    word_en,
    word_sv,
    difficulty,
    source,
    created_by,
    COALESCE(is_active, true) AS is_active,
    id
  FROM tmp_norm
  WHERE COALESCE(word_native, word_en) IS NOT NULL
  ORDER BY COALESCE(word_native, word_en), (word_native IS NULL), id
)
UPDATE public.words w
SET
  word_native = COALESCE(src.word_native, w.word_native),
  word_en = COALESCE(src.word_en, w.word_en),
  word_sv = COALESCE(src.word_sv, w.word_sv),
  difficulty = COALESCE(src.difficulty, w.difficulty),
  source = COALESCE(src.source, w.source),
  created_by = COALESCE(src.created_by, w.created_by),
  is_active = COALESCE(src.is_active, w.is_active),
  updated_at = now()
FROM src
WHERE
  (w.word_native IS NOT NULL AND w.word_native = src.word_native)
  OR (w.word_en IS NOT NULL AND w.word_en = src.word_en);

-- 5) link words -> categories
WITH w AS (
  SELECT id, word_native, word_en FROM public.words
), c AS (
  SELECT id, name_native, name_en FROM public.categories
), mappings AS (
  SELECT DISTINCT w.id AS word_id, c.id AS category_id
  FROM tmp_norm t
  JOIN w ON (
    (t.word_native IS NOT NULL AND w.word_native = t.word_native)
    OR (t.word_native IS NULL AND t.word_en IS NOT NULL AND w.word_en = t.word_en)
  )
  JOIN c ON (
    (t.category_name_native IS NOT NULL AND c.name_native = t.category_name_native)
    OR (t.category_name_native IS NULL AND t.category_name_en IS NOT NULL AND c.name_en = t.category_name_en)
  )
  WHERE COALESCE(t.category_name_native, t.category_name_en) IS NOT NULL
)
INSERT INTO public.words_categories (word_id, category_id)
SELECT word_id, category_id FROM mappings
ON CONFLICT DO NOTHING;

-- 6) link words -> subcategories
WITH w AS (
  SELECT id, word_native, word_en FROM public.words
), s AS (
  SELECT id, name_native, name_en, category_id FROM public.subcategories
), mappings AS (
  SELECT DISTINCT w.id AS word_id, s.id AS subcategory_id
  FROM tmp_norm t
  JOIN w ON (
    (t.word_native IS NOT NULL AND w.word_native = t.word_native)
    OR (t.word_native IS NULL AND t.word_en IS NOT NULL AND w.word_en = t.word_en)
  )
  JOIN s ON (
    (t.subcategory_name_native IS NOT NULL AND s.name_native = t.subcategory_name_native)
    OR (t.subcategory_name_native IS NULL AND t.subcategory_name_en IS NOT NULL AND s.name_en = t.subcategory_name_en)
  )
  WHERE COALESCE(t.subcategory_name_native, t.subcategory_name_en) IS NOT NULL
)
INSERT INTO public.words_subcategories (word_id, subcategory_id)
SELECT word_id, subcategory_id FROM mappings
ON CONFLICT DO NOTHING;

-- 7) summary counts
SELECT
  (SELECT count(*) FROM tmp_norm) AS staging_rows,
  (SELECT count(*) FROM public.words WHERE updated_at > now() - interval '1 minute') AS words_changed_last_min,
  (SELECT count(*) FROM public.categories WHERE updated_at > now() - interval '1 minute') AS categories_changed_last_min,
  (SELECT count(*) FROM public.subcategories WHERE updated_at > now() - interval '1 minute') AS subcategories_changed_last_min;

COMMIT;
