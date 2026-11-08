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
#
# The stages shape runs under callgrind instead, whose call graph lets
# stage-misses.mjs give each miss to the stage it happened in:
# <build>-stages.txt holds misses per request per stage.
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
base_file="$root/build/bench/http1-conn/old-package/BASE"
if [ ! -x "$old_nish" ] || [ ! -f "$base_file" ]; then
  echo "misses.sh: run node bench/http1-conn/run.mjs first, for $old_nish" >&2
  exit 1
fi
# The old column is whichever --base the last run.mjs built the package from.
echo "old: std/ at $(cat "$base_file"); new: the working tree"
mkdir -p "$out"
# Runs a command with its output to a log, and on failure prints the log and
# stops the script.
logged() {
  local log="$1"
  shift
  if ! "$@" > "$log" 2>&1; then
    echo "misses.sh: failed: $*" >&2
    cat "$log" >&2
    exit 1
  fi
}
for build in old new; do
  nish="$new_nish"
  src="$root"
  if [ "$build" = old ]; then
    nish="$old_nish"
    src="$root/build/bench/http1-conn/old-package"
  fi
  dir="$out/$build"
  mkdir -p "$dir"
  # run.mjs wrote each build's main.ts, rewritten for a base without sendBody.
  cp "$root/build/bench/http1-conn/$build/main.ts" "$dir/main.ts"
  logged "$dir/compile.log" "$nish" "$dir/main.ts" -o "$dir/" --profile speed -g --link "$dir/conn"
  for shape in idle direct idle-dram direct-dram; do
    mode="${shape%-dram}"
    n="$requests"
    extra=()
    if [ "$shape" != "$mode" ]; then
      n="$dram_requests"
      extra=("$evict")
    fi
    for count in 0 "$n"; do
      logged "$dir/$shape-$count.log" valgrind --tool=cachegrind --cache-sim=yes \
        --cachegrind-out-file="$dir/$shape-$count.cg" \
        "$dir/conn" "$mode" "$count" "$connections" 1 "${extra[@]}"
    done
    # cg_annotate's diff of the two runs: N requests, setup cancelled.
    (cd "$dir" && cg_annotate --diff --show=Dr,D1mr,DLmr,Dw,D1mw,DLmw --sort=D1mr \
      --no-annotate --no-show-percs "$shape-0.cg" "$shape-$n.cg") > "$out/$build-$shape.txt"
    # The source paths are relative to where the compiler read std/ from.
    (cd "$src" && cg_annotate --diff --show=Dr,D1mr,DLmr,Dw,D1mw,DLmw --sort=D1mr \
      --annotate --no-show-percs --context 0 "$dir/$shape-0.cg" "$dir/$shape-$n.cg") > "$out/$build-$shape-lines.txt"
    echo "$build $shape: $n requests, $out/$build-$shape.txt"
  done
  # The stages shape: 1 batch of N requests after the warm pass over every
  # connection, less 0 requests.
  for count in 0 "$requests"; do
    logged "$dir/stages-$count.log" valgrind --tool=callgrind --cache-sim=yes \
      --compress-strings=no --compress-pos=no --callgrind-out-file="$dir/stages-$count.cg" \
      "$dir/conn" stages "$count" "$connections" 1
  done
  node "$root/bench/http1-conn/stage-misses.mjs" "$dir/stages-0.cg" "$dir/stages-$requests.cg" \
    "$requests" "$src" > "$out/$build-stages.txt"
  echo "$build stages: $requests requests, $out/$build-stages.txt"
done
