#!/usr/bin/env bash
# Times the TechEmpower entry against a byte-identical copy of itself and every
# built HTTP twin, on TFB's plaintext and json tests, under wrk.
#
#   bash bench/techempower/run.sh            the recorded run: 3 rounds, 10 s each
#   bash bench/techempower/run.sh --quick    1 round, 3 s, one concurrency per test
#   bash bench/techempower/run.sh --rounds 3 --duration 10 --only plaintext
#   bash bench/techempower/run.sh --nodelay-compare   adds `entry-nodelay0`,
#                                            the entry with its nodelay argument 0
#
# The method is bench/http.mjs's. The server runs on CPU 0 and the client on
# every other CPU, so on a 4-core box the figures are client-shared: wrk and
# the server share one machine, and its three cores drive one server core. The
# rounds are interleaved, each one starting the contestants in a rotated order,
# and every measurement starts its server afresh and warms it for a second
# before wrk counts. The report gives each contestant's median and minimum
# req/s over the rounds. `entry` and `entry-copy` are two builds of main.ts that
# `cmp` finds identical, so the spread between them is the noise band every
# other difference is read against.
#
#   /plaintext   pipeline.lua sends 16 requests per write, as TFB does, at
#                256, 1024, 4096 and 16384 connections
#   /json        one request at a time, at 16, 32, 64, 128, 256 and 512
#
# A concurrency the open-file limit cannot hold is clamped to it and the report
# says so. A twin missing from build/http-twins/<name>/serve (build them with
# bench/http-twins/build.sh) is a row reading n/a. The twins' /json answers
# {"message":"Hello, World!","n":<n>}: 8 bytes more than TFB's, and a counter.
# Without wrk this installs it with apt-get, and without either falls back to
# `h2load --h1`, whose -m 16 pipelines as pipeline.lua does.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
cd "$root"

rounds=3
duration=10
quick=0
only=""
compare=0
while [ $# -gt 0 ]; do
  case $1 in
    --quick) quick=1 ;;
    --rounds) rounds=$2; shift ;;
    --duration) duration=$2; shift ;;
    --only) only=$2; shift ;;
    --nodelay-compare) compare=1 ;;
    -h | --help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "run.sh: unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done

plainLevels=(256 1024 4096 16384)
jsonLevels=(16 32 64 128 256 512)
if [ "$quick" = 1 ]; then
  rounds=1
  duration=3
  plainLevels=(256)
  jsonLevels=(64)
fi

# The client: wrk, else apt-get's wrk, else h2load.
client=wrk
if ! command -v wrk >/dev/null; then
  apt-get install -y wrk >/dev/null 2>&1 || true
  if ! command -v wrk >/dev/null; then
    command -v h2load >/dev/null || { echo "run.sh: neither wrk nor h2load is installed" >&2; exit 1; }
    client=h2load
  fi
fi

# Room for 16384 connections on each side, if the hard limit allows it.
ulimit -n "$(ulimit -Hn)" 2>/dev/null || true
nofile=$(ulimit -n)
[ "$nofile" = unlimited ] && nofile=1048576

cpus=$(nproc)
if [ "$cpus" -ge 2 ]; then
  serverCpu=(taskset -c 0)
  clientCpu=(taskset -c "1-$((cpus - 1))")
  threads=$((cpus - 1))
  pinning="server on CPU 0, client on CPUs 1-$((cpus - 1)) (client-shared: $cpus cores)"
else
  serverCpu=()
  clientCpu=()
  threads=1
  pinning="unpinned: one CPU, server and client share it"
fi

nish=${NISH:-build/nish}
[ -x "$nish" ] || npm run build
mkdir -p build/tfb
for out in entry entry-copy; do
  "$nish" bench/techempower/main.ts --link "build/tfb/$out" --profile speed >build/tfb/compile.log 2>&1 || {
    cat build/tfb/compile.log >&2
    exit 1
  }
done
cmp build/tfb/entry build/tfb/entry-copy || {
  echo "run.sh: two builds of bench/techempower/main.ts differ, so there is no noise band" >&2
  exit 1
}

# name=command, the command taking the port as its first argument.
contestants=("entry=build/tfb/entry" "entry-copy=build/tfb/entry-copy")
[ "$compare" = 1 ] && contestants+=("entry-nodelay0=build/tfb/entry @0")
for name in node-http uws bun bun-elysia bun-hono go-nethttp go-fasthttp rust-hyper rust-actix nginx; do
  contestants+=("$name=build/http-twins/$name/serve")
done

port=18080
log=build/tfb/server.log
pid=""

stop() {
  if [ -n "$pid" ]; then
    # A background job of a script starts with SIGINT ignored, which some
    # runtimes keep, so SIGTERM and then SIGKILL follow it.
    kill -INT "$pid" 2>/dev/null || true
    for signal in TERM KILL; do
      for _ in $(seq 20); do
        kill -0 "$pid" 2>/dev/null || break 2
        sleep 0.1
      done
      kill -"$signal" "$pid" 2>/dev/null || true
    done
    wait "$pid" 2>/dev/null || true
    pid=""
  fi
}
trap stop EXIT

