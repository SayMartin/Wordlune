-- Supersedes 20260127_master_seed.sql: that version predates French support
-- (20260818_add_french_language.sql) and never touched word_fr/
-- category_name_fr/subcategory_name_fr, so every staging->seed run since
-- French was added has silently left word_fr NULL for new/updated words.
-- This version mirrors the existing _sv handling for _fr end to end.
--
-- Requires staging_import_rows to already have word_fr/category_name_fr/
-- subcategory_name_fr columns:
--   ALTER TABLE public.staging_import_rows
--     ADD COLUMN IF NOT EXISTS word_fr text,
--     ADD COLUMN IF NOT EXISTS category_name_fr text,
--     ADD COLUMN IF NOT EXISTS subcategory_name_fr text;

BEGIN;

-- 1) normalize into a temp table
DROP TABLE IF EXISTS tmp_norm;
CREATE TEMP TABLE tmp_norm AS
SELECT
  id,
  NULLIF(lower(trim(word_native)),'') AS word_native,
  NULLIF(trim(word_en),'') AS word_en,
  NULLIF((trim(word_sv)), '') AS word_sv,
  NULLIF((trim(word_fr)), '') AS word_fr,
  NULLIF(lower(trim(category_name_native)),'') AS category_name_native,
  NULLIF((trim(category_name_en)), '') AS category_name_en,
  NULLIF((trim(category_name_sv)), '') AS category_name_sv,
  NULLIF((trim(category_name_fr)), '') AS category_name_fr,
  NULLIF(lower(trim(subcategory_name_native)),'') AS subcategory_name_native,
  NULLIF((trim(subcategory_name_en)), '') AS subcategory_name_en,
  NULLIF((trim(subcategory_name_sv)), '') AS subcategory_name_sv,
  NULLIF((trim(subcategory_name_fr)), '') AS subcategory_name_fr,
  difficulty, source, created_by, is_active, created_at
FROM public.staging_import_rows;

-- 2) upsert categories (unchanged: do NOT modify name_en/name_sv/name_fr)
INSERT INTO public.categories (name_native, name_en, name_sv, name_fr, created_at, updated_at)
SELECT
  name_native, name_en, name_sv, name_fr, now(), now()
FROM (
  SELECT DISTINCT ON (COALESCE(category_name_native, category_name_en))
    COALESCE(category_name_native, category_name_en) AS name_native,
    category_name_en AS name_en,
    category_name_sv AS name_sv,
    category_name_fr AS name_fr
  FROM tmp_norm
  WHERE COALESCE(category_name_native, category_name_en) IS NOT NULL
  ORDER BY COALESCE(category_name_native, category_name_en)
) s
ON CONFLICT (name_native) DO UPDATE
SET
  name_en = COALESCE(EXCLUDED.name_en, categories.name_en),
  name_sv = COALESCE(EXCLUDED.name_sv, categories.name_sv),
  name_fr = COALESCE(EXCLUDED.name_fr, categories.name_fr),
  updated_at = now();

-- 3) upsert subcategories (unchanged: do NOT modify name_en/name_sv/name_fr)
WITH cats AS (
  SELECT id, name_native, name_en FROM public.categories
), sources AS (
  SELECT DISTINCT ON (COALESCE(category_name_native, category_name_en), COALESCE(subcategory_name_native, subcategory_name_en))
    COALESCE(category_name_native, category_name_en) AS category_key,
    COALESCE(subcategory_name_native, subcategory_name_en) AS subcategory_key,
    subcategory_name_en,
    subcategory_name_sv,
    subcategory_name_fr
  FROM tmp_norm
  WHERE COALESCE(subcategory_name_native, subcategory_name_en) IS NOT NULL
  ORDER BY COALESCE(category_name_native, category_name_en), COALESCE(subcategory_name_native, subcategory_name_en)
)
INSERT INTO public.subcategories (category_id, name_native, name_en, name_sv, name_fr, created_at, updated_at)
SELECT
  c.id,
  s.subcategory_key AS name_native,
  s.subcategory_name_en AS name_en,
  s.subcategory_name_sv AS name_sv,
  s.subcategory_name_fr AS name_fr,
  now(), now()
