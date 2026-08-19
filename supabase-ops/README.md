# supabase-ops

Database migration history and content-seeding scripts for the shared Supabase project (`dyubgmmurveqmknvpglx`), carried over from the original `Wordse` web app repo before it was retired. Not part of the app build — WordseNative doesn't import anything from this folder.

## migrations/

Chronological SQL migration history for the project's schema (tables, views, triggers, RLS policies). Applied manually via the Supabase SQL editor or CLI — there's no automated migration runner wired up. `migrations/seeds/` holds the CSV word lists (categories like countries, capitals, car brands, hydrocarbons subcategories) used to seed the `words`/`categories`/`subcategories` tables.

`20260818_cleanup_anonymous_users.sql` schedules a daily `pg_cron` job that deletes guest (`is_anonymous = true`) `auth.users` accounts inactive for 14+ days — nothing in the app itself ever deletes guest accounts, so without this they accumulate forever. Requires the `pg_cron` extension enabled (Database → Extensions in the dashboard, or the `create extension` line in the migration if you have the privileges). Also fixes `duel_matches`' foreign keys to `ON DELETE CASCADE` (they had no cascade before, which would've blocked deleting any guest who'd played a Duel). Applied and `pg_cron` enabled in the shared project as of 2026-08-18.

`20260819_warn_and_cleanup_inactive_registered_users.sql` does the equivalent for **registered** (non-anonymous) accounts, split by email verification. Email-verified accounts get a warning first: a daily `pg_cron` job emails any player inactive 6+ months (via `pg_net` → the Resend API, no Edge Function involved), then a second daily job deletes anyone who's still inactive 14 days after that warning (auto-cancelled if they sign back in). Accounts that never confirmed their email get no warning — a third daily job deletes them 14 days after signup, since an unconfirmed signup has nothing to lose access to. Requires `pg_net` enabled alongside `pg_cron`, plus the existing "wordse-mail" Resend API key (Resend dashboard, `appfinningar.se` domain already verified there) stored in Supabase Vault as the `resend_api_key` secret (`select vault.create_secret(...)` — see the migration's step 2 comment; **not yet run against the shared project** as of 2026-08-19, needs the Vault secret set first).

## scripts/

Run from this directory (`supabase-ops/`) so the `migrations/...` relative paths inside them resolve correctly:

- **`generate_challenge.mjs`** — generates a daily/competitive challenge. Reads Supabase credentials from a local `.env` file (`SUPABASE_URL`/`VITE_SUPABASE_URL`, service role key) in this directory, or from the environment.
- **`upload_seeds_to_staging.js`** — reads CSVs from `migrations/seeds/hydrocarbons`, clears and repopulates the `staging_import_rows` table. Needs `SUPABASE_URL` (or `VITE_SUPABASE_URL`) and `SUPABASE_SERVICE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` env vars — the service role key, not the anon key, since it bypasses RLS.
- **`update_capitals_sv.py`** — one-off script that patches Swedish spellings into `migrations/seeds/capital-cities.csv` (or `migrations/capital-cities.csv`, depending on which file exists at run time).
- **`console_utils.ts`** — not a runnable script; just documents the `jq -S` one-liners used to keep `src/locales/*/translation.json` sorted (a WordseNative repo path, if reused).

Neither script is wired into `package.json` — run them directly, e.g. `node scripts/upload_seeds_to_staging.js`, with a `.env` in this folder providing the service-role credentials.
