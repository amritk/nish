#!/usr/bin/env bash
# Profiles the async TechEmpower entries against the explicit ones, one test at
# one concurrency each, so a fix can be checked against the same profile:
#
#   plaintext  main.ts against async-main.ts, 256 connections, 16 pipelined
#   json       main.ts against async-main.ts, 64 connections
#   db         db-main.ts against async-db-main.ts on /db, 64 connections,
#              against one throwaway local Postgres
#
#   bash bench/techempower/profile.sh                  every test
#   bash bench/techempower/profile.sh --only json      one test
#   bash bench/techempower/profile.sh --seconds 10 --callgrind-seconds 20 --top 30
#
# Each test runs three phases, and each phase runs the explicit entry and then
# the async one, interleaved, a fresh server each time, pinned and warmed as
# run.sh does:
#
#   perf       `perf record -e cpu-clock:u` (the software clock; this VM has no
#              hardware counters) while wrk runs at full speed: the top user-space
#              frames by self samples, the user and system CPU seconds the server
#              used per request (from /proc/<pid>/stat), and the req/s
#   strace     `strace -c -f` attached for one wrk run: system calls per request
#   callgrind  the server under `valgrind --tool=callgrind --instr-atstart=no`,
#              instrumented only for one wrk run (`callgrind_control -i on`, then
#              off): instructions (Ir) per request, which hold across machines
#              and noise, and the top frames by self Ir per request
#
# A per-request figure divides by the responses wrk counted in that window.
# The window also counts the work on requests wrk sent but did not see answered
# when it stopped: at most connections x pipeline depth of them (4,096 for
# plaintext, 64 for json and db), the same bound on both entries.
#
# Output goes to build/tfb/profile/: one directory per test with each phase's
# raw files and its summary.md, and summary.md, every test's tables; a run with
# --only replaces that test's directory and keeps the others. The server runs on
# CPU 0, Postgres on CPU 1, wrk on the rest. Needs wrk, strace, valgrind and
# perf (`perf` on PATH, $PERF, or /usr/lib/linux-tools-*/perf); the db test
# needs Postgres binaries (newest /usr/lib/postgresql/*/bin, or $PG_BIN).
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
cd "$root"

only=""
seconds=5
cgSeconds=10
top=20
while [ $# -gt 0 ]; do
  case $1 in
    --only)
      only=${2:-}
      shift
      case $only in plaintext | json | db) ;; *) echo "profile.sh: --only takes plaintext, json or db, not $only" >&2; exit 2 ;; esac
      ;;
    --seconds | --callgrind-seconds | --top)
      case ${2:-} in '' | *[!0-9]* | 0) echo "profile.sh: $1 takes a positive whole number, not '${2:-}'" >&2; exit 2 ;; esac
      case $1 in --seconds) seconds=$2 ;; --callgrind-seconds) cgSeconds=$2 ;; *) top=$2 ;; esac
      shift
      ;;
    -h | --help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    *) echo "profile.sh: unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done
wants() { [ -z "$only" ] || [ "$only" = "$1" ]; }

perf=${PERF:-$(command -v perf || true)}
# Ubuntu's /usr/bin/perf is a wrapper that refuses a kernel it has no tools for.
if [ -z "$perf" ] || ! "$perf" --version >/dev/null 2>&1; then
  perf=$(find /usr/lib -maxdepth 2 -path '/usr/lib/linux-tools*/perf' -type f 2>/dev/null | sort -V | tail -n 1)
fi
for tool in wrk strace valgrind callgrind_control callgrind_annotate "$perf"; do
  command -v "$tool" >/dev/null || {
    echo "profile.sh: ${tool:-perf} is not installed (perf: apt-get install linux-tools-generic)" >&2
    exit 1
  }
done
[ "$(nproc)" -ge 4 ] || { echo "profile.sh: needs 4 CPUs (server, Postgres, client)" >&2; exit 1; }
cpus=$(nproc)
ulimit -n "$(ulimit -Hn)" 2>/dev/null || true

out=build/tfb/profile
mkdir -p "$out"
for test in plaintext json db; do
  if wants "$test"; then rm -rf "${out:?}/$test"; fi