FROM sources s
JOIN cats c ON (c.name_native = s.category_key OR c.name_en = s.category_key)
ON CONFLICT (name_native) DO UPDATE
SET
  name_en = COALESCE(EXCLUDED.name_en, subcategories.name_en),
  name_sv = COALESCE(EXCLUDED.name_sv, subcategories.name_sv),
  name_fr = COALESCE(EXCLUDED.name_fr, subcategories.name_fr),
  updated_at = now();

-- 4) SAFE: build canonicalized source rows into a temp table (tmp_src)
DROP TABLE IF EXISTS tmp_src;
CREATE TEMP TABLE tmp_src AS
WITH canon AS (
  SELECT
    id,
    NULLIF(lower(trim(word_native)), '') AS word_native_l,
    NULLIF(lower(trim(word_en)), '') AS word_en_l,
    word_sv,
    word_fr,
    difficulty,
    source,
    created_by,
    COALESCE(NULLIF(lower(trim(word_native)), ''), NULLIF(lower(trim(word_en)), '')) AS canonical_key
  FROM tmp_norm
)
SELECT DISTINCT ON (canonical_key)
  canonical_key,
  word_native_l,
  word_en_l,
  word_sv,
  word_fr,
  difficulty,
  source,
  created_by,
  id
FROM canon
WHERE canonical_key IS NOT NULL
ORDER BY canonical_key, (word_native_l IS NULL), id;

-- 4a) insert truly new canonical entries into words
-- ONLY word_en, word_sv and word_fr are uppercased on insert
WITH existing AS (
  SELECT
    w.id,
    w.word_native,
    w.word_en,
    lower(w.word_native) AS word_native_l,
    lower(w.word_en) AS word_en_l
  FROM public.words w
  WHERE lower(w.word_native) IS NOT NULL OR lower(w.word_en) IS NOT NULL
),
to_insert AS (
  SELECT s.*
  FROM tmp_src s
  LEFT JOIN existing e
    ON (e.word_native_l = s.canonical_key)
       OR (e.word_en_l = s.canonical_key)
  WHERE e.id IS NULL
)
INSERT INTO public.words (word_native, word_en, word_sv, word_fr, difficulty, source, created_by, is_active, created_at, updated_at)
SELECT
  s.canonical_key AS word_native,   -- canonical, lowercased native
  CASE WHEN s.word_en_l IS NULL THEN NULL WHEN s.word_en_l = '' THEN '' ELSE upper(s.word_en_l) END AS word_en,
  CASE WHEN s.word_sv IS NULL THEN NULL WHEN s.word_sv = '' THEN '' ELSE upper(s.word_sv) END AS word_sv,
  CASE WHEN s.word_fr IS NULL THEN NULL WHEN s.word_fr = '' THEN '' ELSE upper(s.word_fr) END AS word_fr,
  s.difficulty,
  s.source,
  s.created_by,
  true AS is_active,
  now(),
  now()
FROM to_insert s;

