#!/usr/bin/env bash
# The local multicore challenge run: conformance, then the challenge's load
# generator at fixed loads, then memory per idle connection. run.mjs says
# what each step measures and takes the options; setup.sh must have run.
#
#   bash bench/multicore/run.sh --conformance-only
#   bash bench/multicore/run.sh --users 2000,4000 --think-scale 0.1
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
# Every user holds a connection, on both ends of the loopback.
ulimit -n "$(ulimit -Hn)"
exec node "$HERE/run.mjs" "$@"
