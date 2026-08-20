-- Phase 1c of the GDPR lockdown. This is the migration that actually closes
-- the holes; 20260821_gdpr_privacy_helpers.sql only prepared the ground.
--
-- !! DO NOT APPLY until the client changes from phase 1b are deployed !!
-- Those repoint isDisplayNameTaken/suggestUniqueDisplayName to the new RPCs,
-- listWaitingMatches to the duel_lobby view, and useDuelMode to
-- match_player_names(). Applying this first breaks signup name suggestions,
-- the duel lobby, and opponent names, all silently (they degrade to "free",
-- "empty", and "Player 2" rather than erroring).
--
-- What was wrong
-- --------------
-- Four tables carried `SELECT USING (true)` policies, so the entire contents
-- were readable by anyone holding the anon key — which ships inside the web
-- bundle and is therefore public by construction:
--
--   * player_profiles   — every player's metadata (theme/language/level) and
--                         deletion_warned_at, the latter announcing that a
--                         given account is dormant and days from deletion.
--   * game_scores       — every practice round of every player, including the
--                         secret word, seed, timings and player_id. The
--                         is_public opt-in existed only in the views, never
--                         in RLS, so it protected nothing against a direct
--                         PostgREST query.
--   * challenge_results — same, same is_public gap.
--   * duel_matches      — every match's secret_word, plus both player UUIDs.
--
-- Two views had no visibility gate at all (duel_leaderboard,
-- player_history_view), and the latter runs with owner rights, so passing
-- ?player_id=eq.<someone-else> returned their entire practice history.

-- ---------------------------------------------------------------------------
-- 1. player_profiles — own row only
-- ---------------------------------------------------------------------------
-- Both public read policies go, not just the unconditional one. The
-- `is_public = true` variant looked narrower but still exposed metadata and
-- deletion_warned_at for every player who had ever opted into a leaderboard.
-- Leaderboard display names and avatars now come exclusively from the
-- owner-rights views below, which select only display_name and avatar_url.
drop policy if exists "Public read access for leaderboard" on public.player_profiles;
drop policy if exists "Public profiles are viewable by everyone" on public.player_profiles;

-- "Users can view own profile" (auth.uid() = id) from
-- 20260124_create_player_profiles.sql is kept and is now the only read path.
-- Recreated here idempotently in case an environment lost it.
drop policy if exists "Users can view own profile" on public.player_profiles;
create policy "Users can view own profile" on public.player_profiles
  for select using (auth.uid() = id);

-- 20260124_fix_player_profiles_rls.sql granted INSERT/UPDATE to `anon`. RLS
-- still blocked it (both policies require auth.uid() = id, and anon has no
-- uid), so this was defence in depth rather than an active hole — but there is
-- no reason for the grant to exist. Note guests are NOT affected: Supabase
-- anonymous sign-ins get the `authenticated` role with an is_anonymous claim,
-- not the `anon` role.
revoke insert, update on public.player_profiles from anon;

-- ---------------------------------------------------------------------------
-- 2. game_scores — own row only
-- ---------------------------------------------------------------------------
-- Safe because nothing reads other players' game_scores any more:
-- leaderboard_entries was moved off game_scores onto challenge_results in
-- 20260203_update_leaderboard_view.sql, player_history_view is handled below,
-- and getMyScores()/getPlayerGameHistory() already filter to the caller.
drop policy if exists "Everyone can view game scores" on public.game_scores;
create policy "Users can view own scores" on public.game_scores
  for select using (auth.uid() = player_id);

-- ---------------------------------------------------------------------------
-- 3. challenge_results — own row only
-- ---------------------------------------------------------------------------
-- The competitive_challenges(name) join in getMyChallengeResults() survives:
-- that table holds no personal data and keeps its own open read policy.
drop policy if exists "Everyone can read challenge results" on public.challenge_results;
create policy "Users can view own challenge results" on public.challenge_results
  for select using (auth.uid() = player_id);

-- ---------------------------------------------------------------------------
-- 4. duel_matches — participants only
-- ---------------------------------------------------------------------------
-- The lobby no longer needs open read: duel_lobby (20260821) is an
-- owner-rights view that exposes only what a prospective opponent must see,
-- and pointedly not secret_word.
--
-- joinMatch() does `update ... .select().single()`. PostgREST evaluates the
-- SELECT policy against the NEW row, where player2_id = auth.uid(), so it
-- passes. This is the single riskiest change in the whole lockdown — verify
-- with two real accounts before considering it done.
drop policy if exists "Anyone can view matches" on public.duel_matches;
create policy "Players can view their own matches" on public.duel_matches
  for select to authenticated
  using (auth.uid() = player1_id or auth.uid() = player2_id);

