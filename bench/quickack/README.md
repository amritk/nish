# What keeping delayed ACKs costs

A keep-alive HTTP/1.1 server wants each request's ACK to ride on its response
instead of going out as a segment of its own. Linux does that by itself on a
connection that answers quickly. This directory measures what each way of
asking for it costs, and what it buys, on `bench/http1-server.ts`:

| mode (`BENCH_QUICKACK`) | what the server does |
| --- | --- |
| `none` (unset) | no call |
| `once0` | `setsockopt(TCP_QUICKACK, 0)` once per connection, after accept |
| `reset0` | `setsockopt(TCP_QUICKACK, 0)` after each response |
| `reset1` | `setsockopt(TCP_QUICKACK, 1)` after each response: what the user guide used to recommend |

```sh
npm run build
bash bench/quickack/run.sh            # the recorded run: 7 interleaved rounds of 5 s
bash bench/quickack/run.sh --quick    # 1 round of 2 s, to try the script
```

`run.sh` prints the box first, then `probe.c` (the per-call cost and an
ACK count per mode on one connection), then `bench/http.mjs --acks` over the
keep-alive scenarios with every mode in one interleaved session, then
`--syscalls`. Every mode is a wrapper that runs the same build with
`BENCH_QUICKACK` set; `copy` is a byte-identical copy of that build, and its
distance from `none` is the noise band. It needs Linux, `wrk`, `strace` and a
C compiler.

## The answer

- **No call is the right default.** After the first response the kernel keeps
  delayed ACKs on by itself, and `none` sends 2.003 to 2.008 segments per
  request, the same as every mode that sets 0.
- **`reset1` costs a system call and a packet per request**, for as long as
  the connection lives: 3.003 to 3.009 segments per request, 12.9 % to 18.3 %
  fewer requests per second and 0.8 to 2.0 µs more kernel time per request,
  each well outside the noise band.
- **`reset0` buys almost nothing for its call.** It saves one pure ACK only on
  the request after a response that was slower than the delayed-ACK timer, or
  after a reordered or ECN-marked segment. Its cost on the fast scenarios sits
  inside the noise band; its system calls are measured: one more per request.
- **`once0` is free and only saves the first request's ACK.** One call per
  connection (0.02 to 0.03 per request at these connection counts).
- **No `Http1Config` field.** `std/net/http1-server.ts` makes no call today,
  which is the right default; a knob to make one would only offer the costly
  modes.

## The box

Every figure here is from one box:

- Intel Xeon Processor @ 2.10GHz (the CPU model the VM exposes), 4 vCPUs
- a Firecracker VM (the CPU reports a hypervisor; `systemd-detect-virt` sees
  only the container it runs in), kernel 6.18.44
- vulnerabilities: every one "Not affected" except
  `spec_store_bypass` (prctl), `spectre_v1` (usercopy/swapgs barriers),
  `spectre_v2` (Enhanced IBRS, IBPB conditional, BHI vulnerable)
- `net.ipv4.tcp_pingpong_thresh = 1`, `tcp_ecn = 2`, `tcp_timestamps = 1`
- the server on CPU 0, `wrk -t3` on CPUs 1 to 3, over loopback: `run.sh`
  pins nothing itself; this is `bench/http.mjs`'s default layout (`taskset`
  on a 4-CPU box), which `probe.c` does not use

The box that reported the cost of a per-response setsockopt was a Xeon Platinum
8260 VM on Linux 6.8. These figures are **not** from it: that box was not
reachable from this session. `run.sh` runs unchanged there, and the kernel
reading below covers 6.8 as well as 6.18, so the behaviour should match; the
nanoseconds will not.

## Per call

`probe.c calls`: the median of 7 runs of 200,000 calls on an established
loopback socket (min and max in brackets). The repository's general syscall
table is `bench/README.md#syscall-cost`; these are timed here so they come
from the same box as the rest.

| call | ns/call |
| --- | ---: |
| `setsockopt(TCP_QUICKACK, 0)` | 170 (167 to 173) |
| `setsockopt(TCP_QUICKACK, 1)` | 173 (170 to 175) |
| `getsockopt(TCP_QUICKACK)` | 204 (190 to 208) |
| `getsockopt(TCP_INFO)` | 294 (270 to 338) |
| `getppid()`, the floor any call pays | 107 (95 to 110) |

## ACKs on one connection