done
# The builds, as run.sh makes them plus `-g`, which keeps the symbols the
# speed profile strips; they go to build/tfb/profile, not over run.sh's.
nish=${NISH:-build/nish}
[ -x "$nish" ] || npm run build
build() {
  "$nish" "bench/techempower/$1" --link "$out/$2" --profile speed -g >"$out/compile.log" 2>&1 || {
    cat "$out/compile.log" >&2
    exit 1
  }
}

port=18180
log=$out/server.log
pid=""
stop() {
  if [ -n "$pid" ]; then
    kill -TERM "$pid" 2>/dev/null || true
    for _ in $(seq 100); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.1
    done
    kill -KILL "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    pid=""
  fi
}

# The db test's cluster, stopped with the server on any exit: the trap is set
# before the first server starts, so a failure anywhere leaks neither.
pgDir=$root/build/tfb/profile-pg
pgPort=15433
pgAs=()
pgBin=""
pgStop() {
  if [ -n "$pgBin" ] && [ -f "$pgDir/data/postmaster.pid" ]; then
    ${pgAs[@]+"${pgAs[@]}"} "$pgBin/pg_ctl" -D "$pgDir/data" -m immediate stop >/dev/null 2>&1 || true
  fi
}
trap 'stop; pgStop' EXIT

# Starts `$@` (the command, then its arguments, the port last) on CPU 0 with a
# fresh port; false when it never says `listening`. Under valgrind the wait is
# longer.
start() {
  : >"$log"
  taskset -c 0 "$@" >>"$log" 2>&1 &
  pid=$!
  for _ in $(seq 600); do
    grep -q listening "$log" && return 0
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.1
  done
  cat "$log" >&2
  stop
  return 1
}

# One wrk run: $1 the path, $2 connections, $3 seconds; the client on $clientCpus.
# Prints wrk's output.
drive() {
  local args=(-t "$threads" -c "$2" -d "${3}s" --timeout 8 -H "Host: tfb-server" -H "Connection: keep-alive"
    -H "Accept: text/plain,text/html;q=0.9,application/xhtml+xml;q=0.9,application/xml;q=0.8,*/*;q=0.7")
  local url="http://127.0.0.1:$port$1"
  if [ "$1" = /plaintext ]; then
    taskset -c "$clientCpus" wrk "${args[@]}" -s "$here/pipeline.lua" "$url" -- 16 2>&1
  else
    taskset -c "$clientCpus" wrk "${args[@]}" "$url" 2>&1
  fi
}
# The responses a wrk output counted, and whether it saw errors.
answered() { awk '/ requests in / { print $1 }' "$1"; }
clean() { ! grep -qE 'Non-2xx|Socket errors' "$1"; }
# The server's user and system CPU ticks so far, summed.
ticks() { awk '{ print $14 + $15 }' "/proc/$1/stat"; }