-- ---------------------------------------------------------------------------
-- 5. player_history_view — caller's own history only
-- ---------------------------------------------------------------------------
-- Belt and braces: security_invoker makes the underlying own-row policies from
-- sections 2 and 3 apply to the view too, and the explicit auth.uid() filter
-- means it stays correct even if someone later relaxes those policies.
-- Column list is unchanged, so CREATE OR REPLACE is legal.
create or replace view public.player_history_view as
select
    gs.id,
    gs.player_id,
    'practice' as mode,
    gs.score,
    gs.duration_seconds,
    gs.word as description,
    gs.completed_at
from public.game_scores gs
where gs.game_mode = 'practice'
  and gs.player_id = auth.uid()

union all

select
    cr.id,
    cr.player_id,
    'competitive' as mode,
    cr.total_score as score,
    cr.total_duration as duration_seconds,
    cc.name as description,
    cr.completed_at
from public.challenge_results cr
left join public.competitive_challenges cc on cr.challenge_id = cc.id
where cr.player_id = auth.uid();

alter view public.player_history_view set (security_invoker = true);

comment on view public.player_history_view is
  'Combined practice + competitive history for the CALLING player only (auth.uid()). Previously owner-rights with no filter, which let any client read another player''s practice history — including the secret words — by passing ?player_id=eq.<uuid>.';

-- ---------------------------------------------------------------------------
-- 6. duel_leaderboard — respect profile visibility
-- ---------------------------------------------------------------------------
-- This view had no is_public check of any kind, so a guest who had never opted
-- into anything appeared on a public leaderboard the moment they won a duel.
-- Unlike scores there is no per-duel visibility flag, so the profile-level
-- is_public is the right gate.
create or replace view public.duel_leaderboard as
select
  dm.winner_id as player_id,
  pp.display_name,
  pp.avatar_url,
  count(dm.id) as wins
from public.duel_matches dm
join public.player_profiles pp on dm.winner_id = pp.id
where dm.status = 'finished'
  and dm.winner_id is not null
  and pp.is_public = true
group by dm.winner_id, pp.display_name, pp.avatar_url;

comment on view public.duel_leaderboard is
  'Duel win counts for players who have made their profile public. The is_public gate was added in 20260822; before that every duel winner was listed, including guests who never opted in.';

-- ---------------------------------------------------------------------------
-- 7. Pin view security mode and tighten grants
-- ---------------------------------------------------------------------------
-- These three must stay owner-rights: they join player_profiles/challenge_
-- results to show OTHER players, which is legitimate precisely because each
-- one applies its own is_public gate. Pinning the setting explicitly means a
-- future Postgres/Supabase default change can't silently turn them into
-- invoker-rights views (which would render every leaderboard empty) — the
-- inverse of the player_history_view fix above.
alter view public.leaderboard_entries    set (security_invoker = false);
alter view public.challenge_leaderboards set (security_invoker = false);
alter view public.duel_leaderboard       set (security_invoker = false);

-- Leaderboards live behind SessionGate; there is no visitor-facing surface.
revoke select on public.leaderboard_entries    from anon;
revoke select on public.challenge_leaderboards from anon;
revoke select on public.duel_leaderboard       from anon;
grant  select on public.leaderboard_entries    to authenticated;
grant  select on public.challenge_leaderboards to authenticated;
grant  select on public.duel_leaderboard       to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Drop dead tables (data minimisation, Art. 5(1)(c))
-- ---------------------------------------------------------------------------
-- Why these go:
--   * All five reference auth.users(id) or player_profiles(id) with NO ON
--     DELETE behaviour, so they hold personal data that neither
--     delete_own_account() nor the retention cron jobs can reach. A user who
--     "deleted everything" would still have rows here.
--   * board_events.user_id was written by addBoardEvent() from
--     useBoardRealtime, which had zero consumers anywhere in src/ (verified) —
--     data collected for a feature that was never wired up. Both the hook and
--     the four repository helpers are deleted in the same change as this
--     migration.
--   * matches is superseded by duel_matches, boards was never wired up, and
--     player_settings is dead because settings actually live in
--     player_profiles.metadata.settings. All three are called out as dead in
--     20260818_delete_own_account.sql's own comment.
--
-- board_events/board_state have no CREATE TABLE anywhere in this repo's
-- migration history, so they exist only if they were created by hand in the
-- dashboard — hence `if exists` on all five.
--
-- No row-count check first: the app is not publicly released yet (friends-only
-- testing), so there is no production data worth preserving in any of these.
drop table if exists public.board_events cascade;
drop table if exists public.board_state cascade;
drop table if exists public.matches cascade;
drop table if exists public.boards cascade;
drop table if exists public.player_settings cascade;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
-- With the anon key alone, all four of these must return []:
--
--   for t in player_profiles game_scores challenge_results duel_matches; do
--     curl -s "$URL/rest/v1/$t?select=*&limit=5" \
--          -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--   done
--
-- Then with a real user JWT: each returns only that user's rows, and
--   $URL/rest/v1/player_history_view?player_id=eq.<other-users-uuid>
-- returns [].
--
-- Then by hand, with two accounts: A creates a duel, B sees it in the lobby
-- (but cannot read secret_word from duel_lobby), B joins, both see each
-- other's display names, the duel plays through to a winner.