`probe.c acks`: 200 requests of 64 bytes and responses of 128 on one loopback
connection, under three patterns. `fast` answers at once; `slow` answers every
tenth request 250 ms late, past the longest delayed-ACK timer; `idle` sends
every tenth request after 1.5 s of silence, longer than the retransmission
timeout. Pure ACKs are the server socket's `tcpi_segs_out` minus
`tcpi_data_segs_out`. The last column counts requests that arrived while
`getsockopt(TCP_QUICKACK)` said delayed ACKs were off.

| pattern | `none` | `once0` | `reset0` | `reset1` |
| --- | ---: | ---: | ---: | ---: |
| fast | 0.005 (1 of 200) | 0.000 (0) | 0.005 (1) | 1.000 (200) |
| slow | 0.200 (20) | 0.195 (19) | 0.105 (1) | 1.000 (200) |
| idle | 0.005 (1) | 0.000 (0) | 0.005 (1) | 1.000 (200) |

On `slow`, 0.1 of the floor is the delayed-ACK timer's ACK of each request
whose response is late, which every mode pays. Without a call, the request after a
late response is ACKed at once; `reset0` saves exactly that one, and that is
all it ever saves. An idle connection does not lose delayed ACKs.

## Under load

`bench/http.mjs --acks`, 7 interleaved rounds of 5 s, the median and the
spread (min to max). `segs/req` counts every segment on loopback, wrk's
included, so 2 is a request and a response with every ACK piggybacked, and
anything above 2 is a pure ACK. No delayed-ACK timer fired in any row. The
noise band is the `copy` row.

**plaintext keep-alive c=256**

| mode | req/s | spread | user µs/req | sys µs/req | segs/req | syscalls/req |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| none | 150,866 | 141,505 to 169,507 | 1.15 | 5.33 | 2.003 | 2.07 |
| copy | 157,915 (+4.7 %) | 140,554 to 168,579 | 1.22 | 4.99 | 2.003 | 2.08 |
| reset0 | 145,722 (−3.4 %) | 116,972 to 152,868 | 1.23 | 5.52 | 2.004 | 3.12 |
| once0 | 154,267 (+2.3 %) | 128,376 to 168,834 | 1.16 | 5.20 | 2.003 | 2.10 |
| reset1 | 123,201 (−18.3 %) | 109,686 to 139,530 | 1.28 | 6.84 | 3.004 | 3.10 |

**json keep-alive c=256**

| mode | req/s | spread | user µs/req | sys µs/req | segs/req | syscalls/req |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| none | 149,683 | 123,524 to 164,024 | 1.19 | 5.34 | 2.003 | 2.08 |
| copy | 150,089 (+0.3 %) | 127,407 to 156,186 | 1.25 | 5.28 | 2.003 | 2.07 |
| reset0 | 148,896 (−0.5 %) | 93,898 to 156,544 | 1.29 | 5.32 | 2.003 | 3.09 |
| once0 | 148,802 (−0.6 %) | 138,758 to 156,865 | 1.31 | 5.27 | 2.003 | 2.10 |
| reset1 | 130,319 (−12.9 %) | 118,139 to 139,579 | 1.36 | 6.13 | 3.003 | 3.10 |

**post-json keep-alive c=256**

| mode | req/s | spread | user µs/req | sys µs/req | segs/req | syscalls/req |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| none | 73,801 | 61,536 to 82,783 | 5.92 | 7.75 | 2.006 | 2.08 |
| copy | 72,033 (−2.4 %) | 70,354 to 82,964 | 6.03 | 7.63 | 2.006 | 2.08 |
| reset0 | 71,697 (−2.9 %) | 56,284 to 75,928 | 6.16 | 8.00 | 2.006 | 3.10 |
| once0 | 71,719 (−2.8 %) | 55,293 to 75,616 | 6.16 | 7.41 | 2.005 | 2.11 |
| reset1 | 61,222 (−17.0 %) | 49,131 to 67,752 | 6.50 | 9.70 | 3.007 | 3.10 |

**ping keep-alive c=500** ran too, and its `copy` row landed 31.1 % above
`none`: on this box that scenario's noise is wider than any effect here, so
it says nothing about req/s. Its counts still hold: `reset1` 3.009 segments
per request against 2.006 to 2.009 for the rest, and 3.17 to 3.18 system calls
per request for both per-response modes against 2.12 to 2.16.

## Why: the kernel

Line numbers are for v6.8 and v6.18 (`net/ipv4/` unless named).

- **Delayed ACKs turn on by themselves.** Sending data within the ACK timeout
  of the last received segment enters "pingpong" mode, the kernel's name for
  delayed ACKs on an interactive connection: `tcp_event_data_sent`,
  `tcp_output.c:173-176` (6.8), `177-180` (6.18). With the default
  `net.ipv4.tcp_pingpong_thresh = 1`, the first quick response does it.
  `tcp_fin` enters it too (`tcp_input.c:4498` / `4689`).
