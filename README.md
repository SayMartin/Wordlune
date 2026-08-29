# Wordlune

A word-guessing game where the puzzle is what you know, not how many words you know.

Every hidden word is drawn from a category — African capitals, groceries, car brands, body parts — and the player is told which one. The letters narrow the field; general knowledge closes it. Knowing the answer is a five-letter African capital is knowledge doing the work. Knowing only that it is five letters is letter frequency and luck, which is the same game whoever plays it.

Three languages (English, Swedish, French), three modes, one codebase, running on iOS, Android and the web.

**Live at [wordlune.appfinningar.se](https://wordlune.appfinningar.se)** — self-hosted.

---

## Tech stack

| Layer | Choice |
|---|---|
| App | Expo / React Native (bare workflow), TypeScript |
| Web | react-native-web — the same source renders a responsive desktop site, not a phone frame |
| Navigation | React Navigation — bottom tabs on device, a top nav bar on web, shared route tree |
| Backend | Supabase: Postgres, Row Level Security, Realtime, Auth, `pg_cron` |
| i18n | i18next, three complete locales |
| Graphics | react-native-svg — gradients, avatars and logo drawn at runtime, no image assets fetched |
| Delivery | Docker multi-stage → nginx → GitHub Actions → GHCR → Watchtower → Cloudflare Tunnel |
| Quality | TypeScript, ESLint, Jest |

## How it plays

- **Practice** — choose the subjects you want to be tested on and a word length range. Private: nothing is ranked or published.
- **Competitive** — five words a week from a rotating schedule. The theme is *not* shown in the menu, because a menu is read before the clock starts. It arrives as a per-word hint once the round is running.
- **Duel** — real-time 1v1 on the same secret word. Both players get the same category, and three clocks run: a per-player inactivity limit, and a match-wide silence timer.

Scoring is one shared module: guess points minus ten per attempt after the first, plus a speed bonus whose allowance scales per letter, so a long word is not punished for taking longer. The arithmetic is rendered to the player from that same module, in the result overlay, in a modal on the progress screen and as a section on the About page — so the explanation cannot drift from what was actually computed.

---

## Engineering notes

The parts worth a look, and why they are the way they are.

### Visibility rules live in Postgres, not in the client

Every personal-data table is own-row-only under RLS. Anything that legitimately shows *other* players — leaderboards, open duel invitations, an opponent's display name — goes through an owner-rights view or a `security definer` RPC that applies its own gate.

That discipline came from being wrong about it. An earlier design put the `is_public` opt-in only in the views, which meant it protected nothing against a direct PostgREST query with the anonymous key that ships in the web bundle. Two tables were found still world-readable *after* a lockdown that was believed complete — because Postgres OR's permissive policies together, so a single surviving `USING (true)` silently defeats a correct own-row policy sitting next to it. Policies are now dropped by enumerating `pg_policies` rather than by name, and the repo carries a read-only query that infers each migration's state from the data instead of from a record of what someone believes they ran.

### Content is scheduled ahead and unreadable until it opens

The competitive schedule is generated about six months in advance. A queued challenge is an answer key, so RLS hides any challenge whose start date has not passed — from the anonymous key, from authenticated users, from everyone but the service role. Verified from outside with a real HTTP request, because the SQL console runs as owner and bypasses RLS, and therefore cannot see this class of bug.

### The duel is adjudicated by the database

Realtime play runs over a Supabase channel with presence tracking. But the *verdict* never does: both clients report progress, both may ask the server to resolve a timeout, and a row-locked idempotent function decides once. Two clients cannot reach different answers about who won, and a `pg_cron` sweeper closes matches both players walked away from — a client timer cannot fire when no client is running.

The timeout tiebreak is proximity — most correct letters in a single guess — and deliberately not the score, which sums every letter of every guess and so measures how *much* someone has guessed rather than how close they are. Under a timeout rule, ranking by score would make stalling a winning strategy.

### Every word must be typeable in its own language

Content is stored per language, and a word is only valid if the on-screen keyboard for that language can actually produce it. This is a stricter constraint than it sounds: an apostrophe, an ampersand, a parenthesis left over from disambiguation, or a diacritic the layout lacks all make a round unwinnable, because there is no key to press. An audit against the *physical* keyboard filter passed words the *on-screen* keyboard could not type, which is exactly the kind of near-miss that ships. Where correct spelling and typeability conflict, typeability wins: a word nobody can enter is worth nothing however correctly it is spelled.

### Theming is drawn, not fetched

Light and dark palettes, a fixed radial-gradient backdrop, and translucent "glass" surfaces. Web gets real CSS injected for the effects React Native has no expression for (multiple radial gradients on one element, fixed attachment, backdrop blur); native draws the same gradient with SVG rather than adding a native module and rebuilding the committed platform trees for an effect SVG already covers.

Avatars are generated locally from a seed. They used to be fetched from a third-party service, which sent another player's display name and the viewer's IP to that service on every leaderboard render — for a decorative image.

### Privacy as a feature, not a page

Self-service data export (six own-row queries plus the device's local keys, delivered as JSON), self-service account deletion through a `security definer` function, per-device versus per-account logout scoped explicitly, and scheduled cleanup of dormant guest accounts. The privacy policy is versioned in code so the stamped version and the displayed date cannot drift.

### Deployment

A multi-stage Docker build compiles the web export and serves it from nginx; pushing to the main branch builds and publishes an image, which the server picks up automatically. Cloudflare Tunnel fronts it, so the host exposes no inbound ports.

The nginx config is deliberately *not* a blanket single-page-app fallback. That answers 200 for every URL ever requested, including typos, which is a soft 404 and a poor signal to crawlers. Known client-side routes are enumerated and answer 200; everything else falls through to a real 404 that still boots the app, so the status line stays honest.

---

## About this repository

This is a portfolio repository. It is here to be **read**, not cloned and run.

There are no setup instructions, and that is deliberate. Credentials live outside the repository, the backend is a live database holding real accounts and real scores, and nothing here is intended to make standing up a copy convenient. The code, the migration history and the reasoning in the comments are the artefact.

If you are evaluating this as a work sample, the migration files under `supabase-ops/migrations/` are probably the most revealing thing in the project: each one carries the reasoning, the alternative that was rejected, and the failure it was written in response to.

Source-available, not open source: read it, quote it, judge it — see [LICENSE](LICENSE).