# One phase (perf, strace or callgrind) of one side of one test: $1 phase, $2
# test, $3 side (explicit or async), $4 path, $5 connections, then the command
# without its port.
profilePhase() {
  local phase=$1 test=$2 side=$3 path=$4 conns=$5
  shift 5
  local dir=$out/$test/$side
  mkdir -p "$dir"
  local hz reqs
  hz=$(getconf CLK_TCK)

  case $phase in
    # Samples and CPU time, at full speed.
    perf)
      port=$((port + 1))
      start "$@" "$port" || { echo "profile.sh: $test $side did not start" >&2; exit 1; }
      drive "$path" "$conns" 1 >/dev/null
      local t0
      t0=$(ticks "$pid")
      "$perf" record -q -e cpu-clock:u -F 2999 -g -p "$pid" -o "$dir/perf.data" -- sleep $((seconds + 1)) 2>/dev/null &
      local recorder=$!
      drive "$path" "$conns" "$seconds" >"$dir/perf.wrk"
      local t1
      t1=$(ticks "$pid")
      wait "$recorder" || true
      stop
      "$perf" report -i "$dir/perf.data" --no-children --fields overhead,dso,sym --stdio -g none 2>/dev/null |
        awk -v top="$top" '!/^#/ && NF && k++ < top' >"$dir/perf.top"
      reqs=$(answered "$dir/perf.wrk")
      printf '%s\t%s\t%s\t%s\n' "$reqs" "$(awk '/^Requests\/sec:/ { print $2 }' "$dir/perf.wrk")" \
        "$(awk -v a="$t0" -v b="$t1" -v hz="$hz" -v n="$reqs" 'BEGIN { printf "%.2f", (b - a) / hz * 1e6 / n }')" \
        "$(clean "$dir/perf.wrk" && echo clean || echo errors)" >"$dir/perf.tsv"
      ;;

    # System calls per request.
    strace)
      port=$((port + 1))
      start "$@" "$port" || exit 1
      drive "$path" "$conns" 1 >/dev/null
      strace -c -f -p "$pid" -o "$dir/strace.txt" &
      local tracer=$!
      sleep 0.5
      drive "$path" "$conns" "$seconds" >"$dir/strace.wrk"
      kill -INT "$tracer"
      wait "$tracer" || true
      stop
      awk -v n="$(answered "$dir/strace.wrk")" '
        $NF == "total" { printf "%.3f\n", $(NF - 2) / n; exit }' "$dir/strace.txt" >"$dir/strace.per-request"
      ;;

    # Instructions per request.
    callgrind)
      port=$((port + 1))
      start valgrind --tool=callgrind --instr-atstart=no --callgrind-out-file="$dir/callgrind.out" "$@" "$port" ||
        exit 1
      drive "$path" "$conns" 2 >/dev/null
      callgrind_control -i on "$pid" >/dev/null
      drive "$path" "$conns" "$cgSeconds" >"$dir/callgrind.wrk"
      callgrind_control -i off "$pid" >/dev/null
      stop
      reqs=$(answered "$dir/callgrind.wrk")
      callgrind_annotate --auto=no --inclusive=no --threshold=100 "$dir/callgrind.out" 2>/dev/null >"$dir/callgrind.self"
      callgrind_annotate --auto=no --inclusive=yes --threshold=100 "$dir/callgrind.out" 2>/dev/null >"$dir/callgrind.inclusive"
      awk -v n="$reqs" '/PROGRAM TOTALS/ { gsub(",", "", $1); printf "%.0f\n", $1 / n; exit }' \
        "$dir/callgrind.self" >"$dir/callgrind.per-request"
      echo "$reqs" >"$dir/callgrind.requests"
      ;;
  esac
}

# Every phase of one test, the explicit side then the async one in each: $1
# test, $2 path, $3 connections; the commands are in explicitCmd and asyncCmd.
profileTest() {
  local phase
  for phase in perf strace callgrind; do
    profilePhase "$phase" "$1" explicit "$2" "$3" "${explicitCmd[@]}"
    profilePhase "$phase" "$1" async "$2" "$3" "${asyncCmd[@]}"
  done
}

# summary.md's rows for one test.
report() {
  local test=$1 title=$2
  {
    printf '\n### %s\n\n%s\n\n' "$title" "$machine"
    printf '| | explicit | async |\n| --- | ---: | ---: |\n'
    local row
    for row in "Ir per request (callgrind)|callgrind.per-request|1" \
      "responses in the callgrind window|callgrind.requests|1" \
      "system calls per request (strace -c)|strace.per-request|1" \
      "req/s under perf|perf.tsv|2" \
      "server CPU µs per request, user + system (/proc)|perf.tsv|3" \
      "wrk errors in the perf run|perf.tsv|4"; do
      IFS='|' read -r label file field <<<"$row"
      printf '| %s | %s | %s |\n' "$label" \
        "$(cut -f "$field" "$out/$test/explicit/$file")" "$(cut -f "$field" "$out/$test/async/$file")"
    done
    for side in explicit async; do
      printf '\n%s, top %s frames by self Ir per request (callgrind):\n\n```text\n' "$side" "$top"
      local n
      n=$(cat "$out/$test/$side/callgrind.requests")
      # callgrind_annotate splits a function across the files its inlined
      # lines came from; sum them back under the function's name.
      awk -v n="$n" '
        /^ *[0-9,]+ +\( *[0-9.]+%\) +/ && !/PROGRAM TOTALS/ {
          ir = $1; gsub(",", "", ir)
          fn = $0; sub(/^[^)]*\) +/, "", fn); sub(/ \[[^]]*\]$/, "", fn); sub(/^[^:]*:/, "", fn)
          sum[fn] += ir
        }
        END { for (fn in sum) printf "%10.1f  %s\n", sum[fn] / n, fn }' "$out/$test/$side/callgrind.self" |
        sort -rn | awk -v top="$top" 'k++ < top'
      printf '```\n\n%s, top %s user-space frames by self samples (perf, cpu-clock:u):\n\n```text\n' "$side" "$top"
      cat "$out/$test/$side/perf.top"
      printf '```\n'
    done
  } >"$out/$test/summary.md"
}

