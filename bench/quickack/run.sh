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
#   2. the alternatives to the socket option Linux offers per host, each
#      measured with probe.c on one connection and with bench/http.mjs --acks
#      on the plaintext scenario, `none` and `reset0`, then put back:
#        route    `quickack 1` on the local route to 127.0.0.1
#        sysctl   net.ipv4.tcp_pingpong_thresh at 3, and the write of 0
#        sockops  a BPF sockops program on a cgroup v2 (sockops.c) calling
#                 bpf_setsockopt with TCP_BPF_DELACK_MAX 8000 us, and with
#                 TCP_QUICKACK 0
#      Each needs root (CAP_NET_ADMIN, CAP_BPF, CAP_SYS_ADMIN); where the box
#      refuses one, the refusal is printed in its place and the run goes on
#   3. bench/http.mjs --acks over the keep-alive scenarios, every mode in one
#      interleaved session with `copy`, a byte-identical copy of the `none`
#      build, whose distance from `none` is the noise band
#   4. bench/http.mjs --syscalls over the same scenarios
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
# A container inside a VM reports only the container, so the CPU's hypervisor
# flag is printed as well: it is what tells a VM from bare metal.
echo "    systemd-detect-virt: $(systemd-detect-virt 2>/dev/null || echo none)"
if grep -qw hypervisor /proc/cpuinfo; then
  echo "    the CPU reports a hypervisor: a VM"
else
  echo "    the CPU reports no hypervisor: bare metal"
