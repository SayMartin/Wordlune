#!/usr/bin/env bash
#
# Nightly encrypted backup of the Wordlune Supabase database to Cloudflare R2.
#
# Adapted from cv-forge's scripts/backup.sh. The design is deliberately the same
# where it can be, and differs in exactly one place that matters:
#
#   * cv-forge dumps a Postgres container it owns (`docker exec <container>
#     pg_dump`). Wordlune's database is Supabase managed cloud — there is no
#     container on this host to exec into, so pg_dump runs in a throwaway
#     postgres image and connects over the network. That is the only structural
#     difference; everything else below is the cv-forge design.
#
# Carried over unchanged, and worth not undoing:
#
#   * Public-key encryption (age), not a passphrase. The server holds only the
#     *public* key, so this script can create backups but cannot read them back.
#     A compromised server therefore leaks no backup contents. The private key
#     lives somewhere else — a password manager, an offline note — and is needed
#     only when restoring. If you put the private key on the server, you have
#     given up the property this design exists for.
#
#   * A dedicated bucket and a dedicated R2 token. Scoping the token to the
#     backup bucket means this nightly job cannot touch anything else in the
#     account, and database dumps can never land in a public bucket.
#
#   * Nothing is installed on the host except `age` (apt install age). pg_dump
#     and the aws-cli both run in throwaway containers.
#
#   * Remote retention is an R2 lifecycle rule on the bucket, not this script's
#     job — expiring objects server-side survives the script failing to run.
#
# Two Supabase-specific things that are easy to get wrong:
#
#   * Connect to the SESSION pooler on port 5432, not the transaction pooler on
#     6543. Transaction mode does not support prepared statements and pg_dump
#     fails against it. The direct connection (db.<ref>.supabase.co) is IPv6-only
#     on newer projects and will not resolve from an IPv4-only home server.
#
#   * Dump `public` AND `auth`. Without the auth schema every account is gone and
#     every foreign key in public points at rows that no longer exist — the
#     backup would restore to a database nobody can log into.
#
# The dump is custom format (-Fc) and keeps ownership/ACL information. That is
# deliberate: pg_restore can drop it at restore time with --no-owner, but it
# cannot invent it if the dump never captured it. Decide at restore, not here.
#
# Usage:  ./backup.sh [path/to/backup.env]     (default: alongside this script)

set -euo pipefail

ENV_FILE="${1:-"$(dirname "$0")/backup.env"}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "backup: missing env file: $ENV_FILE" >&2
  echo "backup: copy backup.env.example and fill it in" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

for var in PG_HOST PG_USER PG_DB PG_PASSWORD S3_ENDPOINT S3_ACCESS_KEY_ID \
           S3_SECRET_ACCESS_KEY BACKUP_BUCKET AGE_RECIPIENT; do
  if [[ -z "${!var:-}" ]]; then
    echo "backup: $var is not set in $ENV_FILE" >&2
    exit 1
  fi
done

# age is the one host dependency. Failing here with a clear message beats an
# unencrypted dump sitting on disk after a cryptic "command not found".
if ! command -v age >/dev/null 2>&1; then
  echo "backup: 'age' is not installed — sudo apt install age" >&2
  exit 1
fi

PG_PORT="${PG_PORT:-5432}"
# pg_dump refuses to dump from a server newer than itself, so this must be >=
# the Supabase instance's major version. Check with: select version();
PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/wordlune}"
KEEP_LOCAL="${KEEP_LOCAL:-7}"

mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PLAIN="$BACKUP_DIR/wordlune-$STAMP.dump"
CIPHER="$PLAIN.age"

cleanup() { rm -f "$PLAIN"; }
trap cleanup EXIT

echo "backup: dumping $PG_DB from $PG_HOST:$PG_PORT"
# libpq reads the password from PGPASSWORD, but backup.env names it PG_PASSWORD,
# so it has to be re-exported under the name libpq actually looks for. Without
# this the container gets no password at all and pg_dump falls back to an
# interactive prompt it can never satisfy ("fe_sendauth: no password supplied").
export PGPASSWORD="$PG_PASSWORD"

# `-e PGPASSWORD` with no value passes it from this shell's environment rather
# than writing it into the container's argv, where `ps` on this host would show
# the database password to any local user.
#
# -w makes pg_dump fail immediately instead of prompting: this runs from cron
# with no terminal, and a prompt there would hang the job forever rather than
# erroring out.
docker run --rm -e PGPASSWORD "$PG_IMAGE" \
  pg_dump -w -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" \
          -n public -n auth -Fc > "$PLAIN"

# A pg_dump that fails mid-stream can still leave a small, well-formed-looking
# file behind. Refuse to ship anything implausibly small rather than quietly
# replacing good backups with broken ones.
SIZE=$(wc -c < "$PLAIN")
if (( SIZE < 1024 )); then
  echo "backup: dump is only ${SIZE} bytes — refusing to upload" >&2
  exit 1
fi

echo "backup: encrypting (${SIZE} bytes)"
age --recipient "$AGE_RECIPIENT" --output "$CIPHER" "$PLAIN"
rm -f "$PLAIN"
trap - EXIT

echo "backup: uploading to r2://$BACKUP_BUCKET/$(basename "$CIPHER")"
docker run --rm \
  -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION=auto \
  -v "$BACKUP_DIR:/backups:ro" \
  amazon/aws-cli \
  s3 cp "/backups/$(basename "$CIPHER")" "s3://$BACKUP_BUCKET/" \
  --endpoint-url "$S3_ENDPOINT"

# Local copies are a convenience for fast restores, not the backup itself — the
# copy that matters is the one off this machine. Keep a handful and prune.
echo "backup: pruning local copies (keeping $KEEP_LOCAL)"
find "$BACKUP_DIR" -maxdepth 1 -name 'wordlune-*.dump.age' -type f -print0 \
  | xargs -0 ls -1t 2>/dev/null \
  | tail -n "+$((KEEP_LOCAL + 1))" \
  | while read -r old; do rm -f -- "$old"; done

echo "backup: done — $(basename "$CIPHER")"
