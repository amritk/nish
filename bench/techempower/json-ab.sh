#!/usr/bin/env bash
# Times the explicit TechEmpower entry's /json against builds of other trees,
# interleaved in one run, so a change in the library is read against machine
# drift that run.sh cannot separate from it when two trees run one after the
# other.
#
#   bash bench/techempower/json-ab.sh --base b49794d8
#   bash bench/techempower/json-ab.sh --no-keep-head --rounds 8 --duration 10
#   bash bench/techempower/json-ab.sh --cells "explicit:128 browser:256"
#
# The contestants, each bench/techempower/main.ts built with --profile speed by
# the same compiler (build/nish, or $NISH):
#
#   entry, entry-copy   the working tree, built twice; `cmp` must find them
#                       identical, and the spread between them is the band
#   base                with --base REV: the std/, runtime/, scripts/ and
#                       bench/techempower of REV (`git archive`), so it differs
#                       from entry only in the library, the runtime, its link
#                       script and the entry, not in the compiler
#   nokeep              with --no-keep-head: the working tree with
#                       std/net/http1-server.ts's H1_HEAD_KEEP set to 0, which
#                       turns the kept response head off
#
# A cell is a head and a connection count: `explicit` is run.sh's three TFB
# headers, `browser` its --browser-head set. Each cell runs --rounds rounds
# (default 8), each round every contestant once in an order rotated by one,
# a fresh server each time on CPU 0, warmed for 1 s with wrk, then wrk -t 3
# for --duration seconds (default 10) on CPUs 1-3, one request at a time.
# Server CPU per request is its utime + stime from /proc over the responses
# wrk counted. Raw rows go to build/tfb/json-ab.tsv; the report gives each
# contestant's median req/s and µs per request, the change against entry, and
# the rounds it beat entry in. The band is |entry-copy - entry| / entry of the
# medians. A round with a socket error or a non-2xx answer is listed in the
# notes and left out of the medians.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
cd "$root"

rounds=8
duration=10
base=""
nokeep=0
cells=(explicit:128 explicit:256 explicit:512 browser:256)
while [ $# -gt 0 ]; do
  case $1 in
    --rounds | --duration)
      case ${2:-} in '' | *[!0-9]* | 0) echo "json-ab.sh: $1 takes a positive whole number, not '${2:-}'" >&2; exit 2 ;; esac
      if [ "$1" = --rounds ]; then rounds=$2; else duration=$2; fi
      shift
      ;;
    --base)
      base=${2:-}
      [ -n "$base" ] || { echo "json-ab.sh: --base takes a revision" >&2; exit 2; }
      shift
      ;;
    --no-keep-head) nokeep=1 ;;
    --cells)
      [ -n "${2:-}" ] || { echo "json-ab.sh: --cells takes a list such as \"explicit:128 browser:256\"" >&2; exit 2; }
      read -r -a cells <<<"$2"
      shift
      ;;
    -h | --help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    *) echo "json-ab.sh: unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done
for cell in "${cells[@]}"; do
  case $cell in explicit:[1-9]* | browser:[1-9]*) ;; *) echo "json-ab.sh: a cell is explicit:N or browser:N, not $cell" >&2; exit 2 ;; esac
done
command -v wrk >/dev/null || { echo "json-ab.sh: needs wrk" >&2; exit 1; }
[ "$(nproc)" -ge 4 ] || { echo "json-ab.sh: needs 4 CPUs: the server on 0, wrk on 1-3" >&2; exit 1; }
ulimit -n "$(ulimit -Hn)" 2>/dev/null || true

