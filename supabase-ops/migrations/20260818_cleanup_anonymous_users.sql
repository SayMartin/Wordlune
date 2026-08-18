-- Guest ("anonymous") accounts are never deleted by the app itself — a
-- "Play as Guest" login creates a permanent row in auth.users (just flagged
-- is_anonymous = true) with an auto-refreshing session, so it persists
-- forever unless something explicitly cleans it up. This migration adds
-- that cleanup as a daily pg_cron job.
--
-- player_profiles/game_scores already cascade-delete cleanly off
-- auth.users (see 20260124_create_player_profiles.sql /
-- 20260124_create_game_scores.sql). duel_matches does not: its
-- player1_id/player2_id/winner_id FKs have no ON DELETE behavior, so
-- Postgres's default RESTRICT would block deleting any guest who ever
-- played a Duel. Fix that first.

-- 1. Make duel_matches FKs cascade. player1_id is NOT NULL, so it can't use
--    SET NULL — CASCADE (drop the whole match row) is used for all three
--    for consistency; the other player just loses that one match from
--    their history/duel_leaderboard, which is an acceptable tradeoff for
--    purging stale guest data (mirrors how player_profiles/game_scores
--    already cascade rather than block).
ALTER TABLE public.duel_matches DROP CONSTRAINT IF EXISTS duel_matches_player1_id_fkey;
ALTER TABLE public.duel_matches
  ADD CONSTRAINT duel_matches_player1_id_fkey
  FOREIGN KEY (player1_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.duel_matches DROP CONSTRAINT IF EXISTS duel_matches_player2_id_fkey;
ALTER TABLE public.duel_matches
  ADD CONSTRAINT duel_matches_player2_id_fkey
  FOREIGN KEY (player2_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.duel_matches DROP CONSTRAINT IF EXISTS duel_matches_winner_id_fkey;
ALTER TABLE public.duel_matches
  ADD CONSTRAINT duel_matches_winner_id_fkey
  FOREIGN KEY (winner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. The cleanup function itself. Deletes straight from auth.users for any
--    account still flagged anonymous (never signed up / linked to a real
--    login) whose last sign-in is older than `stale_after`. Deleting from
--    auth.users cascades into player_profiles -> game_scores and (after
--    the fix above) duel_matches automatically.
create or replace function public.cleanup_anonymous_users(stale_after interval default interval '14 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with stale_anonymous as (
    select id from auth.users
    where is_anonymous = true
      and coalesce(last_sign_in_at, created_at) < now() - stale_after
  )
  delete from auth.users
  where id in (select id from stale_anonymous);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

comment on function public.cleanup_anonymous_users(interval) is
  'Deletes guest (is_anonymous=true) auth.users accounts inactive for longer than stale_after (default 14 days). Cascades to player_profiles, game_scores, and duel_matches. Scheduled daily via pg_cron below.';

-- 3. Schedule it. Requires the pg_cron extension (Database -> Extensions in
--    the Supabase dashboard, or the line below if you have the privileges
--    to run it directly).
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'cleanup-anonymous-users',
  '0 3 * * *', -- daily at 03:00 UTC
  $$ select public.cleanup_anonymous_users(); $$
);
