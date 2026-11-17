#!/usr/bin/env bash
# The ring measurement with the application on top (WP63 S4;
# docs/wp63-iouring-net.md §4 and §10; docs/BENCHMARKS.md, "io_uring under
# the handler"): bench/handler-ring/server.ts, a `nish/net/handler` server
# answering every request with a SQLite lookup, run as one process with
# BENCH_RING=1 against five SO_REUSEPORT processes on descriptors, both under
# the same hard RLIMIT_NOFILE, at 18,000 connections and at the box's C, in
# interleaved rounds. The five-process server also runs as a byte-identical
# copy of its build in every round, and the gap between the two is the noise
# band (.claude/testing.md, "A Measured: trailer").
#
#   bash bench/handler-ring/run.sh                  # 18k and the box's C, 5 rounds
#   bash bench/handler-ring/run.sh --quick          # 18k, 1 round, short windows
#   bash bench/handler-ring/run.sh --conns "18000 60000" --rounds 3
#   bash bench/handler-ring/run.sh --compiler build/nish
#
# The box's C is the most connections five descriptor processes hold under
# the limit L (65535, or this shell's hard limit if lower), each keeping 800
# descriptors back for its listener, loop, database and streams:
# 5 x (L - 800), rounded down to a thousand. On a hard limit of 20,000 that is
# 96,000; on the benchmark box's 65,535 it would be 323,000.
#
# The load is bench/fd-limit/loadgen.c, at a fixed total rate: C keep-alive
# connections, `GET /plaintext`, responses counted at 129 bytes. The database
# is bench/sqlite's, made by `node bench/sqlite/run.mjs --validate` and copied
# here once per run. Needs gcc, node, Linux 6.1 or later and memory for both
# ends of C connections.
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
out="$root/build/bench/handler-ring"
compiler="$root/build/nish"
conns=""
rounds=5
rate=30000
warmup=3
seconds=10
port=9312

while [ $# -gt 0 ]; do
  case "$1" in
  --quick)
    conns="18000"
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
    echo "usage: run.sh [--quick] [--conns \"C ...\"] [--rounds N] [--rate R] [--seconds S] [--warmup S] [--compiler nish]" >&2
    exit 2
    ;;
  esac
  shift
done

hard=$(ulimit -Hn)
limit=65535
if [ "$hard" != unlimited ] && [ "$hard" -lt "$limit" ]; then limit=$hard; fi
boxc=$((5 * (limit - 800) / 1000 * 1000))
if [ -z "$conns" ]; then conns="18000 $boxc"; fi

mkdir -p "$out"
gcc -O2 -Wall -Wextra -o "$out/loadgen" "$root/bench/fd-limit/loadgen.c"
"$compiler" "$root/bench/handler-ring/server.ts" --link "$out/server" >/dev/null
cp "$out/server" "$out/server-copy"
cmp "$out/server" "$out/server-copy"
node "$root/bench/sqlite/run.mjs" --validate --compiler "$compiler" >/dev/null
cp "$root/build/bench/sqlite/feed.db" "$out/feed.db"
rm -f "$out/feed.db-wal" "$out/feed.db-shm"

echo "== box"
grep -m1 'model name' /proc/cpuinfo | sed 's/.*: //'
echo "cpus $(nproc), $(awk '/MemTotal/ {printf "%.1f GiB", $2 / 1048576}' /proc/meminfo)"
echo "kernel $(uname -r), virt $(systemd-detect-virt 2>/dev/null || echo unknown)"
echo "hard RLIMIT_NOFILE $hard; every server runs under $limit:$limit; the box's C is $boxc"
echo "rate $rate req/s, warm-up ${warmup}s, window ${seconds}s, $rounds rounds"

results="$out/results.txt"
: >"$results"

# The server under test, stopped with its workers when the run ends or fails.
server=""
stop_server() {
  if [ -n "$server" ]; then
    pkill -P "$server" 2>/dev/null || true
    kill "$server" 2>/dev/null || true
    wait "$server" 2>/dev/null || true
    server=""
  fi
}
trap stop_server EXIT

# wait_for <pattern>: until the server prints a line matching it.
wait_for() {
  for _ in $(seq 100); do
    if grep -q "$1" "$out/server.out" 2>/dev/null; then return 0; fi
    sleep 0.1
  done
  echo "server did not start: $(cat "$out/server.out" "$out/server.err")" >&2
  return 1
}

# run <design> <conns> <round>: one server, one load, one result line.
run() {
  local design=$1 c=$2 r=$3 pids n slots bin=$out/server
  : >"$out/server.out"
  case "$design" in
  ring)
    n=1
    slots=$((c + 1024))
    env -u BENCH_CORES BENCH_RING=1 prlimit --nofile="$limit:$limit" "$bin" "$port" "$slots" "$out/feed.db" >"$out/server.out" 2>"$out/server.err" &
    server=$!
    # `rings` follows `listening`: wait for the line the check reads.
    wait_for '^rings '
    if ! grep -q '^rings 1$' "$out/server.out"; then
      echo "the kernel refused rings: $(cat "$out/server.out")" >&2
      exit 1
    fi
    pids=$server
    ;;
  epoll | epoll-copy)
    n=5
    # Every descriptor the limit leaves: SO_REUSEPORT does not split C evenly.
    slots=$((limit - 64))
    if [ "$design" = epoll-copy ]; then bin=$out/server-copy; fi
    env -u BENCH_RING BENCH_CORES=5 prlimit --nofile="$limit:$limit" "$bin" "$port" "$slots" "$out/feed.db" >"$out/server.out" 2>"$out/server.err" &
    server=$!
    wait_for listening
    # Worker 0 prints `listening`; the others bind beside it.
    sleep 1
    pids=$(pgrep -P "$server" | paste -sd, -)
    ;;
  esac
  local line
  line=$("$out/loadgen" -c "$c" -r "$rate" -p "$port" -w "$warmup" -d "$seconds" -n "$pids" -l "$design")
  echo "round=$r procs=$n $line" | tee -a "$results"
  stop_server
  sleep 1
}