-- 4b) safe update existing word rows from tmp_src,
-- only uppercasing word_en/word_sv/word_fr when updating; native fields remain canonical
WITH existing AS (
  SELECT
    w.id,
    w.word_native,
    w.word_en,
    lower(w.word_native) AS word_native_l,
    lower(w.word_en) AS word_en_l
  FROM public.words w
  WHERE lower(w.word_native) IS NOT NULL OR lower(w.word_en) IS NOT NULL
),
src_upd AS (
  SELECT s.*
  FROM tmp_src s
  JOIN existing e
    ON (e.word_native_l = s.canonical_key)
       OR (e.word_en_l = s.canonical_key)
)
UPDATE public.words w
SET
  -- only set word_native when it's NULL and no other row would conflict
  word_native = CASE
    WHEN w.word_native IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.words w2
        WHERE w2.id <> w.id AND lower(w2.word_native) = src_upd.canonical_key
      )
    THEN src_upd.canonical_key
    ELSE w.word_native
  END,
  word_en = COALESCE(
    (CASE WHEN src_upd.word_en_l IS NULL THEN NULL WHEN src_upd.word_en_l = '' THEN '' ELSE upper(src_upd.word_en_l) END),
    w.word_en
  ),
  word_sv = COALESCE(
    (CASE WHEN src_upd.word_sv IS NULL THEN NULL WHEN src_upd.word_sv = '' THEN '' ELSE upper(src_upd.word_sv) END),
    w.word_sv
  ),
  word_fr = COALESCE(
    (CASE WHEN src_upd.word_fr IS NULL THEN NULL WHEN src_upd.word_fr = '' THEN '' ELSE upper(src_upd.word_fr) END),
    w.word_fr
  ),
  difficulty = COALESCE(src_upd.difficulty, w.difficulty),
  source = COALESCE(src_upd.source, w.source),
  created_by = COALESCE(src_upd.created_by, w.created_by),
  updated_at = now()
FROM src_upd
WHERE
  (w.word_native IS NOT NULL AND lower(w.word_native) = src_upd.canonical_key)
  OR (w.word_en IS NOT NULL AND lower(w.word_en) = src_upd.canonical_key);

-- 5) link words -> categories (CASE-INSENSITIVE joins, unaffected by French)
WITH w AS (
  SELECT id, word_native, word_en FROM public.words
), c AS (
  SELECT id, name_native, name_en FROM public.categories
), mappings AS (
  SELECT DISTINCT w.id AS word_id, c.id AS category_id
  FROM tmp_norm t
  JOIN w ON (
    (t.word_native IS NOT NULL AND lower(w.word_native) = lower(t.word_native))
    OR (t.word_native IS NULL AND t.word_en IS NOT NULL AND lower(w.word_en) = lower(t.word_en))
  )
  JOIN c ON (
    (t.category_name_native IS NOT NULL AND lower(c.name_native) = lower(t.category_name_native))
    OR (t.category_name_native IS NULL AND t.category_name_en IS NOT NULL AND lower(c.name_en) = lower(t.category_name_en))
  )
  WHERE COALESCE(t.category_name_native, t.category_name_en) IS NOT NULL
)
INSERT INTO public.words_categories (word_id, category_id)
SELECT word_id, category_id FROM mappings
ON CONFLICT DO NOTHING;

-- 6) link words -> subcategories (CASE-INSENSITIVE joins, unaffected by French)
WITH w AS (
  SELECT id, word_native, word_en FROM public.words
), s AS (
  SELECT id, name_native, name_en, category_id FROM public.subcategories
), mappings AS (
  SELECT DISTINCT w.id AS word_id, s.id AS subcategory_id
  FROM tmp_norm t
  JOIN w ON (
    (t.word_native IS NOT NULL AND lower(w.word_native) = lower(t.word_native))
    OR (t.word_native IS NULL AND t.word_en IS NOT NULL AND lower(w.word_en) = lower(t.word_en))
  )
  JOIN s ON (
    (t.subcategory_name_native IS NOT NULL AND lower(s.name_native) = lower(t.subcategory_name_native))
    OR (t.subcategory_name_native IS NULL AND t.subcategory_name_en IS NOT NULL AND lower(s.name_en) = lower(t.subcategory_name_en))
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
  (SELECT count(*) FROM public.words WHERE word_fr IS NULL AND updated_at > now() - interval '1 minute') AS words_missing_fr_last_min,
  (SELECT count(*) FROM public.categories WHERE updated_at > now() - interval '1 minute') AS categories_changed_last_min,
  (SELECT count(*) FROM public.subcategories WHERE updated_at > now() - interval '1 minute') AS subcategories_changed_last_min;

COMMIT;
