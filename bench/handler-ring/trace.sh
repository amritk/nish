#!/usr/bin/env bash
# One traced ring run (docs/BENCHMARKS.md, "The ring's tail latency, and
# 300,000 connections"): builds bench/handler-ring/server.ts with
# bench/handler-ring/trace.patch applied to runtime/runtime-net.c, reverts the
# patch, then runs that server on CPU 0 with NR_TRACE=1 against loadgen's
# closed loop on CPUs 1 to 3. Run bench/handler-ring/run.sh once first: it
# builds loadgen and the database this uses.
#
#   bash bench/handler-ring/trace.sh 90000 2        # C, think seconds
#   bash bench/handler-ring/trace.sh 90000 2 --compiler build/nish
#
# Writes build/bench/handler-ring/trace.err (the trace, one `trace` and one
# `tr2` line a second) and prints loadgen's result line.
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
out="$root/build/bench/handler-ring"
c=$1 think=$2
compiler="$root/build/nish"
if [ "${3:-}" = --compiler ]; then compiler=$4; fi
warmup=8
if awk -v t="$think" -v w="$warmup" 'BEGIN { exit !(t > w) }'; then warmup=$think; fi
for f in loadgen feed.db; do
  if [ ! -e "$out/$f" ]; then
    echo "trace.sh: no $out/$f; run bench/handler-ring/run.sh first" >&2
    exit 2
  fi
done
if ! git -C "$root" diff --quiet -- runtime/runtime-net.c; then
  echo "trace.sh: runtime/runtime-net.c has local changes; the patch is applied to a clean file" >&2
  exit 2
fi

git -C "$root" apply bench/handler-ring/trace.patch
trap 'git -C "$root" apply -R bench/handler-ring/trace.patch' EXIT
"$compiler" "$root/bench/handler-ring/server.ts" --link "$out/server-trace" >/dev/null
git -C "$root" apply -R bench/handler-ring/trace.patch
trap - EXIT

hard=$(ulimit -Hn)
limit=65535
if [ "$hard" != unlimited ] && [ "$hard" -lt "$limit" ]; then limit=$hard; fi
: >"$out/trace.out"
NR_TRACE=1 BENCH_RING=1 taskset -c 0 prlimit --nofile="$limit:$limit" "$out/server-trace" 9313 $((c + 1024)) "$out/feed.db" \
  >"$out/trace.out" 2>"$out/trace.err" &
srv=$!
trap 'kill "$srv" 2>/dev/null || true' EXIT
for _ in $(seq 100); do grep -q '^rings' "$out/trace.out" 2>/dev/null && break; sleep 0.1; done
taskset -c 1,2,3 "$out/loadgen" -c "$c" -t "$think" -p 9313 -w "$warmup" -d 15 -n "$srv" -l trace
