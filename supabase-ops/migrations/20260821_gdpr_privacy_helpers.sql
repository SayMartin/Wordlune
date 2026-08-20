-- Phase 1a of the GDPR lockdown: purely ADDITIVE. Nothing here changes any
-- existing policy, table, or view — it only adds the server-side replacements
-- the client needs before 20260822_gdpr_rls_lockdown.sql can safely remove the
-- `USING (true)` read policies.
--
-- Apply order matters:
--   1. this migration
--   2. ship the client changes that call these (isDisplayNameTaken,
--      suggestUniqueDisplayName, listWaitingMatches, useDuelMode)
--   3. only then 20260822_gdpr_rls_lockdown.sql
--
-- Running 3 before 2 breaks signup name suggestions and the duel lobby.
--
-- Why these exist at all: three client code paths currently read OTHER users'
-- player_profiles rows directly, which is only possible because of the
-- "Public read access for leaderboard" SELECT USING (true) policy added in
-- 20260124_fix_player_profiles_rls.sql. That policy exposes the whole table —
-- including metadata (theme/language/reduceMotion/level) and
-- deletion_warned_at, which leaks that a given account is dormant and days
-- from deletion. Moving these three reads behind security-definer functions
-- lets the base table be locked to own-row-only.

-- 1. Display-name availability. Replaces the client's
--    `select id, count exact, head, eq display_name` in isDisplayNameTaken().
--
--    Deliberately case-SENSITIVE (`=`, not ilike/lower), to exactly match the
--    unique constraint from 20260123_enforce_unique_display_names.sql. Making
--    this case-insensitive would reject names Postgres would happily accept,
--    which is a behaviour change, not a fix.
create or replace function public.display_name_available(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_name is not null
     and p_name <> ''
     and not exists (
       select 1 from public.player_profiles where display_name = p_name
     );
$$;

comment on function public.display_name_available(text) is
  'True when p_name is non-empty and not already used as a player_profiles.display_name. Security definer so clients can check availability without being able to read other players'' profile rows. Case-sensitive, matching the unique constraint on display_name.';

grant execute on function public.display_name_available(text) to anon, authenticated;

-- 2. Unique display-name suggestion. Replaces suggestUniqueDisplayName()'s
--    `ilike '<prefix>%'` scan, which returned every matching display name in
--    the table to the client just to pick a free suffix.
--
--    This is a direct port of the client loop (players-repository.ts:81-134),
--    including its quirks, so behaviour is unchanged:
--      * base truncated to 15 chars (MAX_DISPLAY_NAME_LENGTH) up front;
--      * if the bare base is free, it's returned as-is;
--      * otherwise suffixes 1, 2, 3, ... are appended, with the base
--        re-truncated each time so base+suffix still fits in 15 chars.
--
--    One deliberate divergence: the client compared candidates against a
--    lowercased set while checking the bare base case-sensitively. Here every
--    comparison is case-sensitive, matching the actual DB constraint — so this
--    can no longer skip a suffix that was in fact available.
create or replace function public.suggest_display_name(p_base text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  max_len constant integer := 15; -- keep in sync with MAX_DISPLAY_NAME_LENGTH
  base text;
  suffix text;
  candidate text;
  counter integer := 1;
begin
  if p_base is null or p_base = '' then
    base := 'Player';
  else
    base := left(p_base, max_len);
  end if;

  if not exists (select 1 from public.player_profiles where display_name = base) then
    return base;
  end if;

  -- Bounded rather than `while true`: a runaway loop inside a security-definer
  -- function is a denial-of-service vector, and 9999 collisions on one base
  -- name is far past anything legitimate.
  while counter < 10000 loop
    suffix := counter::text;
    candidate := left(base, max_len - length(suffix)) || suffix;

    if not exists (select 1 from public.player_profiles where display_name = candidate) then
      return candidate;
    end if;

    counter := counter + 1;
  end loop;

  -- Exhausted: fall back to a random suffix rather than erroring, mirroring
  -- the client's own error fallback.
  return left(base, max_len - 4) || floor(random() * 9000 + 1000)::text;
end;
$$;

comment on function public.suggest_display_name(text) is
  'Returns p_base truncated to 15 chars if free, else the first free base+N variant. Security definer so clients never need to read other players'' display names to find one. Port of suggestUniqueDisplayName() in src/supabase/players-repository.ts.';

grant execute on function public.suggest_display_name(text) to anon, authenticated;

-- 3. Duel lobby view. Replaces listWaitingMatches()'s `select * from
--    duel_matches` + follow-up player_profiles lookup.
--
--    Two things this fixes beyond the RLS lockdown:
--      * secret_word is NOT selected. The old client query pulled `*` from
--        every waiting match, which means any player could read the secret
--        word of a duel they hadn't joined — a straightforward cheat, quite
--        apart from the privacy question.
--      * player2_id is not exposed either; a waiting match has none by
--        definition, and the client only ever rendered p1_name.
--
--    security_invoker = false (owner rights) is explicit so the view keeps
--    working once duel_matches and player_profiles are locked to own-row in
--    20260822. Pinning it also means a future change to Postgres/Supabase
--    defaults can't silently flip the behaviour.
create or replace view public.duel_lobby
with (security_invoker = false) as
  select
    dm.id,
    dm.created_at,
    dm.player1_id,
    dm.status,
    dm.language,
    dm.is_hint_enabled,
    p1.display_name as p1_name
  from public.duel_matches dm
  join public.player_profiles p1 on p1.id = dm.player1_id
  where dm.status = 'waiting'
    and dm.created_at > now() - interval '5 minutes';

comment on view public.duel_lobby is
  'Open duel invitations from the last 5 minutes, with player 1''s display name. Deliberately omits secret_word (readable by non-participants through the old raw-table query) and player2_id. Owner rights, so it survives the own-row RLS lockdown in 20260822.';

-- authenticated only: duelling requires a session, and there is no
-- visitor-facing lobby surface.
grant select on public.duel_lobby to authenticated;

-- 4. Opponent names for an active duel. Replaces useDuelMode.ts's
--    `player_profiles select id, display_name .in(ids)`.
--
--    The participant guard is the point: without it this would just be the
--    old open read with extra steps.
create or replace function public.match_player_names(p_match_id uuid)
returns table (id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.duel_matches m
    where m.id = p_match_id
      and (m.player1_id = auth.uid() or m.player2_id = auth.uid())
  ) then
    raise exception 'Not a participant in this match';
  end if;

  return query
    select p.id, p.display_name
    from public.player_profiles p
    join public.duel_matches m on p.id in (m.player1_id, m.player2_id)
    where m.id = p_match_id;
end;
$$;

comment on function public.match_player_names(uuid) is
  'Display names of both players in a duel, callable only by a participant of that duel. Security definer so it survives the own-row player_profiles lockdown in 20260822.';

grant execute on function public.match_player_names(uuid) to authenticated;
