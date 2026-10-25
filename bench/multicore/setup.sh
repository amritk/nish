#!/usr/bin/env bash
# The server bench/multicore/run.sh measures against: bench/postgres/setup.sh's
# PostgreSQL 18 cluster, tuned as the challenge's box/pg-conf.sh tunes the box
# (max_connections 100, pgtune's web profile for this machine's cores and
# memory), with the challenge pinned at the commit
# bench/postgres/setup.sh names (COMMIT).
#
#   bash bench/multicore/setup.sh [--dev] [dir]
#
# It loads both seeds: conduit_dev, which the challenge's conformance
# (test/run.sh) runs on, and conduit_seed, the full one the load runs on
# (100,000 users, 500,000 articles, about 2.4 GB). --dev loads only the
# first, for a machine without the room; run.sh then loads conduit_dev and
# says so. dir is $PG_BENCH_DIR, else $TMPDIR/nish-bench-multicore (/tmp
# without TMPDIR); run.sh reads the same.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SEED=full
if [ "${1:-}" = --dev ]; then
  SEED=dev
  shift
fi
DIR="${1:-${PG_BENCH_DIR:-${TMPDIR:-/tmp}/nish-bench-multicore}}"

# The full seed's database, its WAL and make-seed.sh's TSVs, with room over.
NEED_KB=$((10 * 1024 * 1024))
mkdir -p "$DIR"
FREE_KB="$(df -Pk "$DIR" | awk 'NR == 2 { print $4 }')"
if [ "$SEED" = full ] && [ "$FREE_KB" -lt "$NEED_KB" ]; then
  echo "setup: $((FREE_KB / 1024 / 1024)) GB free under $DIR; the full seed wants 10 (or pass --dev)" >&2
  exit 1
fi

PG_BENCH_SEED="$SEED" exec bash "$HERE/../postgres/setup.sh" "$DIR"
