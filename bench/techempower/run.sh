#!/usr/bin/env bash
# Times the TechEmpower entry against a byte-identical copy of itself, its
# async twin (async-main.ts) and every built HTTP twin, on TFB's plaintext and
# json tests, and the database entry (db-main.ts) against its copy and its
# async twin (async-db-main.ts) on TFB's database tests, under wrk.
#
#   bash bench/techempower/run.sh            the recorded run: 3 rounds, 10 s each
#   bash bench/techempower/run.sh --quick    1 round, 3 s, one concurrency per test
#   bash bench/techempower/run.sh --rounds 3 --duration 10 --only plaintext
#   bash bench/techempower/run.sh --nodelay-compare   adds `entry-nodelay0`,
#                                            the entry with its nodelay argument 0
#   bash bench/techempower/run.sh --cores-compare   plaintext and json only:
#                                            the entry as one process (`entry`,
#                                            `entry-copy`) against one worker a
#                                            server CPU (`entry-cores`), the server
#                                            on the first half of the CPUs
#   bash bench/techempower/run.sh --browser-head --only plaintext
#                                            the browser-head gauge, below
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
#   database     /db, /queries?queries=20, /updates?queries=20, /fortunes and
#                /cached-queries?count=100, one request at a time, at 16, 64
#                and 256 connections, against one throwaway local Postgres
#
# --browser-head times `entry`, `entry-copy`, `uws` and `go-fasthttp` at 256
# connections on /plaintext and /json, one request at a time on both, each
# request carrying the 759-byte head a browser sends (a Chrome User-Agent and
# Accept, Accept-Language, Accept-Encoding, a six-cookie Cookie, Referer and
# the Sec-Fetch headers) in place of TFB's three headers. It skips the
# database tests and needs wrk, since h2load is not given the headers. docs/BENCHMARKS.md → "HTTP/1 codec baseline" records it.
#
# The async gate (WP49 stage 6) is read from the same run: `async` against
# `entry` on plaintext and json, `async-db` against `db-entry` on the database
# tests, each beside its own band (`entry` and `entry-copy`, `db-entry` and
# `db-entry-copy`). The report's verdict line says inside or outside it per
# concurrency. Each contestant pair is run the same way: the same port, host,
# slots, workers (one) and Postgres connections (4). It is a relative A/B on
# one machine, not a TechEmpower rank. Every measurement also records the
# server's peak resident memory (VmHWM from /proc), reported in MiB.
#
# The database tests start a cluster in build/tfb/pg with the newest
# /usr/lib/postgresql/*/bin, or $PG_BIN (run as the postgres user under root),
# load TFB's world and fortune tables into it, and stop it at the end. With
# four or more CPUs Postgres runs on CPU 1 and the client on CPUs 2 and up.
# Without Postgres binaries the database tests are skipped with a note.
#
# A concurrency the open-file limit cannot hold is clamped to it and the report
# says so. A twin missing from build/http-twins/<name>/serve (build them with
# bench/http-twins/build.sh) is a row reading n/a. The twins' /json answers
# {"message":"Hello, World!","n":<n>}: 8 bytes more than TFB's, and a counter.
# Without wrk this installs it with apt-get, and without either falls back to
# `h2load --h1`, whose -m 16 pipelines as pipeline.lua does.
#
# A measurement the client gives no figure for, or a figure of 0, is recorded
# as n/a with the reason in the notes, and is left out of the median, the
# minimum and the noise band. wrk's Non-2xx and socket-error counts go into
# results.tsv beside each figure, and a cell any of them is non-zero in is
# marked `*` and listed in the notes. wrk counts those answers in its rate, so a
# `*` cell's figure is not trusted: its verdict is never inside. If `entry`,
# `entry-copy`, `db-entry` or `db-entry-copy` fails to start, the run exits 1;
# a twin that fails to start is a row reading n/a.
#
# The database is loaded once and not reset between contestants or rounds:
# /updates rewrites world's rows in place, so a later contestant meets more
# dead tuples than an earlier one. The rotated order spreads that across the
# contestants rather than removing it.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
cd "$root"

