# supabase-ops

Database migration history and content-seeding scripts for the shared Supabase project (`dyubgmmurveqmknvpglx`), carried over from the original `Wordse` web app repo before it was retired. Not part of the app build — WordseNative doesn't import anything from this folder.

## migrations/

Chronological SQL migration history for the project's schema (tables, views, triggers, RLS policies). Applied manually via the Supabase SQL editor or CLI — there's no automated migration runner wired up. `migrations/seeds/` holds the CSV word lists (categories like countries, capitals, car brands, hydrocarbons subcategories) used to seed the `words`/`categories`/`subcategories` tables.

## scripts/

Run from this directory (`supabase-ops/`) so the `migrations/...` relative paths inside them resolve correctly:

- **`generate_challenge.mjs`** — generates a daily/competitive challenge. Reads Supabase credentials from a local `.env` file (`SUPABASE_URL`/`VITE_SUPABASE_URL`, service role key) in this directory, or from the environment.
- **`upload_seeds_to_staging.js`** — reads CSVs from `migrations/seeds/hydrocarbons`, clears and repopulates the `staging_import_rows` table. Needs `SUPABASE_URL` (or `VITE_SUPABASE_URL`) and `SUPABASE_SERVICE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` env vars — the service role key, not the anon key, since it bypasses RLS.
- **`update_capitals_sv.py`** — one-off script that patches Swedish spellings into `migrations/seeds/capital-cities.csv` (or `migrations/capital-cities.csv`, depending on which file exists at run time).
- **`console_utils.ts`** — not a runnable script; just documents the `jq -S` one-liners used to keep `src/locales/*/translation.json` sorted (a WordseNative repo path, if reused).

Neither script is wired into `package.json` — run them directly, e.g. `node scripts/upload_seeds_to_staging.js`, with a `.env` in this folder providing the service-role credentials.
