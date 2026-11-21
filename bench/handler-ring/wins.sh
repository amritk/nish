#!/usr/bin/env bash
# The cheaper wins for the five-process entry (WP63 S5; docs/wp63-iouring-net.md
# §9; docs/BENCHMARKS.md, "The cheaper wins for five processes"): the S4
# stand-in, bench/handler-ring/server.ts, as five SO_REUSEPORT processes on
# descriptors, each win against the unchanged five in interleaved rounds:
#
#   epoll        the baseline, as run.sh runs it
#   epoll-copy   a byte-identical copy of the baseline's build; its gap to the
#                baseline is the noise band (.claude/testing.md, "A Measured:
#                trailer")
#   mmap         BENCH_MMAP=1: `PRAGMA mmap_size=268435456` on each worker's
#                connection after it opens
#   shm          BENCH_CACHE=shm: each post's like count, once looked up, kept
#                in one `nish/sync/shm` region the five share
#   private      BENCH_CACHE=private: the same cache in each worker's own
#                memory, the per-process state the shared region replaces
#
# Every arm runs the same binary but the copy, under the same hard
# RLIMIT_NOFILE, in an order rotated each round.
#
#   bash bench/handler-ring/wins.sh                 # 18,000 connections, 5 rounds
#   bash bench/handler-ring/wins.sh --quick         # 1 round, short windows
#   bash bench/handler-ring/wins.sh --conns "18000 96000" --rounds 7
#   bash bench/handler-ring/wins.sh --compiler build/nish
#
# The load, the database and the reading are run.sh's: bench/fd-limit/loadgen.c
# at a fixed total rate over C keep-alive connections, bench/sqlite's feed.db
# copied here once per run, and the servers' user plus system CPU over the
# window divided by the requests answered. Each cache starts empty with its
# server, so its hit rate climbs through the run; the `hit` column is the hits
# over every request the workers answered, warm-up included.
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
out="$root/build/bench/handler-ring-wins"
compiler="$root/build/nish"
conns="18000"
rounds=5
rate=30000
warmup=3
seconds=10
port=9313

while [ $# -gt 0 ]; do
  case "$1" in
  --quick)
    rounds=1
    warmup=1
    seconds=3
    ;;
  --conns) conns="$2"; shift ;;
  --rounds) rounds="$2"; shift ;;
  --rate) rate="$2"; shift ;;
  --seconds) seconds="$2"; shift ;;
  --warmup) warmup="$2"; shift ;;
  --compiler) compiler="$2"; shift ;;
  *)
    echo "usage: wins.sh [--quick] [--conns \"C ...\"] [--rounds N] [--rate R] [--seconds S] [--warmup S] [--compiler nish]" >&2
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
"$compiler" ${allow_panics[@]+"${allow_panics[@]}"} "$root/bench/handler-ring/server.ts" --link "$out/server" >/dev/null
cp "$out/server" "$out/server-copy"
cmp "$out/server" "$out/server-copy"
node "$root/bench/sqlite/run.mjs" --validate --compiler "$compiler" >/dev/null
cp "$root/build/bench/sqlite/feed.db" "$out/feed.db"
rm -f "$out/feed.db-wal" "$out/feed.db-shm"

echo "== box"
grep -m1 'model name' /proc/cpuinfo | sed 's/.*: //'
echo "cpus $(nproc), $(awk '/MemTotal/ {printf "%.1f GiB", $2 / 1048576}' /proc/meminfo)"
echo "kernel $(uname -r), virt $(systemd-detect-virt 2>/dev/null || echo unknown)"
echo "hard RLIMIT_NOFILE $hard; every server runs under $limit:$limit"
echo "feed.db $(du -m "$out/feed.db" | cut -f1) MB"
echo "rate $rate req/s, warm-up ${warmup}s, window ${seconds}s, $rounds rounds"

results="$out/results.txt"
: >"$results"

server=""
stop_server() {
  if [ -n "$server" ]; then
    pkill -P "$server" 2>/dev/null || true
    kill "$server" 2>/dev/null || true
    wait "$server" 2>/dev/null || true
    server=""
  fi
  rm -f /dev/shm/nish-bench-cache
}
trap stop_server EXIT

wait_for() {
  for _ in $(seq 100); do
    if grep -q "$1" "$out/server.out" 2>/dev/null; then return 0; fi
    sleep 0.1
  done
  echo "server did not start: $(cat "$out/server.out" "$out/server.err")" >&2
  return 1
}

# run <arm> <conns> <round>: five workers, one load, one result line.
run() {
  local arm=$1 c=$2 r=$3 pids bin=$out/server slots=$((limit - 64))
  local knobs=(env -u BENCH_RING -u BENCH_MMAP -u BENCH_CACHE BENCH_CORES=5)
  case "$arm" in
  epoll) ;;
  epoll-copy) bin=$out/server-copy ;;
  mmap) knobs+=(BENCH_MMAP=1) ;;
  shm) knobs+=(BENCH_CACHE=shm) ;;
  private) knobs+=(BENCH_CACHE=private) ;;
  esac
  : >"$out/server.out"
  "${knobs[@]}" prlimit --nofile="$limit:$limit" "$bin" "$port" "$slots" "$out/feed.db" >"$out/server.out" 2>"$out/server.err" &
  server=$!
  wait_for listening
  if [ "$arm" = mmap ] && ! grep -q '^mmap 268435456$' "$out/server.out"; then
    echo "SQLite did not take mmap_size: $(cat "$out/server.out")" >&2
    exit 1
  fi
  sleep 1
  pids=$(pgrep -P "$server" | paste -sd, -)
  local line
  line=$("$out/loadgen" -c "$c" -r "$rate" -p "$port" -w "$warmup" -d "$seconds" -n "$pids" -l "$arm")
  stop_server
  # Each worker's last `cache` line, summed: hits over all its answers.
  local hit
  hit=$(awk '$1 == "cache" { h[$2] = $3; m[$2] = $4 } END { for (w in h) { th += h[w]; tm += m[w] } printf "%.1f", ((th + tm) > 0 ? th / (th + tm) * 100 : 0) }' "$out/server.out")
  echo "round=$r procs=5 hit=$hit $line" | tee -a "$results"
  sleep 1
}