rounds=3
duration=10
quick=0
only=""
compare=0
cores=0
browser=0
while [ $# -gt 0 ]; do
  case $1 in
    --quick) quick=1 ;;
    --rounds | --duration)
      case ${2:-} in '' | *[!0-9]* | 0) echo "run.sh: $1 takes a positive whole number, not '${2:-}'" >&2; exit 2 ;; esac
      if [ "$1" = --rounds ]; then rounds=$2; else duration=$2; fi
      shift
      ;;
    --only)
      only=${2:-}
      shift
      case $only in plaintext | json | db) ;; *) echo "run.sh: --only takes plaintext, json or db, not $only" >&2; exit 2 ;; esac
      ;;
    --nodelay-compare) compare=1 ;;
    --cores-compare) cores=1 ;;
    --browser-head) browser=1 ;;
    -h | --help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    *) echo "run.sh: unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done

plainLevels=(256 1024 4096 16384)
jsonLevels=(16 32 64 128 256 512)
dbLevels=(16 64 256)
dbPaths=(/db "/queries?queries=20" "/updates?queries=20" /fortunes "/cached-queries?count=100")
if [ "$quick" = 1 ]; then
  rounds=1
  duration=3
  plainLevels=(256)
  jsonLevels=(64)
  dbLevels=(64)
fi
if [ "$browser" = 1 ]; then
  plainLevels=(256)
  jsonLevels=(256)
fi

# The client: wrk, else apt-get's wrk, else h2load.
client=wrk
if ! command -v wrk >/dev/null; then
  apt-get install -y wrk >/dev/null 2>&1 || true
  if ! command -v wrk >/dev/null; then
    command -v h2load >/dev/null || { echo "run.sh: neither wrk nor h2load is installed" >&2; exit 1; }
    client=h2load
    if [ "$browser" = 1 ]; then echo "run.sh: --browser-head needs wrk" >&2; exit 1; fi
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
  # wrk needs a connection per thread, and the fewest connections measured is 16.
  threads=$((cpus - 1 > 16 ? 16 : cpus - 1))
  pinning="server on CPU 0, client on CPUs 1-$((cpus - 1)) (client-shared: $cpus cores)"
  if [ "$cores" = 1 ]; then
    # Half the CPUs serve, the other half drive them.
    half=$((cpus / 2))
    serverCpu=(taskset -c "0-$((half - 1))")
    clientCpu=(taskset -c "$half-$((cpus - 1))")
    threads=$((cpus - half > 16 ? 16 : cpus - half))
    pinning="server on CPUs 0-$((half - 1)), client on CPUs $half-$((cpus - 1))"
  fi
else
  serverCpu=()
  clientCpu=()
  threads=1
  pinning="unpinned: one CPU, server and client share it"
fi
# The database tests: Postgres on CPU 1 and the client after it, given room.
pgCpu=()
dbClientCpu=(${clientCpu[@]+"${clientCpu[@]}"})
dbThreads=$threads
dbPinning=$pinning
if [ "$cpus" -ge 4 ]; then
  pgCpu=(taskset -c 1)
  dbClientCpu=(taskset -c "2-$((cpus - 1))")
  dbThreads=$((cpus - 2 > 16 ? 16 : cpus - 2))
  dbPinning="server on CPU 0, Postgres on CPU 1, client on CPUs 2-$((cpus - 1))"
fi

nish=${NISH:-build/nish}
[ -x "$nish" ] || npm run build
mkdir -p build/tfb
# Builds $1 into build/tfb/$2.
build() {
  "$nish" "bench/techempower/$1" --link "build/tfb/$2" --profile speed >build/tfb/compile.log 2>&1 || {
    cat build/tfb/compile.log >&2
    exit 1
  }
}
# Whether the run times test $1: every test, or the one `--only` names.
wants() {
  if [ "$browser" = 1 ] && [ "$1" = db ]; then return 1; fi
  [ -z "$only" ] || [ "$only" = "$1" ]
}

