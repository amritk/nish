#!/usr/bin/env bash
# What a system call's entry and exit cost on this box, against the TCP work a
# keep-alive request does. See bench/README.md, "Syscall cost".
#
#   bash bench/syscall-cost/run.sh [--quick] [--rounds n] [--calls n] [--cpu n]
#                                  [--server-rounds n] [--duration s] [--entry-only]
#
# Builds entry.c with the system cc at -O2, prints the box (CPU, kernel, VM or
# bare metal, the kernel's mitigations), then runs it pinned to one CPU and
# prints its table in ns per call. It then builds bench/http1-server.ts and a
# byte-identical copy, counts each keep-alive scenario's syscalls a request
# with bench/http.mjs --syscalls, times both builds in one interleaved
# bench/http.mjs session, and splits each scenario's system CPU a request into
# syscall entry and exit, (a) = syscalls x getppid's median, and the rest, (b).
# The copy's distance from the build is the noise band. --quick is 3 rounds of
# 10^5 calls and 1 server round of 2 s; the default is 7 rounds of 10^6 and 5
# server rounds of 5 s. --entry-only stops after the entry table and gives the
# split for the reported workload's mix only. The server part needs node, wrk,
# strace and build/nish (npm run build).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
rounds=7
calls=1000000
cpu=0
server_rounds=5
duration=5
entry_only=""
usage() {
  echo "usage: bash bench/syscall-cost/run.sh [--quick] [--rounds n] [--calls n] [--cpu n] [--server-rounds n] [--duration s] [--entry-only]" >&2
  exit 2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --quick) rounds=3; calls=100000; server_rounds=1; duration=2 ;;
    --rounds) [ $# -ge 2 ] || usage; rounds="$2"; shift ;;
    --calls) [ $# -ge 2 ] || usage; calls="$2"; shift ;;
    --cpu) [ $# -ge 2 ] || usage; cpu="$2"; shift ;;
    --server-rounds) [ $# -ge 2 ] || usage; server_rounds="$2"; shift ;;
    --duration) [ $# -ge 2 ] || usage; duration="$2"; shift ;;
    --entry-only) entry_only=1 ;;
    -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "run.sh: unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done

if [ -z "$entry_only" ]; then
  for tool in node wrk strace; do
    command -v "$tool" >/dev/null 2>&1 || { echo "run.sh: $tool is not installed (or pass --entry-only)" >&2; exit 2; }
  done
  [ -x "$root/build/nish" ] || { echo "run.sh: build/nish is missing: run npm run build first (or pass --entry-only)" >&2; exit 2; }
fi

out="$root/build/syscall-cost"
mkdir -p "$out"
cc -O2 -o "$out/entry" "$here/entry.c"

echo "## The box"
echo
echo "- CPU: $(grep -m1 'model name' /proc/cpuinfo | sed 's/.*: //'), $(nproc) logical"
echo "- Kernel: $(uname -srm)"
virt="bare metal (no hypervisor flag in /proc/cpuinfo)"
if grep -qw hypervisor /proc/cpuinfo; then
  virt="virtual machine (hypervisor flag in /proc/cpuinfo)"
  if command -v systemd-detect-virt >/dev/null 2>&1; then
    kind="$(systemd-detect-virt --vm 2>/dev/null || true)"
    [ -n "$kind" ] && [ "$kind" != none ] && virt="virtual machine: $kind"
  fi
