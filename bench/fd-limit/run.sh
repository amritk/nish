#!/usr/bin/env bash
# The descriptor-limit measurement (bench/README.md, "Descriptor limit";
# docs/wp63-iouring-net.md): one process with N io_uring rings against P
# SO_REUSEPORT epoll processes, both under the same hard RLIMIT_NOFILE, at
# several connection counts, in interleaved rounds. The epoll server is also
# run as a byte-identical copy of itself in every round, and the spread
# between the two is the noise band (.claude/testing.md, "A Measured:
# trailer").
#
#   bash bench/fd-limit/run.sh                 # 18k 60k 96k 120k 300k, 5 rounds
#   bash bench/fd-limit/run.sh --quick         # 18k and 70k, 1 round, short windows
#   bash bench/fd-limit/run.sh --conns "18000 120000" --rounds 3 --rate 30000
#
# Each design runs under `prlimit --nofile=L:L`, L being 65535 (the benchmark
# box's LimitNOFILE) or this shell's hard limit if that is lower. The io_uring
# server takes ceil(C / L) rings, the kernel capping a ring's file table at
# RLIMIT_NOFILE; the epoll server takes max(5, ceil(C / (L - 32))) processes,
# five being the benchmark entry's count and more being what the limit forces.
#
# It raises net.ipv4.ip_local_port_range, net.core.somaxconn,
# net.ipv4.tcp_max_syn_backlog and nf_conntrack_max where it may (a network
# namespace of its own lets it), and prints what it changed. Needs gcc, Linux
# 6.1 or later, and memory for 2 x C sockets: about 9 KiB a connection, both
# ends, measured.
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
src="$root/bench/fd-limit"
out="$root/build/bench/fd-limit"
conns="18000 60000 96000 120000 300000"
rounds=5
rate=30000
warmup=3
seconds=10
port=9311

while [ $# -gt 0 ]; do
  case "$1" in
  --quick)
    conns="18000 70000"
    rounds=1
    warmup=1
    seconds=3
    ;;
  --conns) conns="$2"; shift ;;
  --rounds) rounds="$2"; shift ;;
  --rate) rate="$2"; shift ;;
  --seconds) seconds="$2"; shift ;;
  --warmup) warmup="$2"; shift ;;
  *)
    echo "usage: run.sh [--quick] [--conns \"C ...\"] [--rounds N] [--rate R] [--seconds S] [--warmup S]" >&2
    exit 2
    ;;
  esac
  shift
done

mkdir -p "$out"
for f in uring-server epoll-server loadgen; do
  gcc -O2 -Wall -Wextra -o "$out/$f" "$src/$f.c"
done
cp "$out/epoll-server" "$out/epoll-server-copy"

hard=$(ulimit -Hn)
limit=65535
if [ "$hard" != unlimited ] && [ "$hard" -lt "$limit" ]; then limit=$hard; fi