if wants plaintext || wants json; then
  build main.ts entry
  build main.ts entry-copy
  build async-main.ts async
  cmp build/tfb/entry build/tfb/entry-copy || {
    echo "run.sh: two builds of bench/techempower/main.ts differ, so there is no noise band" >&2
    exit 1
  }
fi

# name=command, the command taking the port as its first argument.
contestants=("entry=build/tfb/entry" "entry-copy=build/tfb/entry-copy" "async=build/tfb/async")
[ "$compare" = 1 ] && contestants+=("entry-nodelay0=build/tfb/entry @0")
twins=(node-http uws bun bun-elysia bun-hono go-nethttp go-fasthttp rust-hyper rust-actix nginx)
if [ "$browser" = 1 ]; then
  contestants=("entry=build/tfb/entry" "entry-copy=build/tfb/entry-copy")
  twins=(uws go-fasthttp)
fi
if [ "$cores" = 1 ]; then
  # The last argument is main.ts's workers: 1 one process, 0 one a CPU.
  contestants=("entry=build/tfb/entry @1 127.0.0.1 16384 1" "entry-copy=build/tfb/entry-copy @1 127.0.0.1 16384 1"
    "entry-cores=build/tfb/entry @1 127.0.0.1 16384 0")
  twins=()
fi
for name in ${twins[@]+"${twins[@]}"}; do
  contestants+=("$name=build/http-twins/$name/serve")
done

# The request head: TFB's three headers, or with --browser-head a browser's.
head=(-H "Host: tfb-server" -H "Connection: keep-alive"
  -H "Accept: text/plain,text/html;q=0.9,application/xhtml+xml;q=0.9,application/xml;q=0.8,*/*;q=0.7")
if [ "$browser" = 1 ]; then
  head=(-H "Host: tfb-server" -H "Connection: keep-alive"
    -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
    -H "Accept-Language: en-GB,en-US;q=0.9,en;q=0.8"
    -H "Accept-Encoding: gzip, deflate, br, zstd"
    -H "Cookie: session=8f3a9c2e7b1d4f6a0e5c9b2d7f1a3e6c; csrftoken=Qm9vZ2llV29vZ2llQm9vZ2llV29vZ2llQm9v; _ga=GA1.1.1234567890.1731300000; _ga_XYZ123=GS1.1.1731300000.4.1.1731300456.0.0.0; theme=dark; lang=en"
    -H "Referer: https://tfb-server/"
    -H "Upgrade-Insecure-Requests: 1"
    -H "Sec-Fetch-Dest: document" -H "Sec-Fetch-Mode: navigate" -H "Sec-Fetch-Site: same-origin")
fi

port=18080
log=build/tfb/server.log
pid=""

stop() {
  if [ -n "$pid" ]; then
    # SIGTERM first: a background job of a script starts with SIGINT ignored,
    # which some runtimes keep. SIGINT and then SIGKILL follow it.
    kill -TERM "$pid" 2>/dev/null || true
    for signal in INT KILL; do
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
    read -ra extra <<<"${cmd#* @}"
    cmd=${cmd%% @*}
  fi
  port=$((port + 1))
  # Emptied here, not by the child's redirection, so the wait below never
  # reads the last server's `listening`.
  : >"$log"
  # The `${a[@]+...}` forms keep an empty array from tripping `set -u` on
  # bash before 4.4.
  ${serverCpu[@]+"${serverCpu[@]}"} "$cmd" "$port" ${extra[@]+"${extra[@]}"} >>"$log" 2>&1 &
  pid=$!
  for _ in $(seq 300); do
    grep -q listening "$log" && return 0
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.1
  done
  stop
  return 1
}