fi
echo "- Machine: $virt"
cmdline_mitigations="$(grep -o 'mitigations=[^ ]*' /proc/cmdline 2>/dev/null || true)"
echo "- Kernel command line: ${cmdline_mitigations:-no mitigations= given}"
echo "- /sys/devices/system/cpu/vulnerabilities:"
for f in /sys/devices/system/cpu/vulnerabilities/*; do
  [ -r "$f" ] && echo "  - $(basename "$f"): $(cat "$f")"
done
echo "- Pinned to CPU $cpu; $(cc --version | head -n1), -O2"
echo

pin=()
if command -v taskset >/dev/null 2>&1; then
  pin=(taskset -c "$cpu")
else
  echo "(taskset not found: running unpinned)"
fi
"${pin[@]}" "$out/entry" --rounds "$rounds" --calls "$calls" | tee "$out/table.txt"

entry_ns="$(sed -n 's/^entry_ns=//p' "$out/table.txt")"

# The server: the syscalls a request from strace, the system CPU a request
# from one timed session of both builds.
if [ -z "$entry_only" ]; then
  cd "$root"
  # A bench program, so its build takes `--allow-panics` from a compiler that lists it.
  . scripts/nish-compiler.sh
  nish_allow_panics build/nish
  mkdir -p build/bench
  build/nish ${allow_panics[@]+"${allow_panics[@]}"} bench/http1-server.ts --link build/bench/h1 --profile speed >/dev/null
  cp build/bench/h1 "$out/h1-copy"
  cmp build/bench/h1 "$out/h1-copy"
  scenarios="plaintext keep-alive c=256,json keep-alive c=256,post-json keep-alive c=256"
  echo
  echo "## Syscalls a request (bench/http.mjs --syscalls)"
  echo
  node bench/http.mjs --syscalls --only "$scenarios" h1=build/bench/h1 | tee "$out/syscalls.txt"
  echo
  echo "## System CPU a request ($server_rounds interleaved rounds of $duration s)"
  node bench/http.mjs --rounds "$server_rounds" --duration "$duration" --only "$scenarios" \
    h1=build/bench/h1 copy="$out/h1-copy" | tee "$out/timed.txt"
fi

# The reported workload: recvfrom 1.18, sendto 1.05, setsockopt 1.00 and
# epoll_wait 0.38 a request.
awk -v e="$entry_ns" -v only="$entry_only" -v sc="$out/syscalls.txt" -v tm="$out/timed.txt" '
function cell(line, n,   f) { split(line, f, "|"); gsub(/ /, "", f[n]); return f[n] }
BEGIN {
  printf "\n## The split\n\n"
  if (only == "") {
    while ((getline line < sc) > 0) {
      # "<scenario> | h1 | 2.07 syscalls/request | ..."
      if (line ~ / syscalls\/request /) {
        split(line, f, " [|] ")
        n = f[3]; sub(/ .*/, "", n)
        calls[f[1]] = n
      }
    }
    while ((getline line < tm) > 0) {
      if (line ~ /^## /) { name = substr(line, 4); sub(/, .*/, "", name); order[++k] = name }
      else if (line ~ /^\| h1 \|/) sys[name, "h1"] = cell(line, 7)
      else if (line ~ /^\| copy \|/) sys[name, "copy"] = cell(line, 7)
    }
    printf "| scenario | syscalls/request | sys us/request, h1 / copy | (a) entry and exit us | (b) the rest us, h1 / copy | (a) share, h1 / copy |\n"
    printf "| --- | ---: | ---: | ---: | ---: | ---: |\n"
    for (i = 1; i <= k; i++) {
      s = order[i]; h = sys[s, "h1"]; c = sys[s, "copy"]
      if (!(s in calls) || h + 0 <= 0 || c + 0 <= 0) {
        printf "| %s | n/a | n/a | n/a | n/a | n/a |\n", s
        continue
      }
      a = calls[s] * e / 1000
      printf "| %s | %.2f | %.2f / %.2f | %.2f | %.2f / %.2f | %.1f%% / %.1f%% |\n", s, calls[s], h, c, a, h - a, c - a, 100 * a / h, 100 * a / c
    }
    printf "\n(a) is syscalls/request x %.1f ns, the getppid median; (b) is sys us/request less (a)\n\n", e
  }
  m = 1.18 + 1.05 + 1.00 + 0.38
  printf "- the reported mix, %.2f syscalls a request x %.1f ns = (a) %.2f us a request, at this box'"'"'s entry cost\n", m, e, m * e / 1000
  printf "\nentry and exit: %.1f ns a syscall, %s the 500 ns line\n", e, e < 500 ? "under" : "at or over"
}'
