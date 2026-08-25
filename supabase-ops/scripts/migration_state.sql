-- Which content migrations have actually been applied?
--
-- There is no migration-tracking table in this project, and the prose in
-- README.md and in the migration files themselves has been wrong about what was
-- applied three times running. So don't read — measure. Every row below infers
-- state from the data itself rather than from a record of what someone believes
-- they ran, which means it is also correct after a restore from backup.
--
-- Read-only. Safe to run against production, in the Supabase SQL editor:
--     \i scripts/migration_state.sql        (psql)
-- or paste the whole file.
--
-- "NOT APPLIED" for the last row is expected until the hydrocarbons seed has
-- been re-uploaded (scripts/upload_seeds_to_staging.js, then
-- 20260819_master_seed_with_french.sql).

select 'french columns populated (20260818_add_french_language)' as migration,
       case when count(*) filter (where word_fr is not null and word_fr <> '') = count(*)
            then 'APPLIED' else 'NOT APPLIED' end as status,
       count(*) filter (where word_fr is null or word_fr = '') || ' of ' || count(*) || ' rows missing word_fr' as detail
  from public.words

union all
select 'unspellable: apostrophe/ampersand/parens (20260825_fix_unspellable_words)',
       case when count(*) = 0 then 'APPLIED' else 'NOT APPLIED' end,
       count(*) || ' offending row(s)'
  from public.words
 where word_en ~ '[''&()]' or word_sv ~ '[''&()]' or word_fr ~ '[''&()]'

union all
-- The characters the *on-screen* keyboards can't produce. Stricter than
-- GameScreen.tsx's LETTER_PATTERNS, which is the physical-keyboard filter and
-- deliberately accepts more — that difference is what the earlier audit missed.
select 'diaeresis/umlaut (20260825_fix_french_dieresis)',
       case when count(*) = 0 then 'APPLIED' else 'NOT APPLIED' end,
       count(*) || ' offending row(s)'
  from public.words
 where word_fr ~ '[ÏËÜŸïëüÿ]'
    or word_sv ~ '[ÉÈÊÀÂÇÎÔÙÛÏËÜŸéèêàâçîôùûïëüÿ]'

union all
select 'retire Bicycle Brands / At sea (20260825_remove_bicycle_brands_and_at_sea)',
       case when count(*) = 0 then 'APPLIED' else 'NOT APPLIED' end,
       count(*) || ' subcategory/ies still present'
  from public.subcategories s
  join public.categories c on c.id = s.category_id
 where c.name_en ilike 'vehicles' and s.name_en in ('Bicycle Brands','At sea')

union all
select 'answer eligibility (20260825_answer_eligible_subcategories)',
       case when count(*) = 2 then 'APPLIED' else 'NOT APPLIED' end,
       'column + view present: ' || count(*) || ' of 2'
  from (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'subcategories'
       and column_name = 'is_answer_eligible'
    union all
    select 1 from information_schema.views
     where table_schema = 'public' and table_name = 'answer_eligible_words'
  ) t

union all
select 'hydrocarbons expanded to 357 rows (seed re-upload)',
       case when count(*) >= 357 then 'APPLIED' else 'NOT APPLIED' end,
       count(*) || ' words under Hydrocarbons'
  from public.words w
  join public.words_subcategories ws on ws.word_id = w.id
  join public.subcategories s on s.id = ws.subcategory_id
  join public.categories c on c.id = s.category_id
 where c.name_en ilike '%hydrocarbon%';
