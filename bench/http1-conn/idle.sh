#!/usr/bin/env bash
# What an idle keep-alive connection costs bench/http1-server.ts, the
# HTTP/1.1 load-test server bench/handler-ring/run.sh runs as its `h1`
# design, on descriptors and with BENCH_RING=1 on NET_LISTEN_RING slots: C
# keep-alive connections from bench/fd-limit/loadgen.c send `GET /plaintext`
# at --rate for --seconds, then send nothing for --idle seconds with every
# connection held open, and loadgen's -i reads the server's RSS and PSS and
# the box's Slab and TCP buffer pages then and before the first connect. Each
# line is one run: those differences over C, in bytes a connection, beside
# the loaded run's server CPU a request. Slab and TCP pages are the box's,
# so they count the client's end of each loopback connection too.
#
#   bash bench/http1-conn/idle.sh                         # 18,000 connections, both modes, 3 rounds
#   bash bench/http1-conn/idle.sh --conns 18000 --rounds 5 --binary before=build/h1-before
#
# --binary [name=]<path> adds another build of bench/http1-server.ts as a
# column (repeatable), run in the same interleaved rounds as this checkout's
# build: the before column of a change to std/net. Needs gcc, Linux 6.1 or
# later for the ring and a hard RLIMIT_NOFILE above C + 64 for descriptors.
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
out="$root/build/bench/http1-conn/idle"
compiler="$root/build/nish"
conns=18000
rounds=3
rate=30000
seconds=4
idle=5
port=9314
modes="epoll ring"
extra=()

while [ $# -gt 0 ]; do
  case "$1" in
  --conns) conns="$2"; shift ;;
  --rounds) rounds="$2"; shift ;;
  --rate) rate="$2"; shift ;;
  --seconds) seconds="$2"; shift ;;
  --idle) idle="$2"; shift ;;
  --modes) modes="$2"; shift ;;
  --compiler) compiler="$2"; shift ;;
  --binary) extra+=("$2"); shift ;;
  *)
    echo "usage: idle.sh [--conns C] [--rounds N] [--rate R] [--seconds S] [--idle S] [--modes \"epoll ring\"] [--binary [name=]path] [--compiler nish]" >&2
    exit 2
    ;;
  esac
  shift
done

hard=$(ulimit -Hn)
limit=65535
if [ "$hard" != unlimited ] && [ "$hard" -lt "$limit" ]; then limit=$hard; fi

mkdir -p "$out"
gcc -O2 -Wall -Wextra -o "$out/loadgen" "$root/bench/fd-limit/loadgen.c"
# The server is a bench program, not an example: it builds the way the suite
# builds its cases (`scripts/nish-compiler.sh` -> `nish_allow_panics`).
. "$root/scripts/nish-compiler.sh"
nish_allow_panics "$compiler"
"$compiler" ${allow_panics[@]+"${allow_panics[@]}"} "$root/bench/http1-server.ts" --link "$out/h1" >/dev/null
names=(h1)
bins=("$out/h1")
for spec in ${extra[@]+"${extra[@]}"}; do
  case "$spec" in
  *=*) names+=("${spec%%=*}"); bins+=("${spec#*=}") ;;
  *) names+=("$(basename "$spec")"); bins+=("$spec") ;;
  esac
done

# One run: column `k` in `mode` at C connections; prints its result line.
run_one() {
  local k=$1 mode=$2 ring=0 slots=$((limit - 64))
  if [ "$mode" = ring ]; then
    ring=1
    slots=$((conns + 64))
  elif [ "$conns" -gt "$slots" ]; then
    echo "epoll skipped: one process holds at most $slots connections under $limit" >&2
    return 0
  fi
  env -u BENCH_CORES BENCH_RING=$ring prlimit --nofile="$limit:$limit" "${bins[$k]}" "$port" "$slots" >"$out/server.out" 2>"$out/server.err" &
  local server=$!
  for _ in $(seq 1 100); do
    grep -q listening "$out/server.out" 2>/dev/null && break
    sleep 0.1
  done
  local lines
  lines=$("$out/loadgen" -c "$conns" -r "$rate" -p "$port" -w 1 -d "$seconds" -n "$server" -l "${names[$k]}" -i "$idle")
  kill "$server" 2>/dev/null || true
  wait "$server" 2>/dev/null || true
  local rings
  rings=$(grep -o 'rings [^ ]*' "$out/server.out" || true)
  echo "$lines" | awk -v m="$mode" -v r="$rings" '
    { for (i = 1; i <= NF; i++) { split($i, kv, "="); v[kv[1]] = kv[2] } }
    /idle_s=/ {
      c = v["up"]
      printf "%-8s %-5s %6d %9.0f %9.0f %9.0f %9.0f %8.2f %s\n", v["label"], m, c,
        (v["idle_rss_kb"] - v["base_rss_kb"]) * 1024 / c, (v["idle_pss_kb"] - v["base_pss_kb"]) * 1024 / c,
        (v["idle_slab_kb"] - v["base_slab_kb"]) * 1024 / c, (v["idle_tcp_pages"] - v["base_tcp_pages"]) * 4096 / c,
        us, r
    }
    !/idle_s=/ { us = v["srv_us"]; if (v["closed"] > 0 || v["send_failed"] > 0) us = -1 }'
  # The kernel frees the closed sockets' memory before the next run reads its base.
  sleep 2
}

printf "%-8s %-5s %6s %9s %9s %9s %9s %8s\n" column mode conns "RSS B/c" "PSS B/c" "slab B/c" "tcp B/c" "µs/req"
for r in $(seq 1 "$rounds"); do
  for mode in $modes; do
    # The columns' order turns each round, so neither always runs first.
    n=${#bins[@]}
    for j in $(seq 0 $((n - 1))); do
      run_one $(((j + r) % n)) "$mode"
    done
  done
done