# One client run: $1 the path, $2 connections, $3 seconds. Prints the req/s
# (`-` when the client gave none), the Non-2xx count and the socket errors as
# connect/read/write/timeout, tab-separated.
measure() {
  local path=$1 conns=$2 secs=$3 url="http://127.0.0.1:$port$1" out
  if [ "$client" = wrk ]; then
    local args=(-t "$threads" -c "$conns" -d "${secs}s" --timeout 8 "${head[@]}")
    if [ "$path" = /plaintext ] && [ "$browser" = 0 ]; then
      out=$(${clientCpu[@]+"${clientCpu[@]}"} wrk "${args[@]}" -s "$here/pipeline.lua" "$url" -- 16 2>&1)
    else
      out=$(${clientCpu[@]+"${clientCpu[@]}"} wrk "${args[@]}" "$url" 2>&1)
    fi
    # A response that is not 2xx, or a socket error, is counted by wrk all the
    # same, so both counts travel with the figure.
    echo "$out" | awk '
      /^Requests\/sec:/ { rps = $2 }
      /Non-2xx/ { non2xx = $NF }
      /Socket errors:/ { gsub(",", ""); errors = $4 "/" $6 "/" $8 "/" $10 }
      END { printf "%s\t%d\t%s\n", rps == "" ? "-" : rps, non2xx, errors == "" ? "0/0/0/0" : errors }'
  else
    local depth=1
    [ "$path" = /plaintext ] && [ "$browser" = 0 ] && depth=16
    out=$(${clientCpu[@]+"${clientCpu[@]}"} h2load --h1 -t "$threads" -c "$conns" -m "$depth" -D "$secs" "$url" 2>&1)
    echo "$out" | awk '
      /^finished in/ { gsub(",", "", $4); rps = $4 }
      /^status codes:/ { gsub(",", ""); non2xx = $5 + $7 + $9 }
      /^requests:/ { gsub(",", ""); failed = $10 }
      END { printf "%s\t%d\t0/%d/0/0\n", rps == "" ? "-" : rps, non2xx, failed }'
  fi
}

results=build/tfb/results.tsv
: >"$results"
notes=()
[ "$cores" = 1 ] && notes+=("entry-cores's peak RSS is its supervisor's alone, not its workers'")

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
      local n=${#lineup[@]}
      for k in $(seq 0 $((n - 1))); do
        local entry=${lineup[$(((k + round - 1) % n))]}
        local name=${entry%%=*} cmd=${entry#*=}
        if [ ! -x "${cmd%% @*}" ]; then
          continue
        fi
        if ! start "$entry"; then
          echo "run.sh: $name did not start" >&2
          case $name in entry | entry-copy | db-entry | db-entry-copy)
            cat "$log" >&2
            exit 1
            ;;
          esac
          continue
        fi
        measure "$path" "$conns" 1 >/dev/null || true
        local out rps non2xx errors hwm
        out=$(measure "$path" "$conns" "$duration" || true)
        # The server's peak resident set, in kB, before it stops.
        hwm=$(awk '/^VmHWM:/ { print $2 }' "/proc/$pid/status" 2>/dev/null || true)
        stop
        IFS=$'\t' read -r rps non2xx errors <<<"$out" || true
        if [ -z "$rps" ] || awk -v r="$rps" 'BEGIN { exit !(r + 0 == 0) }'; then
          notes+=("$path c=$level round $round: $name gave no figure (client output: ${rps:-none}, socket errors c/r/w/t ${errors:-n/a}), recorded n/a")
          rps=n/a
        fi
        if [ "${non2xx:-0}" != 0 ] || [ "${errors:-0/0/0/0}" != 0/0/0/0 ]; then
          notes+=("$path c=$level round $round: $name had $non2xx Non-2xx responses and socket errors c/r/w/t $errors")
        fi
        printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$path" "$level" "$name" "$rps" "${non2xx:-0}" "${errors:-0/0/0/0}" "${hwm:-0}" >>"$results"
        echo "  $path c=$level round $round $name $rps non2xx=${non2xx:-0} socket-errors=${errors:-0/0/0/0} hwm=${hwm:-?}kB" >&2
      done
    done
  done
}

