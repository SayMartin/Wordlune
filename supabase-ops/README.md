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

`20260819_warn_and_cleanup_inactive_registered_users.sql` does the equivalent for **registered** (non-anonymous) accounts, split by email verification. Email-verified accounts get a warning first: a daily `pg_cron` job emails any player inactive 6+ months (via `pg_net` → the Resend API, no Edge Function involved), then a second daily job deletes anyone who's still inactive 14 days after that warning (auto-cancelled if they sign back in). Accounts that never confirmed their email get no warning — a third daily job deletes them 14 days after signup, since an unconfirmed signup has nothing to lose access to. Requires `pg_net` enabled alongside `pg_cron`, plus the existing "wordse-mail" Resend API key (Resend dashboard, `appfinningar.se` domain already verified there) stored in Supabase Vault as the `resend_api_key` secret (`select vault.create_secret(...)` — see the migration's step 2 comment). **Applied against the shared project on 2026-08-19/20**, with the Vault secret set 2026-08-19 08:04 UTC. Verified 2026-08-25: all four `cron.job` rows active (this migration's three plus `cleanup-anonymous-users`), and the first warning run at 2026-08-20 02:00 UTC produced five `net._http_response` rows with `status_code = 200`, so Resend accepted them.

Note that `net.http_post` is **asynchronous**: it queues the request and returns, so the function marks `deletion_warned_at` whether or not the mail is ever delivered, and the deletion job 14 days later only checks that mark. A revoked API key would therefore delete accounts that were never warned. After any change to the Resend key, check `net._http_response` for non-200 rows and clear `deletion_warned_at` before the grace period expires.

`20260819_master_seed_with_french.sql` **supersedes `20260127_master_seed.sql`** for promoting `staging_import_rows` into `words`/`categories`/`subcategories` — the older one predates French support and silently left `word_fr`/`category_name_fr`/`subcategory_name_fr` unset on every row it touched. Same staging → upsert flow, just with `_fr` handled at every step alongside `_en`/`_sv`. Needs `staging_import_rows` to actually have the `word_fr`/`category_name_fr`/`subcategory_name_fr` columns first (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, see the comment at the top of the migration) since that table predates the French migration too. Use this one going forward; keep the old file only for history.

`20260820_fix_english_diacritics_oland_skanor.sql` patches 31 rows (30 in the "Villages on Öland" subcategory, plus "Skanör" in "Cities in Sweden") whose `word_en` was never transliterated to ASCII when English support was added — it was left identical to `word_sv`/`word_fr`, diacritics and all. Not just cosmetic: with English selected, the on-screen keyboard has no Å/Ä/Ö keys and the physical-keyboard input regex only matches `[A-Za-z]`, so a player who drew one of these as their secret could never type the required letter — an unsolvable round. `migrations/seeds/villages-öland.csv` and `migrations/seeds/cities-sweden.csv` are already fixed for future reseeding; this migration patches the same rows directly in the live `words` table. **Not yet applied against the shared project** as of 2026-08-20 — this was a scoped fix for the two files audited so far, not a full pass over every category/language (word_native itself is non-ASCII for "Skanör" too — `skanör`, not `skanor` — left as-is since it's not the display column and out of scope here).

`20260825_fix_unspellable_words.sql` is the full audit `20260820` deliberately wasn't. `20260820` fixed 31 rows in two seed files; this checks *every* word column against the characters its language can actually produce (`Keyboard.tsx`'s `LAYOUTS` and `GameScreen.tsx`'s `LETTER_PATTERNS` — letters plus space and hyphen, nothing else) and fixes the 22 rows that fail. Diacritics turned out to be only one of four causes: apostrophes (`NUKU'ALOFA`, `ST GEORGE'S`, `ST JOHN'S`), an ampersand (`RIESE & MÜLLER`), and parentheses that were disambiguation metadata leaking into the answer (`BLASINGE (BORGHOLM)`, `ROYAL ENFIELD (APACHE)`) are the others. Where correct spelling and typeability conflict — `MOÇAMBIQUE`, `MÜSLI` — typeability wins, on the same reasoning `word_en` already applies to Swedish place names. Also repairs `CÔTE DEIVOIRE`, where "d'Ivoire" had its apostrophe replaced by an `E`.

**Don't trust this paragraph for apply status — run the check.** The verification query is at the bottom of the migration itself and returns zero rows when it has been applied:

```sql
select 'en' as lang, word_en as word from words where word_en !~ '^[A-Za-z \-]+$'
union all select 'sv', word_sv from words where word_sv !~ '^[A-Za-zÅÄÖåäö \-]+$'
union all select 'fr', word_fr from words
  where word_fr !~ '^[A-Za-zÀÂÄÅÇÉÈÊËÎÏÔÖÙÛÜŸÆŒàâäåçéèêëîïôöùûüÿæœ \-]+$';
```

`migrations/seeds/*.csv` were fixed to match, plus seven more the database doesn't have (`Škoda`, `Citroën`, `Cervélo`, `Motobécane`, `Sana'a`, `Søndreström`, and `\N'Djamena` — the last being PostgreSQL's `\N` NULL marker pasted into the data). A stray space in the `ri se_muller` row id was corrected to `riese_muller` at the same time.

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
### The "hydrocarbons" word set

`migrations/seeds/hydrocarbons/` is an organic-chemistry pun, not a chemistry
category: the subcategories are Animals, Body, Fruits, Groceries, Kitchen,
Plants and Vegetables. It matters more than the other categories
because **Duel mode draws its entire word pool from it** (five-letter words
only, via `listHydrocarbonFiveLetterWords`), and because the candidate pool
doubles as the list of accepted guesses — `useGame.ts` rejects any guess that
isn't in the pool, so a thin category doesn't just mean fewer answers, it means
obvious words get refused mid-game.

Expanded 2026-08-25 from 179 rows to 357 (five-letter: 142 en / 120 sv / 94 fr,
36 of them five letters in all three languages — which is the ceiling on what
`generate_challenge.mjs` can pick from, since it requires all three). Body and
Kitchen are new subcategories from that pass; the five existing ones were
roughly doubled. The same pass corrected five `word_fr` values in
`vegetables.csv` that had been copied straight from `word_en` where French
actually differs (TOMATE, CITROUILLE, OIGNON, RACINES, GRAINES) — the other 27
identical en/fr pairs in the set are genuinely the same word and were left
alone.

Two subcategories were retired at the same time
(`20260825_remove_bicycle_brands_and_at_sea.sql`): **Bicycle Brands** and **At
sea**, both under Vehicles, both brand-name lists. Proper nouns make poor word
game content — nobody can reason their way to "Sunseeker", and the words are
identical in all three languages, so the category hint tells a player nothing.
Car Brands and Motorcycle Brands were kept, so the Vehicles category still
exists.

That migration deletes the subcategories and their join rows but **keeps the
`words` rows**, which is not the obvious design and was arrived at by rehearsing
the first draft against a local `supabase start` stack. Deleting the words would
have broken eight competitive_challenges from January that address them by id
through a UUID[] with no foreign key behind it, and would have removed BULLS,
FERRY, REGAL and SURLY — ordinary English words that merely happen to also be
brands — from the accepted-guess list. Keeping them costs nothing: the
subcategory is gone from the picker, the old challenges still resolve, the words
stay guessable, and since `answer_eligible_words` requires at least one eligible
subcategory, a word with none can never be drawn as a secret either.

`20260825_answer_eligible_subcategories.sql` adds `subcategories.is_answer_eligible`
and the `answer_eligible_words` view. It exists because Duel's secret is now
drawn from the whole dictionary rather than one category, which is what lets
guess validation be switched on at all — but also means a proper-noun list could
supply the word to guess. "Cities in Sweden" and "Villages on Öland" are flagged
ineligible: unguessable to anyone not local, and identical across all three
languages, so the language played in tells you nothing. Their words remain valid
guesses and remain playable in practice mode. Set the flag rather than deleting
rows when a category is fine to type but unfair to have to solve.

When adding words, run the check at the foot of `20260825_fix_french_dieresis.sql`
rather than the older one — the character sets there are the ones the *on-screen*
keyboards actually offer, which is stricter than `GameScreen.tsx`'s
`LETTER_PATTERNS` and is what a player is really limited to.

- **`migration_state.sql`** — read-only. Answers "what is actually applied?" by
  measuring the data rather than trusting the prose in this file, which has been
  wrong about it three times running. There is no migration-tracking table, so
  this is the closest thing; it is also correct after a restore from backup,
  which a tracking table would not necessarily be. Paste it into the Supabase
  SQL editor.

- **`upload_seeds_to_staging.js`** — reads CSVs from `migrations/seeds/hydrocarbons`, clears and repopulates the `staging_import_rows` table. Needs `SUPABASE_URL` (or `VITE_SUPABASE_URL`) and `SUPABASE_SERVICE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` env vars — the service role key, not the anon key, since it bypasses RLS. Unlike `generate_challenge.mjs`, this script does **not** load `.env` itself (no dotenv, no manual parser) — it only reads `process.env`, so a `.env` file sitting in the folder is silently ignored unless you explicitly load it. Run it with Node's built-in env-file flag (Node ≥ 20.6):
  ```sh
  cd supabase-ops
  node --env-file=.env scripts/upload_seeds_to_staging.js
  ```
- **`update_capitals_sv.py`** — one-off script that patches Swedish spellings into `migrations/seeds/capital-cities.csv` (or `migrations/capital-cities.csv`, depending on which file exists at run time).
- **`console_utils.ts`** — not a runnable script; just documents the `jq -S` one-liners used to keep `src/locales/*/translation.json` sorted (a WordluneNative repo path, if reused).
- **`backup.sh`** — nightly encrypted database backup to Cloudflare R2. Runs on the server from cron, not from a laptop, and reads its own `backup.env` rather than the `.env` the other scripts use. See [Backups](#backups) below.

None of these are wired into `package.json` — run them directly from this directory, with a `.env` here providing the service-role credentials (see `upload_seeds_to_staging.js` above for the one gotcha: it needs `--env-file=.env` explicitly, the others load `.env` on their own).

## Backups

`scripts/backup.sh` takes a nightly `pg_dump`, encrypts it with `age`, and uploads it to the `wordlune-backups` R2 bucket. It is adapted from cv-forge's `scripts/backup.sh` and keeps that design deliberately, including its **public-key** encryption: the server holds only the age *public* key, so it can create backups but never read them back. The private key belongs in a password manager, not on the server — putting it there gives up the entire property this design exists for.

Setup, once, on the server.

Note that smurfserver has **no checkout of this repo** — unlike cv-forge, whose `~/cv-forge` is both a git working copy and the compose directory, `~/wordlune/` holds only `docker-compose.yml` (itself untracked). The server pulls a finished image from GHCR and never needs the source. So the script has to be copied over rather than pulled; the repo is private, so `git clone` on the server would need GitHub credentials for the sake of two files.

From the laptop:

```sh
ssh martin@192.168.50.131 'mkdir -p ~/wordlune/scripts ~/backups/wordlune'
scp supabase-ops/scripts/backup.sh supabase-ops/scripts/backup.env.example \
    martin@192.168.50.131:~/wordlune/scripts/
```

Then on the server:

```sh
sudo apt install age                       # the script's only host dependency
age-keygen -o wordlune-backup.key          # run this somewhere ELSE, not the server
cd ~/wordlune/scripts
cp backup.env.example backup.env
chmod 600 backup.env                       # it holds the database password
$EDITOR backup.env                         # public recipient line + Supabase + R2 creds
./backup.sh                                # test run: should end with "backup: done"
crontab -e
```
```
30 3 * * * /home/martin/wordlune/scripts/backup.sh >> /home/martin/backups/wordlune-backup.log 2>&1
```

Re-copy `backup.sh` whenever it changes here — nothing on the server pulls it automatically.

03:30 sits between cv-forge's 03:15 backup and its 03:45 purge so the jobs never overlap.

Two Supabase-specific traps, both spelled out in `backup.env.example`: connect to the **session pooler on port 5432** (the transaction pooler on 6543 has no prepared statements and `pg_dump` fails against it, and the direct `db.<ref>.supabase.co` host is IPv6-only), and give the R2 endpoint its **jurisdictional `.eu.` form** (an EU bucket is invisible on the plain address and fails as if it did not exist).

The dump covers `public` **and `auth`**. Without the auth schema every account is gone and every foreign key in `public` points at rows that no longer exist — it would restore into a database nobody can log into.

Retention is split: the script prunes local copies to `KEEP_LOCAL` (default 7), while remote expiry is an **R2 lifecycle rule set on the bucket in the dashboard** (30 days, matching cv-forge). Server-side expiry keeps working even when the script does not.

### Restoring

```sh
age --decrypt -i wordlune-backup.key wordlune-<stamp>.dump.age > restore.dump
pg_restore -l restore.dump | head -30      # sanity check: public AND auth objects
pg_restore --no-owner --no-privileges -d "<target-database-url>" restore.dump
```

The dump keeps ownership and ACLs on purpose — `pg_restore` can drop them with `--no-owner` at restore time, but it cannot invent them if the dump never captured them. Decide at restore, not at backup.

**Prove the key before you file it away.** Generate it, take a backup, restore that backup, and only then move the key file to the password manager and delete it from disk. Encryption to a key you have never decrypted with is an assumption, not a backup — and the moment you discover it was wrong is the moment you needed it.

If the local file is already gone, you do not need to guess: write the saved key back to a file and run `age-keygen -y` on it. It prints the public key, which must equal `AGE_RECIPIENT` in `backup.env`. Same pair means every dump encrypted to it is readable.

A backup nobody has restored is a hypothesis. Restore into the local `supabase start` stack occasionally and confirm `auth.users` and `player_profiles` have the row counts you expect.

## Local development database

`supabase/config.toml` (repo root) configures a full local stack — Postgres, GoTrue, PostgREST, Realtime, Storage, Studio — so migrations can be rehearsed against a disposable database instead of prod. It runs on the laptop and **does not consume a Supabase free-tier project slot**.

```sh
supabase start          # first run pulls images; prints the local URL + anon key
supabase stop           # `--no-backup` to discard the volume entirely
supabase db reset       # rebuild from migrations + seed, from scratch
```

Put the printed URL and anon key in a root `.env.local` (gitignored) to point the app at it.

Three settings in `config.toml` are deliberately not the CLI defaults, and matter:

- **`enable_anonymous_sign_ins = true`** — "Play as Guest" is a real anonymous Supabase session and `AuthContext` derives `authState` from `session.user.is_anonymous`. Left at the default `false`, guest mode fails locally in a way that looks like an app bug.
- **`site_url` / `additional_redirect_urls`** — point at Expo's web dev server on 8081 plus the `se.wordlune.app://` scheme, so email confirmation and password reset resolve locally.
- **`minimum_password_length = 8`** — matches `SignupScreen.tsx`'s own check.

### The baseline

The 49 files in `migrations/` were applied by hand through the SQL editor, and (see [Naming convention](#naming-convention)) their dates are invented, so sorting them is *not* run order. Replaying them would not reproduce production.

So don't. `scripts/refresh-dev-baseline.sh` generates a single baseline from what production actually looks like now, plus a seed of word content, and leaves `migrations/` as the historical record:

```sh
export PROD_DB_URL='postgresql://postgres.<ref>:<pw>@<pooler-host>:5432/postgres'
./supabase-ops/scripts/refresh-dev-baseline.sh
supabase db reset
```

Session pooler on 5432, same as `backup.sh`. Run it again whenever production's schema changes; it replaces the previous baseline rather than adding to it, since two baselines would both run on `db reset` and the second would fail on existing objects.

`seed.sql` is committed, so it covers **word content only** — `words`, `categories`, `subcategories`, the two join tables and `competitive_challenges`. The script refuses to leave a seed containing `player_profiles`, `game_scores`, `challenge_*` or `duel_matches`; now that the database holds production data, that check is the difference between a seed file and a personal-data leak in a public repo.

### Four things that make this harder than it looks

Each of these was hit and fixed on 2026-08-25; the script handles all four, but they explain why it is not simply `pg_dump | psql`.

- **Dump `public` only, never `public,auth`.** The opposite of `backup.sh`, which must include `auth` or it restores a database nobody can log into. Here `supabase start` creates `auth` itself and GoTrue owns it, so replaying a dumped copy dies with `permission denied for schema auth` — the migration runs as `postgres`, which has no rights in a schema owned by `supabase_auth_admin`.
- **Strip `\restrict` / `\unrestrict`.** pg_dump 17.11+ wraps its output in those psql guards. `supabase db reset` feeds the file straight to the server rather than through psql, where a backslash command is not SQL: `syntax error at or near "\"`.
- **Repoint `search_path` from `''` to `'public'`.** pg_dump sets it empty because it qualifies everything it writes — but the INSERTs fire triggers, and `subcategories_normalize_trigger()` calls `normalize_text()` unqualified. With an empty search_path that resolves to nothing: `function normalize_text(text) does not exist`.
- **Do not recreate the `on_auth_user_created` trigger.** It is tempting, since a `public`-only dump cannot carry a trigger that lives on `auth.users`, and `20260124_create_player_profiles.sql` does create one. But adding it back breaks guest sign-in outright: `handle_new_user()` sets `display_name` from `raw_user_meta_data->>'full_name'`, which is NULL for an anonymous user, and `display_name` is NOT NULL — every anonymous sign-in then fails with a 500, `Database error creating anonymous user`. Production has 52 guest accounts, so the trigger demonstrably is not firing there; profiles are created client-side by `ensurePlayerProfile()` in `AuthContext.tsx`. Leaving it out is what makes dev match production.

Point the app at the local stack with a `.env.local` holding the URL and publishable key that `supabase start` prints (gitignored; they are the CLI's fixed local keys, identical on every machine).

**Limitation worth knowing:** `pg_cron` and `pg_net` are not in the local stack, so the scheduled cleanup jobs (`cleanup_anonymous_users`, the inactivity warnings) cannot be exercised end to end. Their SQL function bodies can be called by hand; the scheduling itself is only verifiable in prod.
