#!/usr/bin/env bash
# What a system call's entry and exit cost on this box, against the TCP work a
# keep-alive request does. See bench/README.md, "Syscall cost".
#
#   bash bench/syscall-cost/run.sh [--quick] [--rounds n] [--calls n] [--cpu n]
#                                  [--split <syscalls/request> <sys µs/request>]
#
# Builds entry.c with the system cc at -O2, prints the box (CPU, kernel, VM or
# bare metal, the kernel's mitigations), then runs it pinned to one CPU and
# prints its table in ns per call. --quick is 3 rounds of 10^5 calls, for CI;
# the default is 7 rounds of 10^6. --split divides a server's system CPU per
# request into syscall entry and exit, (a), and the rest, (b), the TCP work;
# without it the split is given for the reported workload's mix only.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
rounds=7
calls=1000000
cpu=0
split=""

while [ $# -gt 0 ]; do
  case "$1" in
    --quick) rounds=3; calls=100000 ;;
    --rounds) rounds="$2"; shift ;;
    --calls) calls="$2"; shift ;;
    --cpu) cpu="$2"; shift ;;
    --split) split="$2 $3"; shift 2 ;;
    -h|--help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "run.sh: unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done

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
# The reported workload: recvfrom 1.18, sendto 1.05, setsockopt 1.00 and
# epoll_wait 0.38 a request.
awk -v e="$entry_ns" -v sp="$split" 'BEGIN {
  printf "\n## The split\n\n"
  if (sp != "") {
    split(sp, f, " ")
    a = f[1] * e / 1000
    printf "- this server: %.2f syscalls a request x %.1f ns = (a) %.2f us; (b) %.2f - %.2f = %.2f us a request; (a) is %.1f%% of its system time\n", f[1], e, a, f[2], a, f[2] - a, 100 * a / f[2]
  }
  m = 1.18 + 1.05 + 1.00 + 0.38
  printf "- the reported mix, %.2f syscalls a request x %.1f ns = (a) %.2f us a request, at this box'"'"'s entry cost\n", m, e, m * e / 1000
  printf "\nentry and exit: %.1f ns a syscall, %s the 500 ns line\n", e, e < 500 ? "under" : "at or over"
}'
