#!/usr/bin/env bash
# Measures what keeping delayed ACKs costs bench/http1-server.ts each way the
# BENCH_QUICKACK modes allow; bench/quickack/README.md reads the results.
#
#   bash bench/quickack/run.sh               the recorded run: 7 rounds, 5 s each
#   bash bench/quickack/run.sh --quick       1 round, 2 s
#   bash bench/quickack/run.sh --rounds 9 --duration 10
#
# It prints the box first (CPU, kernel, virtualisation, the vulnerability
# mitigations and the TCP sysctls the modes depend on), then:
#
#   1. bench/quickack/probe.c: each call's cost, and the pure ACKs per request
#      each mode sends on one connection under a fast, a slow and an idle
#      client
#   2. bench/http.mjs --acks over the keep-alive scenarios, every mode in one
#      interleaved session with `copy`, a byte-identical copy of the `none`
#      build, whose distance from `none` is the noise band
#   3. bench/http.mjs --syscalls over the same scenarios
#
# Each mode is a wrapper script under build/bench/quickack/ that execs the one
# build with BENCH_QUICKACK set, so every row runs the same bytes and the
# process wrk is timed against is still the server's. Linux only; it needs
# wrk, strace and a C compiler, and reuses build/nish (npm run build).
set -euo pipefail
cd "$(dirname "$0")/../.."

rounds=7
duration=5
while [ $# -gt 0 ]; do
  case "$1" in
    --quick) rounds=1; duration=2 ;;
    --rounds) rounds="$2"; shift ;;
    --duration) duration="$2"; shift ;;
    *) echo "usage: bash bench/quickack/run.sh [--quick] [--rounds n] [--duration s]" >&2; exit 2 ;;
  esac
  shift
done

for tool in wrk strace cc; do
  if ! command -v "$tool" >/dev/null; then
    echo "$tool is not installed" >&2
    exit 2
  fi
done
if [ ! -x build/nish ]; then
  echo "build/nish is missing: run npm run build first" >&2
  exit 2
fi

echo "# box"
echo
grep -m1 "model name" /proc/cpuinfo | sed 's/^/    /'
echo "    $(nproc) CPUs, kernel $(uname -r)"
virt=$(systemd-detect-virt 2>/dev/null || true)
if [ -z "$virt" ] && grep -qw hypervisor /proc/cpuinfo; then
  virt="a VM (the CPU reports a hypervisor)"
fi
echo "    virtualisation: ${virt:-none detected}"
for f in /sys/devices/system/cpu/vulnerabilities/*; do
  echo "    $(basename "$f"): $(cat "$f")"
done
for s in tcp_pingpong_thresh tcp_ecn tcp_timestamps; do
  if [ -r "/proc/sys/net/ipv4/$s" ]; then
    echo "    net.ipv4.$s = $(cat "/proc/sys/net/ipv4/$s")"
  fi
done

out=build/bench/quickack
mkdir -p "$out"
build/nish bench/http1-server.ts --link build/bench/h1 --profile speed >/dev/null
cp build/bench/h1 "$out/h1-copy"
cmp build/bench/h1 "$out/h1-copy"
here=$(pwd)
wrap() {
  local name="$1" bin="$2" mode="$3"
  if [ "$mode" = none ]; then
    printf '#!/bin/sh\nexec env -u BENCH_QUICKACK %s "$@"\n' "$here/$bin" >"$out/$name"
  else
    printf '#!/bin/sh\nexec env BENCH_QUICKACK=%s %s "$@"\n' "$mode" "$here/$bin" >"$out/$name"
  fi
  chmod +x "$out/$name"
}
wrap none build/bench/h1 none
wrap copy "$out/h1-copy" none
wrap reset0 build/bench/h1 reset0
wrap once0 build/bench/h1 once0
wrap reset1 build/bench/h1 reset1
servers=()
for m in none copy reset0 once0 reset1; do
  servers+=("$m=$out/$m")
done

cc -O2 -Wall -o "$out/probe" bench/quickack/probe.c
echo
echo "# probe.c"
echo
"$out/probe"

scenarios="ping keep-alive,plaintext keep-alive c=256,json keep-alive c=256"
echo
node bench/http.mjs --acks --rounds "$rounds" --duration "$duration" --only "$scenarios" "${servers[@]}"
echo
echo "# --syscalls"
echo
node bench/http.mjs --syscalls --only "$scenarios" "${servers[@]}"
