#!/usr/bin/env bash
# The façade's ring measurement (WP71 S3; docs/BENCHMARKS.md, "io_uring under
# the http-server façade"): bench/http-server-ring/server.ts, one
# `nish/net/http-server` process serving HttpArena's latency route
# `GET /baseline11?a=1&b=2` over HTTP/1.1, with its listener opened on
# io_uring slots (`tcpListenFlags` flag 8, design ring) and on descriptors
# (flag 0, design epoll), at HttpArena's latency shape: 1,024 keep-alive
# connections at a fixed total rate. ring-copy and epoll-copy run a
# byte-identical copy of the same build the same way, and the gap between a
# design and its copy is that design's noise band (.claude/testing.md, "A
# Measured: trailer"). Every round runs every design at every rate, in an
# order rotated by one each round.
#
#   bash bench/http-server-ring/run.sh                          # 10k and 100k req/s, 5 rounds
#   bash bench/http-server-ring/run.sh --quick                  # 1 round, 4 s windows
#   bash bench/http-server-ring/run.sh --rates "10000" --rounds 3 --seconds 20
#
# The load is loadgen.c here, a copy of bench/fd-limit/loadgen.c that sends
# the route above and prints a mean (see its header). It counts a response
# by its length, which this script reads from one request before the rounds:
# the façade's head carries a Date of fixed width, so every answer to the
# route is that long. CPU per request is the server's user + system time
# over the measured window (/proc/<pid>/stat) divided by the requests
# answered in it; latency is from send to last byte, as loadgen times it.
# A run whose load starved (every connection had a request outstanding
# when the rate wanted another) offered less than its rate, and the summary
# prints the count. The server runs on --server-cpus (default 0) and the
# load on the remaining cores.
#
# HttpArena's latency-1m profile offers 1,000,000 req/s, which a 4-vCPU box
# cannot: the load generator starves above about 150,000 req/s here, so
# --rates' second figure is that profile's stand-in, not its rate.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
compiler="$root/build/nish"
rounds=5
rates="10000 100000"
seconds=20
warmup=3
conns=1024
slots=2048
server_cpus=0
designs="ring ring-copy epoll epoll-copy"
out="${TMPDIR:-/tmp}/http-server-ring"
while [ $# -gt 0 ]; do
  case "$1" in
  --quick) rounds=1 seconds=4 warmup=2 ;;
  --rounds) rounds="$2"; shift ;;
  --rates) rates="$2"; shift ;;
  --seconds) seconds="$2"; shift ;;
  --warmup) warmup="$2"; shift ;;
  --conns) conns="$2"; shift ;;
  --designs) designs="$2"; shift ;;
  --server-cpus) server_cpus="$2"; shift ;;
  --compiler) compiler="$2"; shift ;;
  --out) out="$2"; shift ;;
  *)
    echo "usage: run.sh [--quick] [--rounds N] [--rates \"R ...\"] [--seconds S] [--warmup S] [--conns C] [--designs \"D ...\"] [--server-cpus LIST] [--compiler nish] [--out DIR]" >&2
    exit 2
    ;;
  esac
  shift
done
if [ "$slots" -lt "$conns" ]; then slots=$((conns + 1024)); fi

srv_pin=()
load_pin=()
if [ -n "$server_cpus" ]; then
  srv_pin=(taskset -c "$server_cpus")
  load_cpus=$(node -e '
    const n = Number(process.argv[1]), own = new Set();
    for (const part of process.argv[2].split(",")) {
      const [a, b = a] = part.split("-").map(Number);
      for (let i = a; i <= b; i++) own.add(i);
    }
    const rest = [];
    for (let i = 0; i < n; i++) if (!own.has(i)) rest.push(i);
    process.stdout.write(rest.join(","));
  ' "$(nproc)" "$server_cpus")
  if [ -n "$load_cpus" ]; then load_pin=(taskset -c "$load_cpus"); fi
fi

mkdir -p "$out"
gcc -O2 -Wall -Wextra -o "$out/loadgen" "$root/bench/http-server-ring/loadgen.c"
# A bench program builds the way the suite builds its cases
# (`scripts/nish-compiler.sh` -> `nish_allow_panics`).
. "$root/scripts/nish-compiler.sh"
nish_allow_panics "$compiler"
# shellcheck disable=SC2154 # nish_allow_panics sets allow_panics
"$compiler" ${allow_panics[@]+"${allow_panics[@]}"} "$root/bench/http-server-ring/server.ts" --link "$out/server" >/dev/null
cp "$out/server" "$out/server-copy"
cmp "$out/server" "$out/server-copy"

# Each run listens on a port of its own: a listener the last run closed may
# still hold its port in TIME_WAIT.
port=$((20000 + RANDOM % 20000))
pid=""
cleanup() { if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; fi; }
trap cleanup EXIT

# Starts design $1's server on a fresh port; sets pid and port.
start() {
  local bin="$out/server" ring=0
  case "$1" in
  ring) ring=1 ;;
  ring-copy) bin="$out/server-copy" ring=1 ;;
  epoll) ;;
  epoll-copy) bin="$out/server-copy" ;;
  *) echo "run.sh: unknown design $1" >&2; exit 2 ;;
  esac
  port=$((port + 1))
  ${srv_pin[@]+"${srv_pin[@]}"} "$bin" "$port" "$slots" "$ring" >"$out/server.log" 2>&1 &
  pid=$!
  for _ in $(seq 100); do
    if grep -q '^listening' "$out/server.log"; then break; fi
    sleep 0.05
  done
  if ! grep -q "^listening $port rings $ring\$" "$out/server.log"; then
    echo "run.sh: $1 did not start as asked: $(cat "$out/server.log")" >&2
    exit 1
  fi
}
stop() {
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  pid=""
}

