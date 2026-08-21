-- Fixes an incomplete apply of 20260822_gdpr_rls_lockdown.sql.
--
-- What went wrong
-- ---------------
-- 20260822 removed the permissive read policies by NAME:
--
--   drop policy if exists "Public read access for leaderboard" on player_profiles;
--   drop policy if exists "Anyone can view matches" on duel_matches;
--
-- Those names came from this repo's migration history, but the live database
-- has policies under different names — created by hand in the dashboard, or
-- renamed at some point. `drop policy IF EXISTS` on a name that doesn't match
-- does not error; it silently does nothing. So the statements ran "fine" and
-- the tables stayed world-readable.
--
-- Verified against production after 20260822 was applied: the anon key (which
-- ships in the public web bundle, so anyone can extract it) could still read
-- 64 player_profiles rows and 87 duel_matches rows — including secret_word for
-- duels the caller was not part of. game_scores, challenge_results,
-- challenge_attempts and player_history_view were correctly locked, because
-- those policy names did match.
--
-- The fix
-- -------
-- Drop policies by ENUMERATION rather than by name, then recreate exactly the
-- intended set. This is idempotent and cannot silently no-op. The DO block
-- raises a notice naming each policy it drops, so the SQL editor output shows
-- what was actually there.
--
-- Note this drops the write policies too, which is why every one of them is
-- recreated below — leaving them out would break signup, profile edits and
-- the whole duel flow.

-- ---------------------------------------------------------------------------
-- 1. player_profiles
-- ---------------------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'player_profiles'
  loop
    raise notice 'dropping player_profiles policy: %', pol.policyname;
    execute format('drop policy %I on public.player_profiles', pol.policyname);
  end loop;
end $$;

-- Own row only. Leaderboards get display_name/avatar_url through the
-- owner-rights views instead, each of which applies its own is_public gate.
create policy "Users can view own profile" on public.player_profiles
  for select to authenticated
  using (auth.uid() = id);

-- Needed by ensurePlayerProfile()'s upsert, which heals sessions whose
-- on_auth_user_created trigger insert failed.
create policy "Users can insert own profile" on public.player_profiles
  for insert to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile" on public.player_profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No delete policy: rows disappear by cascade from auth.users, via
-- delete_own_account() or the retention cron jobs.

alter table public.player_profiles enable row level security;
revoke insert, update on public.player_profiles from anon;

-- ---------------------------------------------------------------------------
-- 2. duel_matches
-- ---------------------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'duel_matches'
  loop
    raise notice 'dropping duel_matches policy: %', pol.policyname;
    execute format('drop policy %I on public.duel_matches', pol.policyname);
  end loop;
end $$;

-- Participants only. The lobby no longer needs open read: duel_lobby
-- (20260821) is an owner-rights view exposing only what a prospective opponent
-- must see, and pointedly not secret_word.
create policy "Players can view their own matches" on public.duel_matches
  for select to authenticated
  using (auth.uid() = player1_id or auth.uid() = player2_id);

create policy "Users can create matches" on public.duel_matches
  for insert to authenticated
  with check (auth.uid() = player1_id);

-- The `player2_id is null` arm is what lets a second player join an open
-- invitation — without it joinMatch() is impossible. Confirmed by testing
-- against production: PostgREST evaluates the SELECT policy against the NEW
-- row, where player2_id = auth.uid(), so `update ... select()` returns the
-- joined row (with secret_word) to the joiner.
--
-- The `with check` is new and deliberate: the old policy had none, so an
-- authenticated user could have written someone else's id into player2_id of
-- any open match. Now the writer must end up as a participant themselves.
create policy "Players can update their match" on public.duel_matches
  for update to authenticated
  using (
    auth.uid() = player1_id
    or auth.uid() = player2_id
    or player2_id is null
  )
  with check (auth.uid() = player1_id or auth.uid() = player2_id);

create policy "Users can delete their own matches" on public.duel_matches
  for delete to authenticated
  using (auth.uid() = player1_id);

alter table public.duel_matches enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Tighten the helper view's grants
-- ---------------------------------------------------------------------------
-- duelling requires a session; there is no visitor-facing lobby surface.
revoke all on public.duel_lobby from anon;
grant select on public.duel_lobby to authenticated;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
-- Confirm what actually ended up on the tables:
--
--   select tablename, policyname, cmd, roles
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('player_profiles','duel_matches','game_scores',
--                       'challenge_results','challenge_attempts')
--   order by tablename, cmd;
--
-- Then re-run the external check: with the anon key alone, all five of
-- player_profiles / game_scores / challenge_results / challenge_attempts /
-- duel_matches must return [].
