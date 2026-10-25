#!/usr/bin/env bash
# The server bench/postgres/run.mjs measures against: a throwaway PostgreSQL 18
# cluster tuned as the multicore server challenge tunes its box, holding the
# challenge's --dev seed (database conduit_dev, role conduit).
#
#   bash bench/postgres/setup.sh [dir]
#
# dir is $PG_BENCH_DIR, else $TMPDIR/nish-bench-postgres (/tmp without
# TMPDIR); run.mjs reads the same. It holds:
#
#   challenge/  the challenge at COMMIT, cloned for box/pg-conf.sh and
#               seed/make-seed.sh, which run from it unchanged
#   data/       the cluster: box/pg-conf.sh --print's settings for this
#               machine's cores and memory, scram-sha-256 on 127.0.0.1 only
#   seeded      written last, once make-seed.sh's own check printed OK
#
# PG_BENCH_SEED=full also loads the full seed (database conduit_seed, about
# 2.4 GB, 5 to 10 minutes) beside the dev one, for bench/multicore/run.sh's
# load; the dev seed stays, as the challenge's conformance runs on it.
#
# What it needs, and installs when it can (as root with apt-get):
#   - PostgreSQL 18's server binaries in $PG_BIN (/usr/lib/postgresql/18/bin)
#     and libpq 17 or later with its headers (pg_config), from
#     apt.postgresql.org's own setup script;
#   - Go: make-seed.sh builds the challenge's seed generator, which wants Go
#     1.27; any Go from 1.21 fetches that toolchain itself (GOTOOLCHAIN=auto);
#   - git, to fetch the one commit.
#
# Run as root, the cluster belongs to the postgres account (its uid and gid
# from `id postgres`) and the server commands run as it, as initdb requires.
# Running it again builds everything again.
set -euo pipefail

CHALLENGE=https://github.com/arjaythedev/multicore-server-challenge
COMMIT=c3012257f2ee3dd2ccc72ada2eeba2b0d1278e8e
PG_BIN="${PG_BIN:-/usr/lib/postgresql/18/bin}"
DIR="${1:-${PG_BENCH_DIR:-${TMPDIR:-/tmp}/nish-bench-postgres}}"
SEED="${PG_BENCH_SEED:-dev}"

say() { echo "setup: $*"; }
die() { echo "setup: $*" >&2; exit 1; }

[ "$SEED" = dev ] || [ "$SEED" = full ] || die "PG_BENCH_SEED is dev or full, not $SEED"

if [ ! -x "$PG_BIN/initdb" ] || ! command -v pg_config > /dev/null; then
  if [ "$(id -u)" = 0 ] && command -v apt-get > /dev/null; then
    say "installing PostgreSQL 18 and libpq from apt.postgresql.org"
    apt-get install -y postgresql-common
    /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
    apt-get install -y postgresql-18 libpq-dev
  else
    die "no PostgreSQL 18 in $PG_BIN (set PG_BIN) or no pg_config; install postgresql-18 and libpq's headers"
  fi
fi
LIBPQ="$(pg_config --version | sed -E 's/^PostgreSQL ([0-9]+).*/\1/')"
[ "$LIBPQ" -ge 17 ] || die "libpq $LIBPQ: the C twin needs 17 or later (PQsendPipelineSync)"
command -v go > /dev/null || die "no go on PATH: make-seed.sh builds the seed generator with it"
command -v git > /dev/null || die "no git on PATH"

# Root runs the server as postgres; anyone else runs it as themselves.
AS=()
if [ "$(id -u)" = 0 ]; then
  id postgres > /dev/null 2>&1 || die "running as root needs a postgres account to own the cluster"
  AS=(runuser -u postgres --)
fi

say "the challenge at $COMMIT in $DIR/challenge"
mkdir -p "$DIR"
rm -rf "$DIR/challenge" "$DIR/data" "$DIR/sock" "$DIR/seeded"
git init -q "$DIR/challenge"
git -C "$DIR/challenge" fetch -q --depth 1 "$CHALLENGE" "$COMMIT"
git -C "$DIR/challenge" checkout -q FETCH_HEAD

say "a cluster in $DIR/data"
mkdir -p "$DIR/data" "$DIR/sock"
if [ ${#AS[@]} -gt 0 ]; then
  chown "$(id -u postgres):$(id -g postgres)" "$DIR/data" "$DIR/sock"
fi
${AS[@]+"${AS[@]}"} "$PG_BIN/initdb" -D "$DIR/data" -U postgres --auth=trust -E UTF8 --no-locale > /dev/null
{
  bash "$DIR/challenge/box/pg-conf.sh" --print
  echo "listen_addresses = '127.0.0.1'"
  echo "unix_socket_directories = '$DIR/sock'"
  echo "password_encryption = 'scram-sha-256'"
} | ${AS[@]+"${AS[@]}"} tee -a "$DIR/data/postgresql.conf" > /dev/null
printf 'local all postgres trust\nhost all all 127.0.0.1/32 scram-sha-256\n' | ${AS[@]+"${AS[@]}"} tee "$DIR/data/pg_hba.conf" > /dev/null

# The seed loads through the socket, so the setup's port is any free one.
PORT="$(node -e 'const s = require("net").createServer().listen(0, "127.0.0.1", () => { console.log(s.address().port); s.close() })')"
# The stop is armed before the start, so a start that fails half way is stopped too.
trap '${AS[@]+"${AS[@]}"} "$PG_BIN/pg_ctl" -D "$DIR/data" -m fast -w stop > /dev/null 2>&1 || true' EXIT
${AS[@]+"${AS[@]}"} "$PG_BIN/pg_ctl" -D "$DIR/data" -l "$DIR/data/setup.log" -o "-c port=$PORT" -w start > /dev/null

say "the --dev seed (make-seed.sh)"
PATH="$PG_BIN:$PATH" PGHOST="$DIR/sock" PGPORT="$PORT" PGUSER=postgres GOTOOLCHAIN=auto \
  bash "$DIR/challenge/seed/make-seed.sh" --dev
if [ "$SEED" = full ]; then
  say "the full seed (make-seed.sh)"
  PATH="$PG_BIN:$PATH" PGHOST="$DIR/sock" PGPORT="$PORT" PGUSER=postgres GOTOOLCHAIN=auto \
    bash "$DIR/challenge/seed/make-seed.sh"
fi
echo "$COMMIT" > "$DIR/seeded"
say "done: bench/postgres/run.mjs uses $DIR"