nish=$(cd "$(dirname "${NISH:-build/nish}")" && pwd)/$(basename "${NISH:-build/nish}")
[ -x "$nish" ] || npm run build
. "$root/scripts/nish-compiler.sh"
nish_allow_panics "$nish"
mkdir -p build/tfb
# Builds bench/techempower/main.ts in tree $1 (with the compiler copied into
# its build/, so it reads that tree's std/) into build/tfb/$2.
build() {
  local tree=$1 out=$root/build/tfb/$2 cc=$nish
  if [ "$tree" != "$root" ]; then
    mkdir -p "$tree/build"
    cp "$nish" "$tree/build/nish"
    cc=$tree/build/nish
  fi
  (cd "$tree" && "$cc" ${allow_panics[@]+"${allow_panics[@]}"} bench/techempower/main.ts --link "$out" --profile speed) \
    >build/tfb/compile.log 2>&1 || {
    cat build/tfb/compile.log >&2
    exit 1
  }
}
# A copy of the std/, runtime/, scripts/ and bench/techempower named by $2 in
# build/tfb/$1: a revision, or `.` for the working tree. scripts/ comes along
# because --link runs the build.sh beside the compiler, and only that tree's
# build.sh knows that tree's runtime/ files.
tree() {
  local dir=$root/build/tfb/$1
  rm -rf "$dir"
  mkdir -p "$dir"
  if [ "$2" = . ]; then
    mkdir -p "$dir/bench"
    cp -r std runtime scripts "$dir/"
    cp -r bench/techempower "$dir/bench/"
  else
    git archive "$2" std runtime scripts bench/techempower | tar -x -C "$dir"
  fi
}

names=(entry entry-copy)
build "$root" entry
build "$root" entry-copy
cmp build/tfb/entry build/tfb/entry-copy || {
  echo "json-ab.sh: two builds of bench/techempower/main.ts differ, so there is no noise band" >&2
  exit 1
}
if [ -n "$base" ]; then
  git cat-file -e "$base^{commit}" 2>/dev/null || { echo "json-ab.sh: no commit $base here (git fetch --deepen?)" >&2; exit 1; }
  tree ab-base "$base"
  build "$root/build/tfb/ab-base" base
  names+=(base)
fi
if [ "$nokeep" = 1 ]; then
  tree ab-nokeep .
  f=build/tfb/ab-nokeep/std/net/http1-server.ts
  grep -q '^const H1_HEAD_KEEP: i32 = [0-9]*$' "$f" || {
    echo "json-ab.sh: std/net/http1-server.ts has no H1_HEAD_KEEP line to set" >&2
    exit 1
  }
  sed -i 's/^const H1_HEAD_KEEP: i32 = [0-9]*$/const H1_HEAD_KEEP: i32 = 0/' "$f"
  build "$root/build/tfb/ab-nokeep" nokeep
  names+=(nokeep)
fi

explicit=(-H "Host: tfb-server" -H "Connection: keep-alive"
  -H "Accept: text/plain,text/html;q=0.9,application/xhtml+xml;q=0.9,application/xml;q=0.8,*/*;q=0.7")
browser=(-H "Host: tfb-server" -H "Connection: keep-alive"
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
  -H "Accept-Language: en-GB,en-US;q=0.9,en;q=0.8"
  -H "Accept-Encoding: gzip, deflate, br, zstd"
  -H "Cookie: session=8f3a9c2e7b1d4f6a0e5c9b2d7f1a3e6c; csrftoken=Qm9vZ2llV29vZ2llQm9vZ2llV29vZ2llQm9v; _ga=GA1.1.1234567890.1731300000; _ga_XYZ123=GS1.1.1731300000.4.1.1731300456.0.0.0; theme=dark; lang=en"
  -H "Referer: https://tfb-server/"
  -H "Upgrade-Insecure-Requests: 1"
  -H "Sec-Fetch-Dest: document" -H "Sec-Fetch-Mode: navigate" -H "Sec-Fetch-Site: same-origin")

