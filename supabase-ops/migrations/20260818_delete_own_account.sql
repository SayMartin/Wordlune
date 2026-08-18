-- Self-service account deletion, triggered from Settings ("Delete Account"
-- in the Danger Zone). A regular client (anon key + user JWT) can't delete
-- its own auth.users row directly — that requires the service-role key,
-- which must never be shipped to the client — so this goes through a
-- security-definer RPC instead, mirroring the pattern already used for
-- cleanup_anonymous_users() in 20260818_cleanup_anonymous_users.sql.
--
-- Deleting auth.users cascades into player_profiles (on delete cascade) ->
-- game_scores/challenge_attempts/challenge_results (also on delete cascade
-- off player_profiles), and duel_matches (fixed to cascade in
-- 20260818_cleanup_anonymous_users.sql). Nothing else references
-- auth.users(id) for currently-active tables — the legacy `matches`,
-- `boards`, and `player_settings` tables are unused dead code (superseded
-- by duel_matches / never wired up / settings actually live in
-- player_profiles.metadata), so their missing cascades don't matter.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

comment on function public.delete_own_account() is
  'Self-service account deletion, callable by any authenticated user (guest or registered) via RPC. Deletes auth.users for auth.uid(), cascading into player_profiles/game_scores/challenge_attempts/challenge_results/duel_matches.';

grant execute on function public.delete_own_account() to authenticated;