arms=(epoll epoll-copy mmap shm private)
for c in $conns; do
  echo "== C=$c"
  for r in $(seq "$rounds"); do
    for i in 0 1 2 3 4; do
      run "${arms[$(((i + r) % 5))]}" "$c" "$r"
    done
  done
done

echo "== per round: server CPU µs per request (user + sys); each arm's change against epoll"
awk '
  {
    for (i = 1; i <= NF; i++) { split($i, kv, "="); v[kv[1]] = kv[2] }
    k = v["conns"] SUBSEP v["round"]
    us[k, v["label"]] = v["srv_us"]
    if (!(k in seen)) { seen[k] = 1; order[++n] = k }
  }
  END {
    printf "%-8s %5s %8s %10s %8s %8s %8s %8s %8s %8s\n", "C", "round", "epoll", "epoll-copy", "mmap", "shm", "private", "band", "mmap", "shm"
    for (i = 1; i <= n; i++) {
      k = order[i]; split(k, cr, SUBSEP); e = us[k, "epoll"]
      b = (us[k, "epoll-copy"] - e) / e * 100
      printf "%-8s %5s %8.2f %10.2f %8.2f %8.2f %8.2f %7.1f%% %+7.1f%% %+7.1f%%\n", cr[1], cr[2], e, us[k, "epoll-copy"], us[k, "mmap"], us[k, "shm"], us[k, "private"], (b < 0 ? -b : b), (us[k, "mmap"] - e) / e * 100, (us[k, "shm"] - e) / e * 100
    }
  }
' "$results"

echo "== summary: medians of $rounds (min-max)"
awk '
  function med(a, n,   i, j, t) {
    for (i = 2; i <= n; i++) for (j = i; j > 1 && a[j - 1] > a[j]; j--) { t = a[j]; a[j] = a[j - 1]; a[j - 1] = t }
    return n % 2 ? a[(n + 1) / 2] : (a[n / 2] + a[n / 2 + 1]) / 2
  }
  {
    for (i = 1; i <= NF; i++) { split($i, kv, "="); v[kv[1]] = kv[2] }
    k = v["conns"] SUBSEP v["label"]; j = ++n[k]
    us[k, j] = v["srv_us"]; box[k, j] = v["box_us"]; rps[k, j] = v["rps"]
    pss[k, j] = v["srv_pss_mb"]; rss[k, j] = v["srv_rss_mb"]; hit[k, j] = v["hit"]
    if (j == 1 || v["srv_us"] < lo[k]) lo[k] = v["srv_us"]
    if (j == 1 || v["srv_us"] > hi[k]) hi[k] = v["srv_us"]
    if (j == 1 || v["up"] < up[k]) up[k] = v["up"]
    if (!(v["conns"] in seen)) { seen[v["conns"]] = 1; order[++nc] = v["conns"] }
  }
  END {
    printf "%-8s %-10s %8s %18s %8s %8s %8s %8s %6s\n", "C", "arm", "held", "srv µs/req", "box µs", "rps", "PSS MB", "RSS MB", "hit%"
    split("epoll epoll-copy mmap shm private", as, " ")
    for (ci = 1; ci <= nc; ci++) {
      c = order[ci]
      for (ai = 1; ai <= 5; ai++) {
        k = c SUBSEP as[ai]
        if (!(k in n)) continue
        for (f = 1; f <= 6; f++) {
          delete a
          for (i = 1; i <= n[k]; i++) a[i] = (f == 1 ? us[k, i] : f == 2 ? box[k, i] : f == 3 ? rps[k, i] : f == 4 ? pss[k, i] : f == 5 ? rss[k, i] : hit[k, i])
          m[f] = med(a, n[k])
        }
        mu[k] = m[1]
        printf "%-8s %-10s %8s %7.2f (%.2f-%.2f) %8.2f %8.0f %8.1f %8.1f %6.1f\n", c, as[ai], up[k], m[1], lo[k], hi[k], m[2], m[3], m[4], m[5], m[6]
      }
      e = mu[c SUBSEP "epoll"]
      band = (mu[c SUBSEP "epoll-copy"] - e) / e * 100; if (band < 0) band = -band
      for (ai = 3; ai <= 5; ai++) {
        d = (mu[c SUBSEP as[ai]] - e) / e * 100
        ad = d < 0 ? -d : d
        verdict = ad <= band ? "no measurable change" : (d < 0 ? "gain" : "loss")
        printf "         %-8s %+.1f%% against epoll, noise band %.1f%%: %s\n", as[ai], d, band, verdict
      }
    }
  }
' "$results"