# Raise a sysctl if this namespace lets us, and say what changed.
raise() {
  local key=$1 want=$2 file
  file=/proc/sys/${key//./\/}
  [ -e "$file" ] || return 0
  local was
  was=$(tr -s '\t' ' ' <"$file")
  if [ "$was" = "$want" ]; then return 0; fi
  if echo "$want" >"$file" 2>/dev/null; then
    echo "sysctl $key: $was -> $want"
  else
    echo "sysctl $key: $was (could not raise to $want)"
  fi
}

echo "== box"
grep -m1 'model name' /proc/cpuinfo | sed 's/.*: //'
echo "cpus $(nproc), $(awk '/MemTotal/ {printf "%.1f GiB", $2 / 1048576}' /proc/meminfo)"
echo "kernel $(uname -r), virt $(systemd-detect-virt 2>/dev/null || echo unknown)"
grep -o 'mitigations=[^ ]*' /proc/cmdline || echo "mitigations: kernel default"
vulns=$(grep -L 'Not affected' /sys/devices/system/cpu/vulnerabilities/* 2>/dev/null | xargs -r -n1 basename | paste -sd, -)
echo "vulnerabilities not 'Not affected': ${vulns:-none}"
echo "hard RLIMIT_NOFILE $hard; both designs run under $limit:$limit"
raise net.ipv4.ip_local_port_range "1024 65000"
raise net.core.somaxconn 65535
raise net.ipv4.tcp_max_syn_backlog 65535
raise net.netfilter.nf_conntrack_max 1048576
echo "rate $rate req/s, warm-up ${warmup}s, window ${seconds}s, $rounds rounds"

results="$out/results.txt"
: >"$results"

wait_listening() {
  local file=$1
  for _ in $(seq 100); do
    if grep -q listening "$file" 2>/dev/null; then return 0; fi
    sleep 0.1
  done
  echo "server did not start" >&2
  return 1
}

# run <design> <conns> <round>: one server, one load, one result line.
run() {
  local design=$1 c=$2 r=$3 pids server log=$out/server.err n
  : >"$out/server.out"
  case "$design" in
  uring)
    n=$(((c + limit - 1) / limit))
    prlimit --nofile="$limit:$limit" "$out/uring-server" "$port" "$n" >"$out/server.out" 2>"$log" &
    server=$!
    wait_listening "$out/server.out"
    pids=$server
    ;;
  epoll | epoll-copy)
    n=$(((c + limit - 33) / (limit - 32)))
    if [ "$n" -lt 5 ]; then n=5; fi
    local bin=$out/epoll-server
    if [ "$design" = epoll-copy ]; then bin=$out/epoll-server-copy; fi
    prlimit --nofile="$limit:$limit" "$bin" "$port" "$n" >"$out/server.out" 2>"$log" &
    server=$!
    wait_listening "$out/server.out"
    pids=$(pgrep -P "$server" | paste -sd, -)
    ;;
  esac
  local line
  line=$("$out/loadgen" -c "$c" -r "$rate" -p "$port" -w "$warmup" -d "$seconds" -n "$pids" -l "$design")
  # The server's own count of what it holds: each process's peak, since the
  # load generator closes its connections before this runs.
  local live
  if [ "$design" = uring ]; then
    live=$(awk '/^live/ && $2 > m {m = $2} END {print m + 0}' "$log")
  else
    live=$(awk '/live/ && $3 > m[$1] {m[$1] = $3} END {for (p in m) s += m[p]; print s + 0}' "$log")
  fi
  echo "round=$r units=$n live=${live:-0} $line" | tee -a "$results"
  pkill -P "$server" 2>/dev/null || true
  kill "$server" 2>/dev/null || true
  wait "$server" 2>/dev/null || true
  sleep 1
}

designs=(uring epoll epoll-copy)
for c in $conns; do
  echo "== C=$c"
  for r in $(seq "$rounds"); do
    # Rotate the order each round so no design always runs first.
    for i in 0 1 2; do
      run "${designs[$(((i + r) % 3))]}" "$c" "$r"
    done
  done
done

echo "== summary: server CPU µs per request (user + sys), median of $rounds (min-max)"
awk '
  function med(a, n,   i, j, t) {
    for (i = 2; i <= n; i++) for (j = i; j > 1 && a[j - 1] > a[j]; j--) { t = a[j]; a[j] = a[j - 1]; a[j - 1] = t }
    return n % 2 ? a[(n + 1) / 2] : (a[n / 2] + a[n / 2 + 1]) / 2
  }
  {
    for (i = 1; i <= NF; i++) { split($i, kv, "="); v[kv[1]] = kv[2] }
    k = v["conns"] SUBSEP v["label"]
    n[k]++; us[k, n[k]] = v["srv_us"]; box[k, n[k]] = v["box_us"]
    lo[k] = (n[k] == 1 || v["srv_us"] < lo[k]) ? v["srv_us"] : lo[k]
    hi[k] = (n[k] == 1 || v["srv_us"] > hi[k]) ? v["srv_us"] : hi[k]
    live[k] = v["live"]; fds[k] = v["srv_fds"]; units[k] = v["units"]; pss[k] = v["srv_pss_mb"]; mem[k] = v["mem_used_mb"]
    if (!(v["conns"] in seen)) { seen[v["conns"]] = 1; order[++nc] = v["conns"] }
  }
  END {
    printf "%-8s %-10s %5s %8s %6s %18s %8s %8s %8s\n", "C", "design", "units", "live", "fds", "srv µs/req", "box µs", "PSS MB", "box MB"
    for (ci = 1; ci <= nc; ci++) {
      c = order[ci]
      split("uring epoll epoll-copy", ds, " ")
      for (di = 1; di <= 3; di++) {
        k = c SUBSEP ds[di]
        if (!(k in n)) continue
        delete a; delete b
        for (i = 1; i <= n[k]; i++) { a[i] = us[k, i]; b[i] = box[k, i] }
        m[k] = med(a, n[k]); mb = med(b, n[k])
        printf "%-8s %-10s %5s %8s %6s %7.2f (%.2f-%.2f) %8.2f %8s %8s\n", c, ds[di], units[k], live[k], fds[k], m[k], lo[k], hi[k], mb, pss[k], mem[k]
      }
      e = c SUBSEP "epoll"; ec = c SUBSEP "epoll-copy"; u = c SUBSEP "uring"
      if ((e in m) && (ec in m) && (u in m)) {
        band = m[e] > 0 ? (m[ec] - m[e]) / m[e] * 100 : 0
        if (band < 0) band = -band
        d = m[e] > 0 ? (m[e] - m[u]) / m[e] * 100 : 0
        printf "         uring is %.1f%% %s than epoll; noise band (epoll vs its copy) %.1f%%\n", (d < 0 ? -d : d), (d >= 0 ? "cheaper" : "dearer"), band
        last = c; lastd = d; lastband = band; lastlive = live[u]
      }
    }
    if (last != "") {
      verdict = (lastlive > 65535 && lastd > lastband) ? "go" : "no-go"
      printf "== verdict at C=%s: %s (uring held %s; %.1f%% against a %.1f%% band)\n", last, verdict, lastlive, lastd, lastband
    }
  }
' "$results"