fi
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
# A bench program, so its build takes `--allow-panics` from a compiler that lists it.
. scripts/nish-compiler.sh
nish_allow_panics build/nish
build/nish ${allow_panics[@]+"${allow_panics[@]}"} bench/http1-server.ts --link build/bench/h1 --profile speed >/dev/null
cp build/bench/h1 "$out/h1-copy"
cmp build/bench/h1 "$out/h1-copy"
here=$(pwd)
# %q quotes the path, so a checkout under a directory with spaces still runs.
wrap() {
  local name="$1" bin="$2" mode="$3"
  if [ "$mode" = none ]; then
    printf '#!/bin/sh\nexec env -u BENCH_QUICKACK %q "$@"\n' "$here/$bin" >"$out/$name"
  else
    printf '#!/bin/sh\nexec env BENCH_QUICKACK=%s %q "$@"\n' "$mode" "$here/$bin" >"$out/$name"
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

# The alternatives. Each one changes host state, so the trap puts every change
# back however the run ends.
sockops_built=""
if err="$(cc -O2 -Wall -o "$out/sockops" bench/quickack/sockops.c 2>&1)"; then
  sockops_built=1
fi
route_was=()
thresh_was=""
cgroup_mount=""
cgroup_dir=""
restore() {
  if [ ${#route_was[@]} -gt 0 ]; then
    ip route replace table local "${route_was[@]}" || echo "could not restore the route: ${route_was[*]}" >&2
  fi
  if [ -n "$thresh_was" ]; then
    echo "$thresh_was" >/proc/sys/net/ipv4/tcp_pingpong_thresh || echo "could not restore tcp_pingpong_thresh=$thresh_was" >&2
  fi
  if [ -n "$cgroup_dir" ]; then
    rmdir "$cgroup_dir" 2>/dev/null || true
  fi
  if [ -n "$cgroup_mount" ]; then
    umount "$cgroup_mount" 2>/dev/null || true
    rmdir "$cgroup_mount" 2>/dev/null || true
  fi
}
trap restore EXIT
# sockops prints why it stopped on stderr; the record on stdout says so too.
sockops_failed() {
  echo "refused: sockops exited $1 (its reason is on stderr); no figure above this line is from the program"
}
alt_load() {
  node bench/http.mjs --acks --rounds "$rounds" --duration "$duration" --only "plaintext keep-alive c=256" \
    "none=$out/none" "reset0=$out/reset0"
}
echo
echo "# alternatives"
echo
echo "Figures from a cloud VM when the box above reports a hypervisor."
echo
echo "## baseline, the host as it is"
echo
"$out/probe" acks none reset0
alt_load

echo
echo "## route: quickack 1 on the local route to 127.0.0.1"
echo
if ! command -v ip >/dev/null; then
  echo "refused: ip (iproute2) is not installed"
else
  # The route's words, as ip prints them, are what puts it back.
  read -ra route <<<"$(ip route show table local 127.0.0.1 | head -n1)"
  echo "before: ${route[*]}"
  if [ ${#route[@]} -eq 0 ]; then
    echo "refused: no local route to 127.0.0.1 to change"
  elif err="$(ip route replace table local "${route[@]}" quickack 1 2>&1)"; then
    route_was=("${route[@]}")
    echo "during: $(ip route show table local 127.0.0.1 | head -n1)"
    echo
    "$out/probe" acks none reset0
    alt_load
    ip route replace table local "${route_was[@]}"
    route_was=()
    echo "after: $(ip route show table local 127.0.0.1 | head -n1)"
  else
    echo "refused: ip route replace table local ${route[*]} quickack 1: $err"
  fi
fi

echo
echo "## sysctl: net.ipv4.tcp_pingpong_thresh"
echo
f=/proc/sys/net/ipv4/tcp_pingpong_thresh
if [ ! -r "$f" ]; then
  echo "refused: $f does not exist on this kernel"
else
  was="$(cat "$f")"
  echo "before: $was"
  if err="$( { echo 0 >"$f"; } 2>&1)"; then
    thresh_was="$was"
    echo "the write of 0 was taken"
  else
    echo "the write of 0: refused: ${err##*: }"
  fi
  if err="$( { echo 3 >"$f"; } 2>&1)"; then
    thresh_was="$was"
    echo "during: $(cat "$f")"
    echo
    "$out/probe" acks none reset0
    alt_load
    echo "$thresh_was" >"$f"
    thresh_was=""
    echo "after: $(cat "$f")"
  else
    echo "the write of 3: refused: ${err##*: }"
  fi
fi

echo
echo "## sockops: a BPF program on a cgroup v2"
echo
root_cg=""
if [ -z "$sockops_built" ]; then
  echo "refused: cc sockops.c: ${err:-no message}"
elif [ -f /sys/fs/cgroup/cgroup.controllers ]; then
  root_cg=/sys/fs/cgroup
else
  # A cgroup v1 host: mount a v2 hierarchy beside it for the run.
  cgroup_mount="$(mktemp -d)"
  if ! err="$(mount -t cgroup2 none "$cgroup_mount" 2>&1)"; then
    echo "refused: mount -t cgroup2: $err"
    rmdir "$cgroup_mount"
    cgroup_mount=""
  fi
  root_cg="$cgroup_mount"
fi
if [ -n "$root_cg" ]; then
  cgroup_dir="$root_cg/nish-quickack-$$"
  if ! err="$(mkdir "$cgroup_dir" 2>&1)"; then
    echo "refused: mkdir $cgroup_dir: $err"
    cgroup_dir=""
  else
    echo "### TCP_BPF_DELACK_MAX 8000 us"
    echo
    "$out/sockops" "$cgroup_dir" delack_max 8000 "$out/probe" acks none reset0 || sockops_failed $?
    "$out/sockops" "$cgroup_dir" delack_max 8000 node bench/http.mjs --acks --rounds "$rounds" \
      --duration "$duration" --only "plaintext keep-alive c=256" "none=$out/none" "reset0=$out/reset0" || sockops_failed $?
    echo
    echo "### TCP_QUICKACK 0"
    echo
    "$out/sockops" "$cgroup_dir" quickack 0 "$out/probe" acks none || sockops_failed $?
  fi
fi
restore
trap - EXIT
route_was=()
thresh_was=""
cgroup_dir=""
cgroup_mount=""

scenarios="ping keep-alive,plaintext keep-alive c=256,json keep-alive c=256"
echo
node bench/http.mjs --acks --rounds "$rounds" --duration "$duration" --only "$scenarios" "${servers[@]}"
echo
echo "# --syscalls"
echo
# A strace that attached to nothing counts no calls: its 0.00 (or NaN) is a
# refusal, printed as one rather than as a measured zero. A strace that exits
# before http.mjs waits on it (it could not attach) leaves http.mjs waiting
# for good: the timeout turns that into a refusal too.
{ timeout 900 node bench/http.mjs --syscalls --only "$scenarios" "${servers[@]}" ||
  echo "refused: bench/http.mjs --syscalls did not finish in 900 s (strace may not have attached)"; } | awk -F ' [|] ' '
  / syscalls\/request / {
    n = $3; sub(/ .*/, "", n)
    if (!(n ~ /^[0-9]+(\.[0-9]+)?$/ && n + 0 > 0)) {
      print $1 " | " $2 " | refused: strace counted " n " syscalls/request"
      next
    }
  }
  { print }'
