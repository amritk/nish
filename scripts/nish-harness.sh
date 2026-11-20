#!/usr/bin/env bash
# Build one of the test harnesses written in Nish with build/nish and run it:
# what `npm run test:nish` and `npm run test:cli` do.
#
#   bash scripts/nish-harness.sh <tests/nish/program.ts> <build/exe> [<arg>...]
#
# A harness panics on purpose (a failed check is a panic), so its build takes
# `--allow-panics` from a compiler that lists it (`nish_allow_panics`,
# scripts/nish-compiler.sh). The remaining arguments go to the harness.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
if [ "$#" -lt 2 ]; then
  echo "usage: bash scripts/nish-harness.sh <program.ts> <exe> [<arg>...]" >&2
  exit 2
fi
program=$1
exe=$2
shift 2
nish=$root/build/nish
. "$root/scripts/nish-compiler.sh"
nish_allow_panics "$nish"
"$nish" ${allow_panics[@]+"${allow_panics[@]}"} "$program" -o "$exe.ir/" --link "$exe"
"$exe" "$@"
