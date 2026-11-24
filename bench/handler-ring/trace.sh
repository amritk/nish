#!/usr/bin/env bash
# One traced ring run (docs/BENCHMARKS.md, "The ring's tail latency, and
# 300,000 connections"): builds bench/handler-ring/server.ts with
# bench/handler-ring/trace.patch applied to runtime/runtime-net.c, reverts the
# patch, then runs that server with NR_TRACE=1 against loadgen's closed loop,
# the server on --server-cpus (default 0) and the load on --load-cpus
# (default 1-3), on --port (default 9313). Run bench/handler-ring/run.sh once
# first: it builds loadgen and the database this uses.
#
#   bash bench/handler-ring/trace.sh 90000 2        # C, think seconds
#   bash bench/handler-ring/trace.sh 90000 2 --compiler build/nish --port 9400
#
# Writes build/bench/handler-ring/trace.err (the trace, one `trace` and one
# `tr2` line a second, each stamped with its CLOCK_MONOTONIC second t) and
# trace-window.err, the lines whose second lies inside loadgen's measured
# window (t in win_lo + 1 to win_hi), and prints loadgen's result line.
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
out="$root/build/bench/handler-ring"
c=$1 think=$2
compiler="$root/build/nish" port=9313 srv_cpus=0 load_cpus=1-3
shift 2
while [ $# -gt 0 ]; do
  case "$1" in
  --compiler) compiler="$2"; shift ;;
  --port) port="$2"; shift ;;
  --server-cpus) srv_cpus="$2"; shift ;;
  --load-cpus) load_cpus="$2"; shift ;;
  *)
    echo "usage: trace.sh C THINK [--compiler nish] [--port P] [--server-cpus LIST] [--load-cpus LIST]" >&2
    exit 2
    ;;
  esac
  shift
done
warmup=8
if awk -v t="$think" -v w="$warmup" 'BEGIN { exit !(t > w) }'; then warmup=$think; fi
for f in loadgen feed.db; do
  if [ ! -e "$out/$f" ]; then
    echo "trace.sh: no $out/$f; run bench/handler-ring/run.sh first" >&2
    exit 2
  fi
done
if ! git -C "$root" diff --quiet HEAD -- runtime/runtime-net.c; then
  echo "trace.sh: runtime/runtime-net.c has local changes; the patch is applied to a clean file" >&2
  exit 2
fi

git -C "$root" apply bench/handler-ring/trace.patch
trap 'git -C "$root" apply -R bench/handler-ring/trace.patch' EXIT
# The server is a bench program, not an example: it builds the way the suite
# builds its cases (`scripts/nish-compiler.sh` -> `nish_allow_panics`).
. "$root/scripts/nish-compiler.sh"
nish_allow_panics "$compiler"
# shellcheck disable=SC2154 # nish_allow_panics sets allow_panics
"$compiler" ${allow_panics[@]+"${allow_panics[@]}"} "$root/bench/handler-ring/server.ts" --link "$out/server-trace" >/dev/null
git -C "$root" apply -R bench/handler-ring/trace.patch
trap - EXIT

hard=$(ulimit -Hn)
limit=65535
if [ "$hard" != unlimited ] && [ "$hard" -lt "$limit" ]; then limit=$hard; fi
: >"$out/trace.out"
NR_TRACE=1 BENCH_RING=1 taskset -c "$srv_cpus" prlimit --nofile="$limit:$limit" "$out/server-trace" "$port" $((c + 1024)) "$out/feed.db" \
  >"$out/trace.out" 2>"$out/trace.err" &
srv=$!
trap 'kill "$srv" 2>/dev/null || true' EXIT
up=0
for _ in $(seq 100); do
  if grep -q '^rings' "$out/trace.out" 2>/dev/null; then up=1; break; fi
  kill -0 "$srv" 2>/dev/null || break
  sleep 0.1
done
if [ "$up" = 0 ]; then
  echo "trace.sh: the server printed no 'rings' line in 10 s; its stderr:" >&2
  tail -20 "$out/trace.err" >&2
  exit 1
fi
line=$(taskset -c "$load_cpus" "$out/loadgen" -c "$c" -t "$think" -p "$port" -w "$warmup" -d 15 -n "$srv" -l trace)
echo "$line"
lo=$(sed -n 's/.* win_lo=\([0-9.]*\).*/\1/p' <<<"$line")
hi=$(sed -n 's/.* win_hi=\([0-9.]*\).*/\1/p' <<<"$line")
if [ -z "$lo" ] || [ -z "$hi" ]; then
  echo "trace.sh: loadgen's line has no win_lo or win_hi" >&2
  exit 1
fi
awk -v lo="$lo" -v hi="$hi" '{ split($2, kv, "="); if (kv[1] == "t" && kv[2] > lo + 1 && kv[2] <= hi) print }' \
  "$out/trace.err" >"$out/trace-window.err"
secs=$(grep -c '^trace ' "$out/trace-window.err" || true)
if [ "$secs" -eq 0 ]; then
  echo "trace.sh: no trace second lies inside the window; is NR_TRACE output in $out/trace.err?" >&2
  exit 1
fi
echo "trace.sh: $secs window seconds in $out/trace-window.err"