machine="$(lscpu | awk -F: '/Model name/ { gsub(/^ +/, "", $2); print $2; exit }'), $cpus CPUs, $(date -u +%Y-%m-%d), $(git rev-parse --short HEAD)"
machine+="; $("$perf" --version), $(valgrind --version), wrk $({ wrk -v 2>&1 || true; } | awk 'NR == 1 { print $2 }')"
machine+="; phases of $seconds s (perf, strace) and $cgSeconds s (callgrind)"

threads=$((cpus - 1 > 16 ? 16 : cpus - 1))
clientCpus="1-$((cpus - 1))"
if wants plaintext || wants json; then
  build main.ts entry
  build async-main.ts async
  explicitCmd=("$out/entry")
  asyncCmd=("$out/async")
fi
if wants plaintext; then
  profileTest plaintext /plaintext 256
  report plaintext "/plaintext, 256 connections, 16 pipelined"
fi
if wants json; then
  profileTest json /json 64
  report json "/json, 64 connections"
fi

# The db test, against a cluster set up as run.sh sets its up.
if wants db; then
  pgBin=${PG_BIN:-$(find /usr/lib/postgresql -maxdepth 2 -name bin -type d 2>/dev/null | sort -V | tail -n 1)}
  [ -n "$pgBin" ] && [ -x "$pgBin/initdb" ] || { echo "profile.sh: no Postgres binaries (set PG_BIN)" >&2; exit 1; }
  build db-main.ts db-entry
  build async-db-main.ts async-db
  [ "$(id -u)" = 0 ] && pgAs=(runuser -u postgres --)
  rm -rf "$pgDir"
  mkdir -p "$pgDir"
  [ "$(id -u)" = 0 ] && chown postgres: "$pgDir"
  ${pgAs[@]+"${pgAs[@]}"} "$pgBin/initdb" -D "$pgDir/data" -U postgres --auth=trust -E UTF8 --no-locale >"$pgDir.log" 2>&1
  printf 'local all postgres trust\nhost all all 127.0.0.1/32 scram-sha-256\n' >"$pgDir/data/pg_hba.conf"
  taskset -c 1 ${pgAs[@]+"${pgAs[@]}"} "$pgBin/pg_ctl" -D "$pgDir/data" -l "$pgDir/data/log" -w \
    -o "-c listen_addresses=127.0.0.1 -c port=$pgPort -c unix_socket_directories=$pgDir -c fsync=off -c max_connections=100" \
    start >>"$pgDir.log" 2>&1
  psql=("$pgBin/psql" -h "$pgDir" -p "$pgPort" -U postgres -qAt -v ON_ERROR_STOP=1)
  ${pgAs[@]+"${pgAs[@]}"} "${psql[@]}" -c "create role nish_tfb login password 'nish-tfb'" -c "create database nish_tfb owner nish_tfb"
  # TFB's tables, as run.sh loads them: the entries prepare every statement at
  # start, fortune's included, though /db reads only world.
  ${pgAs[@]+"${pgAs[@]}"} "${psql[@]}" -d nish_tfb <<'SQL'
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
alter table fortune owner to nish_tfb;
alter table world owner to nish_tfb;
SQL
  threads=$((cpus - 2 > 16 ? 16 : cpus - 2))
  clientCpus="2-$((cpus - 1))"
  # One worker and four Postgres connections, the port last, as run.sh's wrappers.
  explicitCmd=("$out/db-entry" "$pgPort" nish_tfb nish-tfb nish_tfb)
  asyncCmd=("$out/async-db" "$pgPort" nish_tfb nish-tfb nish_tfb)
  profileTest db /db 64
  report db "/db, 64 connections, one worker and 4 Postgres connections"
fi
{
  echo "# The async TFB entries against the explicit ones, profiled"
  for test in plaintext json db; do
    if [ -f "$out/$test/summary.md" ]; then cat "$out/$test/summary.md"; fi
  done
} >"$out/summary.md"
echo "profile.sh: wrote $out/summary.md" >&2