lineup=(${contestants[@]+"${contestants[@]}"})
httpThreads=$threads
if wants plaintext; then run /plaintext "${plainLevels[@]}"; fi
if wants json; then run /json "${jsonLevels[@]}"; fi

# The database tests, against one throwaway cluster.
pgDir=$root/build/tfb/pg
pgPort=15432
pgAs=()
pgBin=""
pgStop() {
  if [ -n "$pgBin" ] && [ -f "$pgDir/data/postmaster.pid" ]; then
    ${pgAs[@]+"${pgAs[@]}"} "$pgBin/pg_ctl" -D "$pgDir/data" -m immediate stop >/dev/null 2>&1 || true
  fi
}
trap 'stop; pgStop' EXIT
pgSql() { ${pgAs[@]+"${pgAs[@]}"} "$pgBin/psql" -h "$pgDir" -p "$pgPort" -U postgres -qAt -v ON_ERROR_STOP=1 "$@"; }
dbRan=0
if [ "$cores" = 0 ] && wants db; then
  pgBin=${PG_BIN:-$(find /usr/lib/postgresql -maxdepth 2 -name bin -type d 2>/dev/null | sort -V | tail -n 1)}
  if [ -z "$pgBin" ] || [ ! -x "$pgBin/initdb" ]; then
    notes+=("the database tests were skipped: no Postgres binaries (set PG_BIN)")
  else
    build db-main.ts db-entry
    build db-main.ts db-entry-copy
    build async-db-main.ts async-db
    cmp build/tfb/db-entry build/tfb/db-entry-copy || {
      echo "run.sh: two builds of bench/techempower/db-main.ts differ, so there is no noise band" >&2
      exit 1
    }
    [ "$(id -u)" = 0 ] && pgAs=(runuser -u postgres --)
    pgStop
    rm -rf "$pgDir"
    mkdir -p "$pgDir"
    [ "$(id -u)" = 0 ] && chown postgres: "$pgDir"
    ${pgAs[@]+"${pgAs[@]}"} "$pgBin/initdb" -D "$pgDir/data" -U postgres --auth=trust -E UTF8 --no-locale >"$pgDir.log" 2>&1 || {
      cat "$pgDir.log" >&2
      exit 1
    }
    printf 'local all postgres trust\nhost all all 127.0.0.1/32 scram-sha-256\n' >"$pgDir/data/pg_hba.conf"
    ${pgCpu[@]+"${pgCpu[@]}"} ${pgAs[@]+"${pgAs[@]}"} "$pgBin/pg_ctl" -D "$pgDir/data" -l "$pgDir/data/log" -w \
      -o "-c listen_addresses=127.0.0.1 -c port=$pgPort -c unix_socket_directories=$pgDir -c fsync=off -c max_connections=100" \
      start >>"$pgDir.log" 2>&1 || {
      cat "$pgDir.log" >&2
      exit 1
    }
    pgSql -c "create role nish_tfb login password 'nish-tfb'" -c "create database nish_tfb owner nish_tfb"
    # TFB's tables, as its setup scripts load them.
    pgSql -d nish_tfb <<'SQL'
