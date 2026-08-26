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
 where c.name_en ilike '%hydrocarbon%'

union all
-- Three separate things had to land together, so all three are checked: the
-- schedule window on the table, the rebuilt menu view, and the RLS policy that
-- stops unstarted challenges being readable with the anon key. A partial state
-- here is worse than none — the window without the policy publishes months of
-- answers.
select 'challenge rotation (20260826_challenge_rotation_reset)',
       case when count(*) = 3 then 'APPLIED' else 'NOT APPLIED' end,
       'end_date + view columns + date-gated policy: ' || count(*) || ' of 3'
  from (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'competitive_challenges'
       and column_name = 'end_date'
    union all
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'challenge_menu_stats'
       and column_name = 'subcategory_names_fr'
    union all
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'competitive_challenges'
       and cmd = 'SELECT' and qual like '%start_date%'
  ) t

union all
-- Not a migration, but the thing you actually want to know after running one:
-- how much schedule is left. The generator lays down ~35 rows covering six
-- months; when `queued` reaches zero the menu empties and nobody can play
-- competitive at all, so re-run generate_challenge.mjs well before then.
select 'challenge schedule runway',
       case when count(*) filter (where start_date > now()) > 0 then 'OK' else 'EMPTY' end,
       count(*) filter (where start_date <= now() and (end_date is null or end_date > now())) || ' live, ' ||
       count(*) filter (where start_date > now()) || ' queued, last starts ' ||
       coalesce(max(start_date)::date::text, 'n/a')
  from public.competitive_challenges

union all
-- The half of 20260827 that is easy to miss: the GDPR lockdown listed
-- challenge_results among the own-row tables, but the shared project kept a
-- second, permissive policy beside the own-row one. Policies are OR'ed, so one
-- is enough to leave every player's scores readable by any signed-in account.
-- Counts SELECT/ALL policies that do NOT mention auth.uid(); the answer must be
-- zero.
select 'challenge_results own-row only (20260827_replay_and_duel_history)',
       case when count(*) = 0 then 'APPLIED' else 'NOT APPLIED' end,
       count(*) || ' permissive SELECT policy/ies remaining'
  from pg_policies
 where schemaname = 'public' and tablename = 'challenge_results'
   and cmd in ('SELECT', 'ALL')
   and (qual is null or qual not like '%auth.uid()%')

union all
select 'replay + duel history (20260827_replay_and_duel_history)',
       case when count(*) = 5 then 'APPLIED' else 'NOT APPLIED' end,
       -- 3 duel_matches columns + the my_duel_history view + the restart RPC
       'score columns + view + restart function: ' || count(*) || ' of 5'
  from (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='duel_matches'
       and column_name in ('player1_score','player2_score','finished_at')
    union all
    select 1 from information_schema.views
     where table_schema='public' and table_name='my_duel_history'
    union all
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname='restart_challenge_attempt'
  ) t

union all
-- Only the first completed run per player per challenge may rank; a replay is
-- practice, since the words are already known. Any duplicate here means the
-- DISTINCT ON was lost in a later view edit.
select 'leaderboard ranks first run only (20260827)',
       case when count(*) = 0 then 'APPLIED' else 'NOT APPLIED' end,
       count(*) || ' player/challenge pair(s) listed more than once'
  from (
    select player_id, challenge_id
      from public.leaderboard_entries
     group by player_id, challenge_id
    having count(*) > 1
  ) d

union all
-- A challenge name is visible before the round starts, and starting begins a
-- clock that counts. Any theme left in a name is a head start.
select 'neutral challenge names (20260829)',
       case when count(*) = 0 then 'APPLIED' else 'NOT APPLIED' end,
       count(*) || ' challenge name(s) still advertising their theme'
  from public.competitive_challenges
 where name like '%— week of %'

union all
select 'duel timeouts (20260828_duel_timeouts)',
       case when count(*) = 4 then 'APPLIED' else 'NOT APPLIED' end,
       'columns + 3 functions: ' || count(*) || ' of 4'
  from (
    select 1 where (select count(*) from information_schema.columns
                     where table_schema='public' and table_name='duel_matches'
                       and column_name in ('started_at','finish_reason','player1_guesses','player2_guesses',
                                           'player1_best_correct','player2_best_correct',
                                           'player1_best_present','player2_best_present',
                                           'player1_last_activity_at','player2_last_activity_at')) = 10
    union all
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname in ('resolve_duel','record_duel_progress','sweep_stale_duels')
  ) t

union all
-- The sweeper is what closes duels both players walked away from; without the
-- cron job the rules only apply while someone still has the app open.
select 'duel sweeper scheduled (20260828)',
       case when count(*) = 1 then 'APPLIED' else 'NOT APPLIED' end,
       count(*) || ' cron job(s) named sweep-stale-duels'
  from cron.job where jobname = 'sweep-stale-duels'

union all
-- Duels that should have been closed by now. Anything quiet for more than the
-- 8-minute silence clock plus a sweep interval is a stuck row.
select 'no stuck duels',
       case when count(*) = 0 then 'OK' else 'STUCK' end,
       count(*) || ' duel(s) running with no activity for over 15 minutes'
  from public.duel_matches
 where status = 'playing'
   and player2_id is not null
   and greatest(coalesce(player1_last_activity_at, started_at, created_at),
                coalesce(player2_last_activity_at, started_at, created_at)) < now() - interval '15 minutes';