# Starts contestant $1 on a fresh port; false when it never says `listening`.
start() {
  local cmd=${1#*=} extra=()
  if [[ $cmd == *" @"* ]]; then
    extra=("${cmd#* @}")
    cmd=${cmd%% @*}
  fi
  port=$((port + 1))
  "${serverCpu[@]}" "$cmd" "$port" "${extra[@]}" >"$log" 2>&1 &
  pid=$!
  for _ in $(seq 300); do
    grep -q listening "$log" && return 0
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.1
  done
  stop
  return 1
}

# Requests per second of one client run: $1 the path, $2 connections, $3 seconds.
measure() {
  local path=$1 conns=$2 secs=$3 url="http://127.0.0.1:$port$1" out
  if [ "$client" = wrk ]; then
    local args=(-t "$threads" -c "$conns" -d "${secs}s" --timeout 8
      -H "Host: tfb-server" -H "Connection: keep-alive"
      -H "Accept: text/plain,text/html;q=0.9,application/xhtml+xml;q=0.9,application/xml;q=0.8,*/*;q=0.7")
    if [ "$path" = /plaintext ]; then
      out=$("${clientCpu[@]}" wrk "${args[@]}" -s "$here/pipeline.lua" "$url" -- 16 2>&1)
    else
      out=$("${clientCpu[@]}" wrk "${args[@]}" "$url" 2>&1)
    fi
    # A response that is not 2xx, or a socket error, is counted by wrk all the
    # same, so the line goes to stderr beside the figure.
    echo "$out" | grep -E 'Non-2xx|Socket errors' >&2 || true
    echo "$out" | awk '/^Requests\/sec:/ { print $2 }'
  else
    local depth=1
    [ "$path" = /plaintext ] && depth=16
    out=$("${clientCpu[@]}" h2load --h1 -t "$threads" -c "$conns" -m "$depth" -D "$secs" "$url" 2>&1)
    echo "$out" | awk '/^finished in/ { gsub(",", "", $4); print $4 }'
  fi
}

results=build/tfb/results.tsv
: >"$results"
notes=()

# One test: $1 the path, then its concurrencies.
run() {
  local path=$1
  shift
  local conns
  for level in "$@"; do
    conns=$level
    if [ "$conns" -gt $((nofile - 64)) ]; then
      conns=$((nofile - 64))
      notes+=("$path at $level connections is clamped to $conns by the open-file limit ($nofile)")
    fi
    for round in $(seq "$rounds"); do
      local n=${#contestants[@]}
      for k in $(seq 0 $((n - 1))); do
        local entry=${contestants[$(((k + round - 1) % n))]}
        local name=${entry%%=*} cmd=${entry#*=}
        if [ ! -x "${cmd%% @*}" ]; then
          continue
        fi
        if ! start "$entry"; then
          echo "run.sh: $name did not start" >&2
          continue
        fi
        measure "$path" "$conns" 1 >/dev/null || true
        local rps
        rps=$(measure "$path" "$conns" "$duration" || true)
        stop
        printf '%s\t%s\t%s\t%s\n' "$path" "$level" "$name" "${rps:-0}" >>"$results"
        echo "  $path c=$level round $round $name ${rps:-failed}" >&2
      done
    done
  done
}

[ -z "$only" ] || [ "$only" = plaintext ] && run /plaintext "${plainLevels[@]}"
[ -z "$only" ] || [ "$only" = json ] && run /json "${jsonLevels[@]}"

# The tables: one row per contestant, one column per concurrency, each cell
# the median and, in brackets, the minimum req/s over the rounds.
report() {
  local path=$1
  shift
  printf '\n%s, req/s: median (min) of %s round(s) of %s s\n\n' "$path" "$rounds" "$duration"
  printf '| contestant |'
  for level in "$@"; do printf ' %s |' "$level"; done
  printf '\n| --- |'
  for _ in "$@"; do printf ' ---: |'; done
  printf '\n'
  for entry in "${contestants[@]}"; do
    local name=${entry%%=*}
    printf '| %s |' "$name"
    for level in "$@"; do
      awk -F'\t' -v p="$path" -v l="$level" -v n="$name" '
        $1 == p && $2 == l && $3 == n { v[c++] = $4 }
        END {
          if (c == 0) { printf " n/a |"; exit }
          for (i = 0; i < c; i++) for (j = i + 1; j < c; j++) if (v[j] < v[i]) { t = v[i]; v[i] = v[j]; v[j] = t }
          m = c % 2 ? v[(c - 1) / 2] : (v[c / 2 - 1] + v[c / 2]) / 2
          printf " %.0f (%.0f) |", m, v[0]
        }' "$results"
    done
    printf '\n'
  done
  # The noise band: how far apart the two identical builds' medians are.
  printf '\nnoise band (|entry - entry-copy| / entry, medians):'
  for level in "$@"; do
    awk -F'\t' -v p="$path" -v l="$level" '
      function med(a, c,   i, j, t) {
        for (i = 0; i < c; i++) for (j = i + 1; j < c; j++) if (a[j] < a[i]) { t = a[i]; a[i] = a[j]; a[j] = t }
        return c % 2 ? a[(c - 1) / 2] : (a[c / 2 - 1] + a[c / 2]) / 2
      }
      $1 == p && $2 == l && $3 == "entry" { e[ce++] = $4 }
      $1 == p && $2 == l && $3 == "entry-copy" { f[cf++] = $4 }
      END {
        if (ce == 0 || cf == 0) { printf " %s: n/a", l; exit }
        a = med(e, ce); b = med(f, cf)
        printf " %s: %.1f%%", l, (a > b ? a - b : b - a) * 100 / a
      }' "$results"
  done
  printf '\n'
}

{
  echo "TechEmpower json and plaintext, $(lscpu | awk -F: '/Model name/ { gsub(/^ +/, "", $2); print $2; exit }'), $cpus CPUs"
  echo "$pinning; client $client"
  [ -z "$only" ] || [ "$only" = plaintext ] && report /plaintext "${plainLevels[@]}"
  [ -z "$only" ] || [ "$only" = json ] && report /json "${jsonLevels[@]}" &&
    echo 'The twins answer /json with {"message":"Hello, World!","n":<n>}: 8 bytes more than the entry, and a counter.'
  for note in "${notes[@]}"; do echo "note: $note"; done
} | tee build/tfb/results.md