create table world (id integer primary key, randomnumber integer not null default 0);
insert into world select g, floor(random() * 10000 + 1)::integer from generate_series(1, 10000) g;
create table fortune (id integer primary key, message varchar(2048) not null);
insert into fortune values
  (1, 'fortune: No such file or directory'),
  (2, 'A computer scientist is someone who fixes things that aren''t broken.'),
  (3, 'After enough decimal places, nobody gives a damn.'),
  (4, 'A bad random number generator: 1, 1, 1, 1, 1, 4.33e+67, 1, 1, 1'),
  (5, 'A computer program does what you tell it to do, not what you want it to do.'),
  (6, 'Emacs is a nice operating system, but I prefer UNIX. — Tom Christaensen'),
  (7, 'Any program that runs right is obsolete.'),
  (8, 'A list is only as strong as its weakest link. — Donald Knuth'),
  (9, 'Feature: A bug with seniority.'),
  (10, 'Computers make very fast, very accurate mistakes.'),
  (11, '<script>alert("This should not be displayed in a browser alert box.");</script>'),
  (12, 'フレームワークのベンチマーク');
alter table world owner to nish_tfb;
alter table fortune owner to nish_tfb;
SQL
    # One wrapper a contestant, so `start` hands it the HTTP port as the fifth
    # argument: one worker, four Postgres connections, the same for each.
    for out in db-entry db-entry-copy async-db; do
      printf '#!/bin/sh\nexec %s %s nish_tfb nish-tfb nish_tfb "$1" 127.0.0.1 127.0.0.1 1 4\n' \
        "$root/build/tfb/$out" "$pgPort" >"build/tfb/$out.sh"
      chmod +x "build/tfb/$out.sh"
    done
    lineup=("db-entry=build/tfb/db-entry.sh" "db-entry-copy=build/tfb/db-entry-copy.sh" "async-db=build/tfb/async-db.sh")
    clientCpu=(${dbClientCpu[@]+"${dbClientCpu[@]}"})
    threads=$dbThreads
    for path in "${dbPaths[@]}"; do run "$path" "${dbLevels[@]}"; done
    dbRan=1
    pgStop
  fi
fi