- **What turns them off.** The delayed-ACK timer firing on a pingpong socket
  leaves the mode (`tcp_timer.c:333-340`): that is the `slow` pattern. So does
  `tcp_enter_quickack_mode` (`tcp_input.c:306-311` / `323-328`), called on an
  ECN CE mark (`364`, `372` / `358`, `367`), a duplicate or out-of-order
  segment (`4625` / `4816`), out-of-window data (`5235` / `5457`) and in
  SYN-SENT (`6474` / `6756`). Time alone does not: the `idle` pattern keeps
  the mode.
- **Why `reset1` sends an ACK on every request.** Reading a small segment sets
  `ICSK_ACK_PUSHED` (`tcp_measure_rcv_mss`, `tcp_input.c:288-290` /
  `305-307`, and `261` / `278` for a full-sized segment with PSH). When the
  read drains the receive queue, `__tcp_cleanup_rbuf` sends an ACK at once if
  that flag is set and the socket is not in pingpong (`tcp.c:1460-1464` /
  `1530-1534`). Outside pingpong, every small request is ACKed as soon as it
  is read, however many quick ACKs the connection has left
  (`tcp_incr_quickack`, `tcp_input.c:294` / `311`).
- **What the option does.** `__tcp_sock_set_quickack` (`tcp.c:3269-3284` /
  `3653-3668`, reached from `do_tcp_setsockopt` at `3618` / `4026`): 0 enters
  pingpong and nothing else; 1 leaves it and sends a scheduled ACK now.
  `getsockopt(TCP_QUICKACK)` answers whether the socket is out of pingpong
  (`tcp.c:4094-4095` / `4520-4521`).

## Every way Linux allows

| way | what it changes | per-request cost | verdict |
| --- | --- | --- | --- |
| no call | nothing; pingpong from the first quick response | none | the default, and right |
| `TCP_QUICKACK` 0 once at accept | pingpong from the first request | one call per connection | free; saves the first request's ACK |
| `TCP_QUICKACK` 0 after each response | pingpong back after a late response | one call per request (≈170 ns) | saves one ACK per late response; not worth the call |
| `TCP_QUICKACK` 1 after each response | pingpong off for good | one call and one segment per request | the trade the guide now spells out |
| check with `getsockopt` first, set only when off | as above, fewer setsockopts | one getsockopt per request (≈204 ns, or 294 for `TCP_INFO`) | costs more than the setsockopt it skips |
| `ip route ... quickack 1` | quick ACKs for a route, every socket on it | none in the process | the opposite direction; needs root and affects other programs |
| `TCP_CONGESTION` | the congestion control, not the ACK policy | one call per connection | no lever on delayed ACKs |
| sysctl `net.ipv4.tcp_pingpong_thresh` | how many quick sends enter pingpong | none in the process | system-wide; the default 1 is already the most eager, and no sysctl sets the delayed-ACK timeout (`tcp_comp_sack_*` batch SACKs, not ACKs) |
| BPF sockops `TCP_BPF_DELACK_MAX` (`filter.c:5225-5230` / `5379-5384`) | the longest delayed-ACK timeout | none in the process | needs a loaded BPF program and `CAP_BPF`; `bpf_setsockopt` has no `TCP_QUICKACK` |
| `TCP_DELACK_MAX_US` (6.18 only, `tcp.c:3910-3925`) | the longest delayed-ACK timeout, per socket | one call per connection | not on 6.8; tunes the timer, not whether ACKs wait |
| `TCP_INFO` to skip the reset | reads `tcpi_ato` only (`tcp.c:3824` / `4237`); no pingpong bit | one getsockopt per request | cannot tell, and costs more than the call it skips |

## A getter, recorded rather than built

A `TCP_INFO` or `getsockopt(TCP_QUICKACK)` getter in `nish:net` would let a
server set the option only when the kernel had turned delayed ACKs off. It
would be a new builtin (a `src/` change, a whitelist entry and a security
finding), and the figures say it would save nothing: on this box a
`getsockopt(TCP_QUICKACK)` costs 204 ns and the `setsockopt` it would skip
costs 170 ns, while the ACK it would save comes once per late response. It is
not built; a server that wants the first request's ACK saved calls
`netSetOption(conn, NET_TCP_QUICKACK, 0)` once at accept, which the user guide
shows.
