#!/usr/bin/env bash
# Hardware counters for a set of pids over a window, as one JSON object.
#
#   perf-stat.sh stat <seconds> <pid,pid,...>            # counts -> stdout JSON
#   perf-stat.sh record <seconds> <pid,pid,...> <out>    # perf record -g -> <out>, summary JSON
#   perf-stat.sh events                                  # which events this machine counts
#
# Events: cycles and instructions split user (:u) and kernel (:k), L1 data
# misses (L1-dcache-load-misses), and a last-level miss event. The generic
# LLC-load-misses is not counted on every core (Neoverse on the arm runner is
# one), so the first of these that `perf list` offers is used and named in the
# output: LLC-load-misses, ll_cache_miss_rd, l3d_cache_refill, ll_cache_rd.
# A machine with no PMU (most VMs) exits 3 with {"error": ...}: its figures
# come from the substitutes README.md names.
set -euo pipefail
PERF="${PERF_BIN:-perf}"

no_pmu() {
  printf '{"error":"%s"}\n' "$1"
  exit 3
}

command -v "$PERF" > /dev/null || no_pmu "no perf binary"

ll_event() {
  local list e
  list="$("$PERF" list 2> /dev/null || true)"
  for e in LLC-load-misses ll_cache_miss_rd l3d_cache_refill ll_cache_rd; do
    if grep -qw -- "$e" <<< "$list"; then
      # A generic event can be listed and still not count; try it.
      if "$PERF" stat -x, -e "$e" -- true 2>&1 | grep -q "not supported\|not counted"; then continue; fi
      echo "$e"
      return
    fi
  done
}

events() {
  local ll
  ll="$(ll_event)"
  echo "cycles:u,cycles:k,instructions:u,instructions:k,L1-dcache-load-misses${ll:+,$ll:u,$ll:k}"
}

cmd_stat() {
  local secs="$1" pids="$2" ev out
  ev="$(events)"
  out="$(mktemp)"
  "$PERF" stat -x, -e "$ev" -p "$pids" -o "$out" -- sleep "$secs" > /dev/null 2>&1 || true
  if ! grep -q "instructions" "$out"; then
    cat "$out" >&2
    rm -f "$out"
    no_pmu "perf stat counted nothing"
  fi
  # CSV: value,unit,event,run-time,percent-enabled,...
  node -e '
    const fs = require("fs")
    const counts = {}, notCounted = [], enabled = {}
    for (const l of fs.readFileSync(process.argv[1], "utf8").split("\n")) {
      if (!l || l.startsWith("#")) continue
      const f = l.split(",")
      if (f.length < 3) continue
      if (/not (counted|supported)/.test(f[0])) { notCounted.push(f[2]); continue }
      counts[f[2]] = Number(f[0])
      enabled[f[2]] = Number(f[4])
    }
    console.log(JSON.stringify({ source: "perf stat (hardware counters)", seconds: Number(process.argv[2]),
      events: process.argv[3].split(","), counts, percent_enabled: enabled, not_counted: notCounted }))
  ' "$out" "$secs" "$ev"
  rm -f "$out"
}

cmd_record() {
  local secs="$1" pids="$2" data="$3"
  "$PERF" record -q -g -F 999 -p "$pids" -o "$data" -- sleep "$secs" > /dev/null 2>&1 \
    || no_pmu "perf record failed"
  # Self time by symbol, user and kernel, for the report.
  "$PERF" report -i "$data" --no-children --sort sym --stdio -q 2> /dev/null \
    | awk 'NF >= 3 && $1 ~ /%$/ { pct = $1; sub(/%/, "", pct); $1 = ""; sub(/^ +/, ""); printf "%s\t%s\n", pct, $0 }' \
    | head -60 > "$data.top"
  node -e '
    const fs = require("fs")
    const top = fs.readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean).map((l) => {
      const [pct, sym] = l.split("\t"); return { pct: Number(pct), sym } })
    console.log(JSON.stringify({ source: "perf record -g (hardware cycles sampling)", seconds: Number(process.argv[2]), top }))
  ' "$data.top" "$secs"
}

case "${1:-}" in
  stat) cmd_stat "$2" "$3" ;;
  record) cmd_record "$2" "$3" "$4" ;;
  events) events ;;
  *) sed -n '2,15p' "$0"; exit 2 ;;
esac