# One answer to the route, for its length; its body must be the sum, 3.
start epoll
exec 3<>"/dev/tcp/127.0.0.1/$port"
printf 'GET /baseline11?a=1&b=2 HTTP/1.1\r\nHost: 127.0.0.1:8080\r\n\r\n' >&3
timeout 1 cat <&3 >"$out/response" || true
exec 3>&-
stop
bytes=$(wc -c <"$out/response")
if ! head -1 "$out/response" | grep -q '^HTTP/1.1 200' || [ "$(tail -c 5 "$out/response" | od -An -c | tr -d ' ')" != '\r\n\r\n3' ]; then
  echo "run.sh: the route did not answer 200 with 3:" >&2
  cat -A "$out/response" >&2
  exit 1
fi
echo "# response: $bytes bytes; $conns connections; rates $rates; ${seconds} s windows after ${warmup} s; server on CPUs ${server_cpus:-any}"

results="$out/results.txt"
: >"$results"
read -r -a order <<<"$designs"
for round in $(seq "$rounds"); do
  for rate in $rates; do
    for design in "${order[@]}"; do
      start "$design"
      line=$(${load_pin[@]+"${load_pin[@]}"} "$out/loadgen" -c "$conns" -r "$rate" -p "$port" -w "$warmup" -d "$seconds" -n "$pid" -b "$bytes" -l "$design")
      stop
      echo "round=$round rate=$rate $line" | tee -a "$results"
    done
  done
  # Rotate the order by one for the next round.
  order=("${order[@]:1}" "${order[0]}")
done

# The summary: per rate and design, the median over rounds of CPU per request,
# p99 and mean, the largest max seen, and starved and lost summed; then each
# design against its copy (the band) and ring against epoll.
node - "$results" <<'EOF'
const fs = require("fs")
const rows = fs.readFileSync(process.argv[2], "utf8").trim().split("\n").map((l) =>
  Object.fromEntries(l.split(" ").map((kv) => kv.split("="))))
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const rates = [...new Set(rows.map((r) => r.rate))]
for (const rate of rates) {
  const by = {}
  for (const r of rows.filter((r) => r.rate === rate)) (by[r.label] ??= []).push(r)
  console.log(`\nrate ${rate} req/s`)
  console.log("design      runs  rps_med   srv_us_med  p99_ms_med  mean_ms_med  max_ms_max  starved  lost  closed")
  const med = {}
  for (const [d, rs] of Object.entries(by)) {
    const m = (k) => median(rs.map((r) => Number(r[k])))
    med[d] = { srv: m("srv_us"), p99: m("p99_ms"), mean: m("mean_ms") }
    const sum = (k) => rs.reduce((a, r) => a + Number(r[k]), 0)
    const mx = Math.max(...rs.map((r) => Number(r.max_ms)))
    console.log(`${d.padEnd(11)} ${String(rs.length).padStart(4)}  ${m("rps").toFixed(0).padStart(7)}  ${med[d].srv.toFixed(2).padStart(10)}  ${med[d].p99.toFixed(3).padStart(10)}  ${med[d].mean.toFixed(3).padStart(11)}  ${mx.toFixed(3).padStart(10)}  ${String(sum("starved")).padStart(7)}  ${String(sum("lat_lost")).padStart(4)}  ${String(sum("closed")).padStart(6)}`)
  }
  const pct = (a, b) => `${(((a - b) / b) * 100).toFixed(1)}%`
  for (const [d, c] of [["ring", "ring-copy"], ["epoll", "epoll-copy"]]) {
    if (med[d] && med[c]) console.log(`band ${d} vs ${c}: srv_us ${pct(med[c].srv, med[d].srv)}, p99 ${pct(med[c].p99, med[d].p99)}, mean ${pct(med[c].mean, med[d].mean)}`)
  }
  if (med.ring && med.epoll) console.log(`ring vs epoll: srv_us ${pct(med.ring.srv, med.epoll.srv)}, p99 ${pct(med.ring.p99, med.epoll.p99)}, mean ${pct(med.ring.mean, med.epoll.mean)}`)
}
EOF
