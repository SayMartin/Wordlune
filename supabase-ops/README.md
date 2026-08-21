# supabase-ops

Database migration history and content-seeding scripts for the shared Supabase project (`dyubgmmurveqmknvpglx`), carried over from the original `Wordse` web app repo before it was retired. Not part of the app build — WordluneNative doesn't import anything from this folder.

## migrations/

Chronological SQL migration history for the project's schema (tables, views, triggers, RLS policies). Applied manually via the Supabase SQL editor or CLI — there's no automated migration runner wired up. `migrations/seeds/` holds the CSV word lists (categories like countries, capitals, car brands, hydrocarbons subcategories) used to seed the `words`/`categories`/`subcategories` tables.

### Naming convention

`YYYYMMDD_short_description.sql`, where the date is **the real date the file was written**. Several migrations may share a date; when apply order between them matters, add a sequence segment — `20260820_1_helpers.sql`, `20260820_2_lockdown.sql` — rather than advancing the date.

Do **not** use the date field as a counter. The repo contains two generations of that mistake: the whole `2026012x`–`2026020x` block was committed in one go on 2026-08-06 with invented sequential dates (hence `20260132_create_challenge_results.sql` — January 32nd, a date that does not exist), and `20260821`–`20260826` were written on 2026-08-20/21 with the later ones dated into the future to encode apply order. Both are misleading: the filename stops telling you when something happened, and a genuinely new migration can sort *before* one that was already applied. They're left as-is because renaming applied migrations would make the repo disagree with what was actually run against the database, and ~15 cross-references in code comments point at them by name.

### Ordering and verification

There is no migration-tracking table, so nothing enforces order or detects a partial apply — that's on you. Two lessons paid for the hard way:

- **A migration ordered relative to a client deploy must say so, in the file.** `20260822_gdpr_rls_lockdown.sql` had to land *after* the client changes that call the RPCs `20260821` adds; applying it early left the live app silently degraded (empty duel lobby, guest sign-ins failing) with no error anywhere.
- **`drop policy if exists` does not fail when the name is wrong — it does nothing.** Live policy names in this project have drifted from what these files record, so `20260822` reported success while leaving `player_profiles` and `duel_matches` world-readable. Drop policies by enumerating `pg_policies` instead (see `20260824_gdpr_rls_lockdown_fix.sql`), and verify from outside afterwards: the anon key is public (it ships in the web bundle), so `curl "$URL/rest/v1/<table>?select=*" -H "apikey: $ANON"` proves whether a lockdown actually took effect.

`20260818_cleanup_anonymous_users.sql` schedules a daily `pg_cron` job that deletes guest (`is_anonymous = true`) `auth.users` accounts inactive for 14+ days — nothing in the app itself ever deletes guest accounts, so without this they accumulate forever. Requires the `pg_cron` extension enabled (Database → Extensions in the dashboard, or the `create extension` line in the migration if you have the privileges). Also fixes `duel_matches`' foreign keys to `ON DELETE CASCADE` (they had no cascade before, which would've blocked deleting any guest who'd played a Duel). Applied and `pg_cron` enabled in the shared project as of 2026-08-18.

`20260819_warn_and_cleanup_inactive_registered_users.sql` does the equivalent for **registered** (non-anonymous) accounts, split by email verification. Email-verified accounts get a warning first: a daily `pg_cron` job emails any player inactive 6+ months (via `pg_net` → the Resend API, no Edge Function involved), then a second daily job deletes anyone who's still inactive 14 days after that warning (auto-cancelled if they sign back in). Accounts that never confirmed their email get no warning — a third daily job deletes them 14 days after signup, since an unconfirmed signup has nothing to lose access to. Requires `pg_net` enabled alongside `pg_cron`, plus the existing "wordse-mail" Resend API key (Resend dashboard, `appfinningar.se` domain already verified there) stored in Supabase Vault as the `resend_api_key` secret (`select vault.create_secret(...)` — see the migration's step 2 comment; **not yet run against the shared project** as of 2026-08-19, needs the Vault secret set first).

`20260819_master_seed_with_french.sql` **supersedes `20260127_master_seed.sql`** for promoting `staging_import_rows` into `words`/`categories`/`subcategories` — the older one predates French support and silently left `word_fr`/`category_name_fr`/`subcategory_name_fr` unset on every row it touched. Same staging → upsert flow, just with `_fr` handled at every step alongside `_en`/`_sv`. Needs `staging_import_rows` to actually have the `word_fr`/`category_name_fr`/`subcategory_name_fr` columns first (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, see the comment at the top of the migration) since that table predates the French migration too. Use this one going forward; keep the old file only for history.

