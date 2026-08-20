-- Phase 6 of the GDPR work: stop leaking display names and viewer IPs to a
-- third party for a decorative image.
--
-- player_profiles.avatar_url used to hold
--   https://api.dicebear.com/7.x/avataaars/svg?seed=<display_name>
-- which every client fetched on every profile, leaderboard and duel-card
-- render. That sent (a) another player's display name, in the URL, and (b) the
-- *viewer's* IP address and User-Agent to api.dicebear.com — an outbound
-- transfer to a processor with no DPA, for something purely cosmetic. It was
-- also an availability dependency on a free third-party API for core UI.
--
-- Avatars are now generated locally by src/components/Avatar.tsx using
-- react-native-svg, deterministically from a seed, so nothing is fetched and
-- nothing leaves the device. New rows store a `wordlune:avatar:<seed>` token
-- instead of a URL; a NULL avatar_url makes Avatar derive the seed from the
-- display name, which is the right result for every existing row.
--
-- Avatar.tsx still renders any leftover http(s) URL as a remote image rather
-- than breaking, because a native client on an older bundle can still write
-- one until everyone has updated. Once that's no longer possible, that branch
-- can go.

update public.player_profiles
set avatar_url = null,
    updated_at = now()
where avatar_url like 'https://api.dicebear.com/%';

-- Sanity check — expect 0 rows after the update above:
--   select count(*) from public.player_profiles
--   where avatar_url like '%dicebear%';