designs=(ring epoll epoll-copy)
for c in $conns; do
  echo "== C=$c"
  for r in $(seq "$rounds"); do
    # Rotate the order each round so no design always runs first.
    for i in 0 1 2; do
      run "${designs[$(((i + r) % 3))]}" "$c" "$r"
    done
  done
done

echo "== per round: server CPU µs per request (user + sys)"
awk '
  {
    for (i = 1; i <= NF; i++) { split($i, kv, "="); v[kv[1]] = kv[2] }
    k = v["conns"] SUBSEP v["round"]
    us[k, v["label"]] = v["srv_us"]
    if (!(k in seen)) { seen[k] = 1; order[++n] = k }
  }
  END {
    printf "%-8s %5s %8s %8s %10s %8s %8s\n", "C", "round", "ring", "epoll", "epoll-copy", "saving", "band"
    for (i = 1; i <= n; i++) {
      k = order[i]; split(k, cr, SUBSEP)
      e = us[k, "epoll"]; ec = us[k, "epoll-copy"]; u = us[k, "ring"]
      s = e > 0 ? (e - u) / e * 100 : 0; b = e > 0 ? (ec - e) / e * 100 : 0
      printf "%-8s %5s %8.2f %8.2f %10.2f %7.1f%% %7.1f%%\n", cr[1], cr[2], u, e, ec, s, (b < 0 ? -b : b)
    }
  }
' "$results"

echo "== summary: server CPU µs per request (user + sys), median of $rounds (min-max)"
awk -v limit="$limit" '
  function med(a, n,   i, j, t) {
    for (i = 2; i <= n; i++) for (j = i; j > 1 && a[j - 1] > a[j]; j--) { t = a[j]; a[j] = a[j - 1]; a[j - 1] = t }
    return n % 2 ? a[(n + 1) / 2] : (a[n / 2] + a[n / 2 + 1]) / 2
  }
  {
    for (i = 1; i <= NF; i++) { split($i, kv, "="); v[kv[1]] = kv[2] }
    k = v["conns"] SUBSEP v["label"]
    n[k]++; us[k, n[k]] = v["srv_us"]; box[k, n[k]] = v["box_us"]; rps[k, n[k]] = v["rps"]
    lo[k] = (n[k] == 1 || v["srv_us"] < lo[k]) ? v["srv_us"] : lo[k]
    hi[k] = (n[k] == 1 || v["srv_us"] > hi[k]) ? v["srv_us"] : hi[k]
    if (n[k] == 1 || v["up"] < up[k]) up[k] = v["up"]
    fds[k] = v["srv_fds"]; procs[k] = v["procs"]; pss[k] = v["srv_pss_mb"]; mem[k] = v["mem_used_mb"]
    if (!(v["conns"] in seen)) { seen[v["conns"]] = 1; order[++nc] = v["conns"] }
  }
  END {
    printf "%-8s %-10s %5s %8s %6s %18s %8s %8s %8s %8s\n", "C", "design", "procs", "held", "fds", "srv µs/req", "box µs", "rps", "PSS MB", "box MB"
    for (ci = 1; ci <= nc; ci++) {
      c = order[ci]
      split("ring epoll epoll-copy", ds, " ")
      for (di = 1; di <= 3; di++) {
        k = c SUBSEP ds[di]
        if (!(k in n)) continue
        delete a; delete b; delete q
        for (i = 1; i <= n[k]; i++) { a[i] = us[k, i]; b[i] = box[k, i]; q[i] = rps[k, i] }
        m[k] = med(a, n[k]); mb = med(b, n[k]); mq = med(q, n[k])
        printf "%-8s %-10s %5s %8s %6s %7.2f (%.2f-%.2f) %8.2f %8.0f %8s %8s\n", c, ds[di], procs[k], up[k], fds[k], m[k], lo[k], hi[k], mb, mq, pss[k], mem[k]
      }
      e = c SUBSEP "epoll"; ec = c SUBSEP "epoll-copy"; u = c SUBSEP "ring"
      if ((e in m) && (ec in m) && (u in m)) {
        band = m[e] > 0 ? (m[ec] - m[e]) / m[e] * 100 : 0
        if (band < 0) band = -band
        d = m[e] > 0 ? (m[e] - m[u]) / m[e] * 100 : 0
        printf "         the ring process is %.1f%% %s than five on descriptors; noise band (epoll vs its copy) %.1f%%\n", (d < 0 ? -d : d), (d >= 0 ? "cheaper" : "dearer"), band
        if (last == "" || c + 0 > last + 0) { last = c; lastd = d; lastband = band; lastup = up[u]; lastfds = fds[u] }
      }
    }
    if (last != "") {
      verdict = (lastup + 0 > limit + 0 && lastd > lastband) ? "go" : "no-go"
      printf "== advisory verdict at the highest C, %s: %s (the ring process held %s, past the limit of %s every server ran under, with %s descriptors; %.1f%% against a %.1f%% band). The limit is min(65535, the hard RLIMIT_NOFILE); design 4 asks for a C past 65,535, so read the verdict against that.\n", last, verdict, lastup, limit, lastfds, lastd, lastband
    }
  }
' "$results"