tsv=build/tfb/json-ab.tsv
notes=build/tfb/json-ab.notes
printf 'head\tconnections\tround\tcontestant\treq/s\tserver µs/req\tclean\n' >"$tsv"
: >"$notes"
hz=$(getconf CLK_TCK)
port=19000
log=build/tfb/json-ab-server.log
pid=""
trap '[ -z "$pid" ] || kill "$pid" 2>/dev/null || true' EXIT
for cell in "${cells[@]}"; do
  kind=${cell%%:*}
  c=${cell#*:}
  if [ "$kind" = browser ]; then hdr=("${browser[@]}"); else hdr=("${explicit[@]}"); fi
  for r in $(seq "$rounds"); do
    n=${#names[@]}
    for k in $(seq 0 $((n - 1))); do
      name=${names[$(((k + r - 1) % n))]}
      port=$((port + 1))
      : >"$log"
      taskset -c 0 "build/tfb/$name" "$port" >>"$log" 2>&1 &
      pid=$!
      for _ in $(seq 100); do grep -q listening "$log" && break; sleep 0.1; done
      grep -q listening "$log" || { echo "json-ab.sh: $name did not start" >&2; cat "$log" >&2; exit 1; }
      taskset -c 1-3 wrk -t 3 -c "$c" -d 1s --timeout 8 "${hdr[@]}" "http://127.0.0.1:$port/json" >/dev/null 2>&1 || true
      t0=$(awk '{ print $14 + $15 }' "/proc/$pid/stat")
      out=$(taskset -c 1-3 wrk -t 3 -c "$c" -d "${duration}s" --timeout 8 "${hdr[@]}" "http://127.0.0.1:$port/json" 2>&1) || true
      t1=$(awk '{ print $14 + $15 }' "/proc/$pid/stat")
      # The server can have died during the run; its log and the empty
      # figure below report that, so a failed kill does not end the script.
      kill -TERM "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      pid=""
      rps=$(awk '/^Requests\/sec:/ { print $2 }' <<<"$out")
      reqs=$(awk '/ requests in / { print $1 }' <<<"$out")
      clean=1
      if [ -z "$rps" ] || [ -z "$reqs" ] || [ "$reqs" = 0 ]; then
        echo "$cell round $r $name: wrk gave no figure" >>"$notes"
        continue
      fi
      if grep -qE 'Socket errors|Non-2xx' <<<"$out"; then
        clean=0
        grep -E 'Socket errors|Non-2xx' <<<"$out" | sed "s/^ */$cell round $r $name: /" >>"$notes"
      fi
      us=$(awk -v a="$t0" -v b="$t1" -v n="$reqs" -v hz="$hz" 'BEGIN { printf "%.3f", (b - a) / hz * 1e6 / n }')
      printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$kind" "$c" "$r" "$name" "$rps" "$us" "$clean" >>"$tsv"
    done
  done
done

echo "json-ab.sh: $rounds rounds of ${duration}s, contestants ${names[*]}; server on CPU 0, wrk -t 3 on CPUs 1-3; $(git rev-parse --short=8 HEAD)${base:+, base $base}"
node - "$tsv" <<'EOF'
const fs = require("node:fs")
const rows = fs.readFileSync(process.argv[2], "utf8").trim().split("\n").slice(1).map((l) => l.split("\t"))
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length === 0 ? NaN : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const pct = (from, to) => `${to >= from ? "+" : ""}${((100 * (to - from)) / from).toFixed(1)}%`
const cells = [...new Set(rows.map((r) => `${r[0]} ${r[1]}`))]
for (const cell of cells) {
  const mine = rows.filter((r) => `${r[0]} ${r[1]}` === cell && r[6] === "1")
  const names = [...new Set(mine.map((r) => r[3]))]
  const of = (name) => mine.filter((r) => r[3] === name)
  const entry = of("entry")
  const eRps = median(entry.map((r) => Number(r[4])))
  const eUs = median(entry.map((r) => Number(r[5])))
  const byRound = new Map(entry.map((r) => [r[2], Number(r[4])]))
  const copy = median(of("entry-copy").map((r) => Number(r[4])))
  console.log(`\n${cell} connections, band ±${((100 * Math.abs(copy - eRps)) / eRps).toFixed(1)}%`)
  console.log("contestant   rounds   median req/s   change   median µs/req   change   beat entry")
  for (const name of names) {
    const rs = of(name)
    const rps = median(rs.map((r) => Number(r[4])))
    const us = median(rs.map((r) => Number(r[5])))
    const paired = rs.filter((r) => byRound.has(r[2]))
    const won = paired.filter((r) => Number(r[4]) > byRound.get(r[2])).length
    console.log(
      [
        name.padEnd(12),
        String(rs.length).padStart(6),
        rps.toFixed(0).padStart(14),
        (name === "entry" ? "" : pct(eRps, rps)).padStart(8),
        us.toFixed(3).padStart(15),
        (name === "entry" ? "" : pct(eUs, us)).padStart(8),
        (name === "entry" ? "" : `${won} of ${paired.length}`).padStart(12),
      ].join(" ")
    )
  }
}
EOF
if [ -s "$notes" ]; then
  echo
  echo "notes (left out of the medians):"
  cat "$notes"
fi