`20260820_fix_english_diacritics_oland_skanor.sql` patches 31 rows (30 in the "Villages on Öland" subcategory, plus "Skanör" in "Cities in Sweden") whose `word_en` was never transliterated to ASCII when English support was added — it was left identical to `word_sv`/`word_fr`, diacritics and all. Not just cosmetic: with English selected, the on-screen keyboard has no Å/Ä/Ö keys and the physical-keyboard input regex only matches `[A-Za-z]`, so a player who drew one of these as their secret could never type the required letter — an unsolvable round. `migrations/seeds/villages-öland.csv` and `migrations/seeds/cities-sweden.csv` are already fixed for future reseeding; this migration patches the same rows directly in the live `words` table. **Not yet applied against the shared project** as of 2026-08-20 — this was a scoped fix for the two files audited so far, not a full pass over every category/language (word_native itself is non-ASCII for "Skanör" too — `skanör`, not `skanor` — left as-is since it's not the display column and out of scope here).

`20260821`–`20260826` are one body of work: the GDPR/privacy lockdown. **All applied against the shared project as of 2026-08-21**, and verified from outside with the public anon key (23/23 checks — own-row isolation, the duel flow end to end, and the data-export queries).

- **`20260821_gdpr_privacy_helpers.sql`** — additive only. Adds `display_name_available()` / `suggest_display_name()` (so signup name checks don't need to read other players' rows), the `duel_lobby` view (open invitations *without* `secret_word`, which non-participants could previously read straight off the table — a cheat vector as much as a privacy one), and `match_player_names()` (participants only).
- **`20260822_gdpr_rls_lockdown.sql`** — locks every personal-data table to own-row, gates `duel_leaderboard` on `is_public`, makes `player_history_view` `security_invoker` + `auth.uid()`-filtered, and drops the dead `board_events`/`board_state`/`matches`/`boards`/`player_settings` tables. **Partially no-opped on apply** — see `20260824`.
- **`20260823_drop_dicebear_avatars.sql`** — nulls `avatar_url` for the old `api.dicebear.com` URLs. Avatars are now generated locally (`src/components/Avatar.tsx`), so nothing is fetched from a third party and no display names or viewer IPs leave the device.
- **`20260824_gdpr_rls_lockdown_fix.sql`** — completes `20260822`. Drops policies by enumerating `pg_policies` rather than by name, because the name-based drops silently matched nothing and left two tables world-readable.
- **`20260825_join_duel_match_rpc.sql`** — joining a duel needs a `security definer` RPC: Postgres applies SELECT policies when *finding* the row to update, against the OLD row, where the joiner isn't a participant yet, so the plain update returned 200 with an empty body. Also makes the claim atomic (two simultaneous joins no longer overwrite each other) and blocks joining your own invitation.
- **`20260826_record_challenge_progress.sql`** — replaces a client-side read-modify-write on `challenge_attempts` that lost points when two clients reported at once (two browser tabs were enough; it never needed two devices). Increments atomically and makes `progress_index` monotonic.

## scripts/

Run from this directory (`supabase-ops/`) so the `migrations/...` relative paths inside them resolve correctly:

- **`generate_challenge.mjs`** — generates a daily/competitive challenge. Reads Supabase credentials from a local `.env` file (`SUPABASE_URL`/`VITE_SUPABASE_URL`, service role key) in this directory, or from the environment.
- **`upload_seeds_to_staging.js`** — reads CSVs from `migrations/seeds/hydrocarbons`, clears and repopulates the `staging_import_rows` table. Needs `SUPABASE_URL` (or `VITE_SUPABASE_URL`) and `SUPABASE_SERVICE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` env vars — the service role key, not the anon key, since it bypasses RLS. Unlike `generate_challenge.mjs`, this script does **not** load `.env` itself (no dotenv, no manual parser) — it only reads `process.env`, so a `.env` file sitting in the folder is silently ignored unless you explicitly load it. Run it with Node's built-in env-file flag (Node ≥ 20.6):
  ```sh
  cd supabase-ops
  node --env-file=.env scripts/upload_seeds_to_staging.js
  ```
- **`update_capitals_sv.py`** — one-off script that patches Swedish spellings into `migrations/seeds/capital-cities.csv` (or `migrations/capital-cities.csv`, depending on which file exists at run time).
- **`console_utils.ts`** — not a runnable script; just documents the `jq -S` one-liners used to keep `src/locales/*/translation.json` sorted (a WordluneNative repo path, if reused).

Neither script is wired into `package.json` — run them directly from this directory, with a `.env` here providing the service-role credentials (see `upload_seeds_to_staging.js` above for the one gotcha: it needs `--env-file=.env` explicitly, the others load `.env` on their own).
