#!/usr/bin/env bash
# Where an idle request's cache misses land, per function and per line, on the
# old and new builds `run.mjs` times: cachegrind on `-g` builds at
# `--profile speed`, each shape run with 0 timed requests and with N, and
# `cg_annotate --diff` of the two, so the difference is N requests' worth and
# setup cancels.
#
#   bash bench/http1-conn/misses.sh [connections] [requests] [dram-requests] [evict-MiB]
#
# Needs valgrind, and `build/bench/http1-conn/old-package/`, which
# `node bench/http1-conn/run.mjs` leaves holding the base's std/ and a copy of
# the compiler. Writes build/bench/http1-conn/misses/<build>-<shape>.txt (the
# function summary) and <build>-<shape>-lines.txt (the annotated source).
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
connections="${1:-10000}"
requests="${2:-100000}"
dram_requests="${3:-20000}"
evict="${4:-1024}"
out="$root/build/bench/http1-conn/misses"
old_nish="$root/build/bench/http1-conn/old-package/bin/nish"
new_nish="$root/build/nish"
[ -x "$new_nish" ] || new_nish="$root/build/seed/bin/nish"
if [ ! -x "$old_nish" ]; then
  echo "misses.sh: run node bench/http1-conn/run.mjs first, for $old_nish" >&2
  exit 1
fi
mkdir -p "$out"
for build in old new; do
  nish="$new_nish"
  src="$root"
  if [ "$build" = old ]; then
    nish="$old_nish"
    src="$root/build/bench/http1-conn/old-package"
  fi
  dir="$out/$build"
  mkdir -p "$dir"
  cp "$root/bench/http1-conn/main.ts" "$dir/main.ts"
  "$nish" "$dir/main.ts" -o "$dir/" --profile speed -g --link "$dir/conn" > /dev/null 2>&1
  for shape in idle direct idle-dram direct-dram; do
    mode="${shape%-dram}"
    n="$requests"
    extra=()
    if [ "$shape" != "$mode" ]; then
      n="$dram_requests"
      extra=("$evict")
    fi
    for count in 0 "$n"; do
      valgrind --tool=cachegrind --cache-sim=yes \
        --cachegrind-out-file="$dir/$shape-$count.cg" \
        "$dir/conn" "$mode" "$count" "$connections" 1 "${extra[@]}" > /dev/null 2>&1
    done
    # cg_annotate's diff of the two runs: N requests, setup cancelled.
    (cd "$dir" && cg_annotate --diff --show=Dr,D1mr,DLmr,Dw,D1mw,DLmw --sort=D1mr \
      --no-annotate --no-show-percs "$shape-0.cg" "$shape-$n.cg") > "$out/$build-$shape.txt"
    # The source paths are relative to where the compiler read std/ from.
    (cd "$src" && cg_annotate --diff --show=Dr,D1mr,DLmr,Dw,D1mw,DLmw --sort=D1mr \
      --annotate --no-show-percs --context 0 "$dir/$shape-0.cg" "$dir/$shape-$n.cg") > "$out/$build-$shape-lines.txt" 2>&1 || true
    echo "$build $shape: $n requests, $out/$build-$shape.txt"
  done
done