# The tables: one row per contestant, one column per concurrency, each cell
# the median and, in brackets, the minimum req/s over the rounds that gave a
# figure; `*` marks a cell with Non-2xx responses or socket errors. $1 is the
# path; $2, $3 and $4 the base, its identical copy and the async twin; then
# `lineup` holds the contestants and the rest of the arguments the
# concurrencies.
report() {
  local path=$1 base=$2 copy=$3 twin=$4
  shift 4
  printf '\n%s, req/s: median (min) of %s round(s) of %s s\n\n' "$path" "$rounds" "$duration"
  printf '| contestant |'
  for level in "$@"; do printf ' %s |' "$level"; done
  printf ' peak RSS, MiB |\n| --- |'
  for _ in "$@"; do printf ' ---: |'; done
  printf ' ---: |\n'
  for entry in "${lineup[@]}"; do
    local name=${entry%%=*}
    grep -q "^$path	[^	]*	$name	" "$results" || continue
    printf '| %s |' "$name"
    for level in "$@"; do
      awk -F'\t' -v p="$path" -v l="$level" -v n="$name" '
        $1 == p && $2 == l && $3 == n {
          if ($5 != 0 || $6 != "0/0/0/0") flag = "*"
          if ($4 != "n/a") v[c++] = $4 + 0; else failed++
        }
        END {
          if (c == 0) { printf " n/a%s |", flag; exit }
          for (i = 0; i < c; i++) for (j = i + 1; j < c; j++) if (v[j] < v[i]) { t = v[i]; v[i] = v[j]; v[j] = t }
          m = c % 2 ? v[(c - 1) / 2] : (v[c / 2 - 1] + v[c / 2]) / 2
          printf " %.0f (%.0f)%s%s |", m, v[0], flag, failed ? " " failed " n/a" : ""
        }' "$results"
    done
    # The largest peak over every concurrency and round.
    awk -F'\t' -v p="$path" -v n="$name" '
      $1 == p && $3 == n && $7 + 0 > top { top = $7 + 0 }
      END { if (top > 0) printf " %.1f |\n", top / 1024; else printf " n/a |\n" }' "$results"
  done
  # The noise band: how far apart the two identical builds' medians are; the
  # async twin is inside it when its median is no further below the base's
  # and none of its rounds at that concurrency had a failure (`*`).
  printf '\nnoise band (|%s - %s| / %s, medians):' "$base" "$copy" "$base"
  local verdict=""
  for level in "$@"; do
    local line
    line=$(awk -F'\t' -v p="$path" -v l="$level" -v b="$base" -v cp="$copy" -v t="$twin" -v up="$cores" '
      function med(a, c,   i, j, t) {
        for (i = 0; i < c; i++) for (j = i + 1; j < c; j++) if (a[j] < a[i]) { t = a[i]; a[i] = a[j]; a[j] = t }
        return c % 2 ? a[(c - 1) / 2] : (a[c / 2 - 1] + a[c / 2]) / 2
      }
      $1 == p && $2 == l && $4 != "n/a" && $3 == b { e[ce++] = $4 + 0 }
      $1 == p && $2 == l && $4 != "n/a" && $3 == cp { f[cf++] = $4 + 0 }
      $1 == p && $2 == l && $4 != "n/a" && $3 == t { g[cg++] = $4 + 0 }
      $1 == p && $2 == l && $3 == t && ($5 != 0 || $6 != "0/0/0/0") { flagged = 1 }
      END {
        if (ce == 0 || cf == 0) { printf "%s: n/a\t%s: n/a", l, l; exit }
        a = med(e, ce); x = med(f, cf)
        if (a == 0) { printf "%s: n/a\t%s: n/a", l, l; exit }
        band = (a > x ? a - x : x - a) * 100 / a
        if (cg == 0) { printf "%s: %.1f%%\t%s: n/a", l, band, l; exit }
        d = (med(g, cg) - a) * 100 / a
        # wrk counts a non-2xx answer in its rate, so a cell with failures
        # can be fast for the wrong reason: it is never called inside.
        # Under --cores-compare the question is a gain, so above the band is `faster`.
        printf "%s: %.1f%%\t%s: %+.1f%% %s", l, band, l, d, (flagged ? (d >= -band ? "unknown*" : "outside*") : (up && d > band ? "faster" : d >= -band ? "inside" : "outside"))
      }' "$results")
    printf ' %s' "${line%%	*}"
    verdict+=" ${line#*	}"
  done
  printf '\n%s vs %s (median delta, inside or outside the band; * had failures, never inside):%s\n' "$twin" "$base" "$verdict"
}

{
  echo "TechEmpower plaintext, json and database tests, $(lscpu | awk -F: '/Model name/ { gsub(/^ +/, "", $2); print $2; exit }'), $cpus CPUs, $(free -g | awk '/^Mem:/ { print $2 }') GiB, $(date -u +%Y-%m-%d)"
  echo "$pinning; client $client -t $httpThreads"
  echo "A relative A/B on one machine, not a TechEmpower rank."
  if [ "$browser" = 1 ]; then echo "Browser head: a browser's request headers, one request at a time on /plaintext and /json."; fi
  lineup=(${contestants[@]+"${contestants[@]}"})
  twin=async
  [ "$cores" = 1 ] && twin=entry-cores
  if wants plaintext; then report /plaintext entry entry-copy "$twin" "${plainLevels[@]}"; fi
  if wants json; then
    report /json entry entry-copy "$twin" "${jsonLevels[@]}"
    [ "$cores" = 1 ] || echo 'The twins answer /json with {"message":"Hello, World!","n":<n>}: 8 bytes more than the entry, and a counter.'
  fi
  if [ "$dbRan" = 1 ]; then
    echo
    echo "Database tests: $dbPinning; client $client -t $dbThreads; one worker and 4 Postgres connections each"
    lineup=("db-entry=" "db-entry-copy=" "async-db=")
    for path in "${dbPaths[@]}"; do report "$path" db-entry db-entry-copy async-db "${dbLevels[@]}"; done
  fi
  for note in ${notes[@]+"${notes[@]}"}; do echo "note: $note"; done
} | tee build/tfb/results.md
