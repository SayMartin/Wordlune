#!/usr/bin/env bash
#
# Regenerates the local dev database's baseline schema and word seed from
# production. Run it once to set the dev stack up, and again whenever the
# production schema changes.
#
# Why a generated baseline instead of replaying migrations/: those 49 files were
# applied by hand through the SQL editor, and their filename dates are invented
# (see supabase-ops/README.md) — sorting them is NOT run order, so replaying them
# would not reproduce production. The baseline is what production actually looks
# like right now, which is the only description that can't be wrong.
#
# The seed deliberately covers ONLY word content. supabase/seed.sql is committed
# to git, and player_profiles / game_scores / challenge_* / duel_matches are
# personal data that must never land in the repo. Adding a table here without
# checking what is in it is how that accident happens.
#
# Usage:
#   export PROD_DB_URL='postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres'
#   ./supabase-ops/scripts/refresh-dev-baseline.sh
#
# Use the SESSION pooler on port 5432, same as backup.sh — the transaction
# pooler on 6543 has no prepared statements and pg_dump fails against it.

set -euo pipefail

if [[ -z "${PROD_DB_URL:-}" ]]; then
  echo "refresh-dev-baseline: PROD_DB_URL is not set" >&2
  echo "  export PROD_DB_URL='postgresql://postgres.<ref>:<pw>@<host>:5432/postgres'" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"

# Content tables only — everything else in `public` is per-player data.
CONTENT_TABLES=(
  public.words
  public.categories
  public.subcategories
  public.words_categories
  public.words_subcategories
  public.competitive_challenges
)

mkdir -p supabase/migrations

echo "==> baseline schema (public only)"
# `public` only, deliberately — NOT public,auth like backup.sh dumps.
#
# The two have opposite requirements. A backup must carry `auth` or it restores
# a database nobody can log into. A dev baseline must NOT: `supabase start`
# creates `auth` itself and GoTrue owns it, so replaying a dumped copy fails
# with "permission denied for schema auth" — the migration runs as `postgres`,
# which has no rights inside a schema owned by supabase_auth_admin.
#
# RLS policies on public tables still work locally: they reference auth.uid()
# and the `authenticated` role, both of which the local stack provides.
#
# Replace any previous baseline rather than accumulating them; two baselines
# would both run on `db reset` and the second would fail on existing objects.
rm -f supabase/migrations/*_baseline.sql
BASELINE="supabase/migrations/$(date -u +%Y%m%d%H%M%S)_baseline.sql"
supabase db dump --db-url "$PROD_DB_URL" --schema public -f "$BASELINE"

# NOTE: do NOT recreate the on_auth_user_created trigger here.
#
# 20260124_create_player_profiles.sql adds it, and it is tempting to restore it
# since --schema public cannot carry a trigger that lives on auth.users. But
# production does not have it working: handle_new_user() sets display_name from
# raw_user_meta_data->>'full_name', which is NULL for an anonymous user, and
# display_name is NOT NULL. With the trigger active every guest sign-in fails
# with "Database error creating anonymous user" (500) — verified locally on
# 2026-08-25 by adding it back.
#
# Production has 52 guest accounts, so the trigger is plainly not firing there.
# Profiles are created client-side instead, by ensurePlayerProfile() in
# AuthContext.tsx. Leaving it out is what makes dev match production.

echo "    $BASELINE ($(wc -l < "$BASELINE") lines)"

echo "==> word seed (content tables only)"
# Split the password out of the URL so it travels in the environment instead of
# the container's argv, where `ps` would show it to any local user. (The
# `supabase db dump` call above can't do this — it only takes a full --db-url —
# but that one runs on the host for a few seconds, not in a shared container.)
#
# The password is percent-encoded inside a URL but PGPASSWORD must be the raw
# value, so it has to be decoded — a password containing å, @ or / authenticates
# fine through --db-url and fails here otherwise, which looks like a wrong
# password rather than an encoding bug.
if ! command -v python3 >/dev/null 2>&1; then
  echo "refresh-dev-baseline: python3 is needed to decode the password in PROD_DB_URL" >&2
  exit 1
fi
PG_PASSWORD_PART="$(python3 -c '
import os, sys, urllib.parse as u
p = u.urlsplit(os.environ["PROD_DB_URL"]).password
if not p:
    sys.exit("no password in PROD_DB_URL")
print(u.unquote(p))
')"
URL_NO_PW="$(printf '%s' "$PROD_DB_URL" | sed -E 's|^([^:]+://[^:]+):[^@]+@|\1@|')"
export PGPASSWORD="$PG_PASSWORD_PART"

TABLE_ARGS=()
for t in "${CONTENT_TABLES[@]}"; do TABLE_ARGS+=(-t "$t"); done
docker run --rm -e PGPASSWORD "$PG_IMAGE" \
  pg_dump -w --data-only --no-owner --no-privileges --column-inserts \
          "${TABLE_ARGS[@]}" "$URL_NO_PW" \
  | grep -vE '^\\(restrict|unrestrict) ' \
  | sed "s|^SELECT pg_catalog.set_config('search_path', '', false);|SELECT pg_catalog.set_config('search_path', 'public', false);|" \
  > supabase/seed.sql

# Two things pg_dump emits that have to be adjusted for `supabase db reset`:
#
#   * search_path is set to '' because pg_dump schema-qualifies everything it
#     writes. But the INSERTs fire triggers, and subcategories_normalize_trigger()
#     calls normalize_text() unqualified — with an empty search_path that
#     resolves to nothing and seeding dies with "function normalize_text(text)
#     does not exist". Pointing search_path at public fixes it without touching
#     production. (The underlying fragility is real but lives in prod's function
#     definitions, which lack SET search_path; not this script's problem.)

# pg_dump 17.11+ wraps its output in psql's \restrict / \unrestrict guards.
# `supabase db reset` feeds seed.sql straight to the server rather than through
# psql, where a backslash command is not SQL at all — it fails with
# `syntax error at or near "\"`. Stripping the two guard lines is safe: they
# only protect an interactive psql session from a hostile dump changing its
# settings, which is not what is happening here.
echo "    supabase/seed.sql ($(wc -l < supabase/seed.sql) lines)"

echo "==> checking the seed for personal data"
LEAKED=$(grep -oiE 'INSERT INTO (public\.)?(player_profiles|game_scores|challenge_attempts|challenge_results|duel_matches)' \
           supabase/seed.sql | sort -u || true)
if [[ -n "$LEAKED" ]]; then
  echo "refresh-dev-baseline: personal data in seed.sql — refusing to leave it:" >&2
  echo "$LEAKED" >&2
  rm -f supabase/seed.sql
  exit 1
fi
echo "    clean"

echo
echo "Done. Next:"
echo "  supabase db reset     # rebuild local db from baseline + seed"
