---
name: Cheaper syscalls per request in nish/net/http1-server
overview: Measure how much of a keep-alive Nish HTTP/1.1 server's kernel time is syscall entry and exit rather than TCP work, write the verdict down, and find the cheapest way to keep delayed ACKs without one setsockopt per response. An io_uring backend is built only if the measurement says entry cost matters, and then only after a second sign-off. Nothing changes by default; every new path is behind a flag and carries a measured before and after.
stages:
  - id: syscall-cost
    title: "perf(runtime): measure syscall entry cost against TCP work per request"
    goal: A re-runnable benchmark in bench/ splits a keep-alive request's kernel time into (a) syscall entry and exit and (b) TCP work on the box it runs on, and the repo records the verdict against the 0.5 µs-per-syscall line
    verification: npm run lint && bash bench/syscall-cost/run.sh --quick && node docs/check-links.mjs
    status: pending
    todos:
      - id: entry-microbench
        content: Add bench/syscall-cost/entry.c, a C microbenchmark that times, per call over a warmed loop, a trivial raw syscall (syscall(SYS_getppid), no vDSO), recv on a connected non-blocking loopback TCP socket with an empty queue (EAGAIN), setsockopt(TCP_QUICKACK, 0), and getsockopt(TCP_INFO). See syscall-cost, What to time
        status: pending
      - id: tcp-pair
        content: Time a full loopback request/response round on one keep-alive connection at the byte sizes bench/http1-server.ts answers (plaintext and json). Count send plus recv on both ends, so the TCP work per call is (round cost - entry cost × calls) / calls. See syscall-cost, What to time
        status: pending
      - id: run-script
        content: Add bench/syscall-cost/run.sh, which builds entry.c with the system cc at -O2, pins to one CPU, prints CPU model, kernel, VM or bare metal, and /sys/devices/system/cpu/vulnerabilities/*, then a table in ns per call with the median and min-to-max of interleaved rounds. --quick runs few rounds and must exit 0 in CI-sized time
        status: pending
      - id: per-request-split
        content: Run node bench/http.mjs --syscalls and a timed run on build/bench/h1 for the keep-alive scenarios. Combine syscalls per request with the measured entry cost into (a), take (b) as server system CPU µs per request minus (a), and also give the split for the reported workload's mix (recvfrom 1.18, sendto 1.05, setsockopt 1.00, epoll_wait 0.38). See syscall-cost, The split
        status: pending
      - id: verdict
        content: Write the result and the verdict into a new "Syscall cost" section of bench/README.md, a short entry in docs/BENCHMARKS.md, and one sentence in docs/wp39-http-server.md §6 where io_uring is named as future work. If (a) is under 0.5 µs per syscall, say that io_uring is not worth building on this evidence. Name the box, and say that the reported workload ran on another box (Xeon Platinum 8260 VM, Linux 6.8) and how to re-run it there
        status: pending
  - id: quickack
    title: "perf(runtime): measure the cheaper ways to keep delayed ACKs"
    goal: The repo states, with measured before and after, what keeping delayed ACKs on a keep-alive connection costs each way Linux allows, and the user guide stops recommending a per-response setsockopt without that trade-off
    verification: npm run check && npm run lint && node tests/run.js net_http1_server && node tests/run.js net_set_option && node tests/self/goldens.js && node docs/check-links.mjs
    status: pending
    todos:
      - id: kernel-reading
        content: Read the Linux source for 6.8 and for the kernel this session runs (net/ipv4/tcp.c TCP_QUICKACK in do_tcp_setsockopt, inet_connection_sock.h pingpong, TCP_PINGPONG_THRESH, tcp_output.c and tcp_input.c where pingpong is counted and the quick-ACK budget is set, tcp_timer.c where a missed delayed ACK leaves pingpong mode). Write down when a request/response connection enters and leaves delayed-ACK mode on its own, citing file and line. See quickack, The kernel
        status: pending
      - id: alternatives
        content: For each alternative, answer whether it keeps delayed ACKs persistently and what it costs - ip route ... quickack, TCP_CONGESTION, sysctls, a BPF sockops program (bpf_setsockopt, TCP_BPF_DELACK_MAX), setting TCP_QUICKACK 0 once at accept, no call at all, and skipping the reset after reading TCP_INFO (tcpi_ato, and whether any field exposes the pingpong or quick state). See quickack, Alternatives
        status: pending
      - id: bench-modes
        content: Add a BENCH_QUICKACK mode to bench/http1-server.ts - unset (today's behaviour, no call), reset0 (netSetOption QUICKACK 0 after each response, the reported app's pattern), once0 (once after tcpAccept), reset1 (the guide's pattern). Unset must build to the same behaviour as today
        status: pending
      - id: measure-modes
        content: Measure every mode with bench/http.mjs on the keep-alive scenarios - syscalls per request (--syscalls), req/s, server CPU µs per request, the noise band from a byte-identical copy, and ACK segments per response from nstat (TcpOutSegs, TcpExtDelayedACKs, TcpExtTCPQuickAck or whatever the kernel has) taken around each run. Add the nstat capture to bench/http.mjs behind a flag (--acks) if that is the cleanest place. See quickack, Measuring
        status: pending
      - id: write-up
        content: Write bench/quickack/README.md with the kernel reading, the alternatives table and the measured modes. Correct the "Socket options" section of docs/guide/using-nish/networking.md so it states the measured trade-off in both directions (quick ACKs on, delayed ACKs kept), keeping it a compiled nish:ok example
        status: pending
      - id: expose-or-not
        content: Decide, from the measurements, whether a cheaper path is useful outside benchmarks. If it is, and it needs no new builtin, expose it as an Http1Config field that defaults off, with a link test and its standard-library.md entry. If it would need a new builtin (a TCP_INFO getter), do not add one here; record the proposal and its measured saving in bench/quickack/README.md. See quickack, Exposure
        status: pending
      - id: quickack-goldens
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and read the diff
        status: pending
  - id: uring
    title: "perf(runtime): io_uring backend for the http1 server loop, behind a flag"
    goal: Only if syscall-cost's merged verdict says entry cost is at least 0.5 µs per syscall - a flagged io_uring loop with multishot recv on a provided buffer ring, responses submitted once per turn, and the Postgres connections on the same ring, measured against epoll on the same box
    verification: npm run check && npm run lint && node tests/run.js net_ && node tests/run.js wasi && node tests/run.js performance && node scripts/security-scope.mjs
    status: pending
    todos:
      - id: replan
        content: Not spawned with the others. When syscall-cost merges, read its verdict. Under 0.5 µs per syscall, this stage is closed as not built and the run says so. At or over it, the lead re-plans this stage into its own sliced plan, with the numbers from syscall-cost, and asks for sign-off again before any session starts. See uring
        status: pending
---

# Cheaper syscalls per request in nish/net/http1-server

## Context

Base: `main` at `ce8f92ce`.

The reported workload is a RealWorld/Conduit API on `nish/net/http1-server`
and `nish/net/postgres`: 4 prefork workers on 8 vCPUs, a Xeon Platinum 8260
VM on Linux 6.8, 120k keep-alive clients and about 31.6k req/s. Each worker
makes about 3.6 syscalls per request:

- `recvfrom` 1.18, almost never `EAGAIN`
- `sendto` 1.05, one per response
- `setsockopt` 1.00, because the app resets `TCP_QUICKACK` to 0 after each response to keep delayed ACKs
- `epoll_wait` 0.38
- `epoll_ctl` about 0

Kernel time is about 27% of the server's CPU samples, and most of it is TCP
work inside `sendto` and `recvfrom`.

What the code is today:

- **`std/net/http1-server.ts` has no event loop.** `Http1Server` is a slot
  pool. The program owns the readiness loop: it calls `pollWait`, then
  `accept()` or `readable(slot)`/`send(slot)`, and `pollModify` when `rearm`
  says the interest changed. Its only I/O is `netRead`, `netWrite`,
  `tcpAccept` and `netClose` from `nish:net`, which are `recv`,
  `send(MSG_NOSIGNAL)`, `accept4` and `close` in `runtime/runtime-net.c`.
  `epoll` is wrapped there too, as `nish_poll_*`, with a kqueue branch for
  Darwin.
- **`std/net/postgres.ts` is sans-IO.** Its carriers (`tests/postgres/carrier.ts`
  and `bench/postgres/main.ts`) put the sockets on the program's own epoll
  loop.
- **`netSetOption`** (`runtime-net.c:389`) covers five whitelisted options,
  `TCP_QUICKACK` among them. There is no getter. RT-23 in
  `docs/security/runtime.md` records why it is a whitelist.
- **`bench/http.mjs --syscalls`** already counts syscalls per request under
  `strace -c` against `bench/http1-server.ts`, and its timed runs report server
  CPU µs per request with a noise band from a byte-identical copy.
  `bench/README.md` records keep-alive at 2.06 syscalls per request: one
  `recvfrom` and one `sendto`.
- **No io_uring code exists.** `docs/wp39-http-server.md` §6 names it as
  future work, for once a profile shows the syscalls. The seccomp sandbox
  (`runtime/runtime-sandbox.c`) kills syscalls 425-427 unless both `net` and
  `process.spawn` are granted, so any io_uring backend has to account for
  `--sandbox`.
- `docs/guide/using-nish/networking.md` ("Socket options") tells a server to
  set `NET_TCP_QUICKACK` 1 again after each response. That costs the same
  setsockopt the reported app pays in the other direction.

**Where the measurements run.** Workers run in cloud containers: x86-64
Intel Xeon at 2.10 GHz, Firecracker VM, kernel 6.18, with the distro's default
mitigations (eIBRS, no KPTI). That is not the reported box. Every benchmark
therefore prints the box it ran on and can be re-run on the reported one, and
every write-up says which box each number comes from.

## syscall-cost

**Owns:** `bench/syscall-cost/**`, `bench/README.md`, `docs/BENCHMARKS.md`, `docs/wp39-http-server.md`

### What to time

Use C for the microbenchmark. The question is the kernel's cost, so the
compiler under test should not be in the way, and `bench/` already holds C
twins. Each figure is ns per call over a warmed loop of at least 10^6 calls,
taken from `clock_gettime(CLOCK_MONOTONIC)` around the loop. Run the rounds
interleaved and report the median and the min-to-max.

- **Entry and exit:** `syscall(SYS_getppid)`, which does almost nothing in the
  kernel and does not go through the vDSO. This is (a) per syscall.
- **Socket dispatch with no TCP work:** `recv` on a connected non-blocking
  loopback socket with nothing queued (`EAGAIN`). This adds the fd lookup and
  the socket lock.
- `setsockopt(TCP_QUICKACK, 0)` and `getsockopt(TCP_INFO)` on a connected
  socket. Both quickack and syscall-cost need these figures.
- **A loopback request/response round** on one connection, at the sizes
  `bench/http1-server.ts` answers. This is the TCP work, with the entry cost
  subtracted.

### The split

Per request, (a) = syscalls per request × entry cost, and (b) = server system
CPU µs per request − (a). Give it twice:

- for `build/bench/h1` under `bench/http.mjs`, measured on this box;
- for the reported mix of 3.6 syscalls per request, using this box's entry
  cost. Say plainly that this second figure is an estimate for another box.

The verdict line: is (a) under 0.5 µs per syscall? If it is, the run stops
building at quickack, and that sentence goes in `bench/README.md`.

## quickack

**Owns:** `bench/quickack/**`, `bench/http1-server.ts`, `bench/http.mjs`,
`docs/guide/using-nish/networking.md`, and, only if `expose-or-not` decides to
expose an Http1Config field, `std/net/http1-server.ts`,
`docs/guide/using-nish/standard-library.md`, `tests/link/net_http1_server*/**`
and `docs/security/http1.md`. Generated: `tests/self/goldens/checked/**`.

### The kernel

The question is when Linux puts a request/response connection into
delayed-ACK ("pingpong") mode by itself, and what takes it out again. If the
kernel already stays in delayed-ACK mode on keep-alive traffic after the first
exchange, the per-response `TCP_QUICKACK 0` buys nothing. If it does not
(because a delayed-ACK timeout resets pingpong, for example), the question is
which event does it and how often that happens under load. Read the source of
both kernels and cite file and line. `TCP_PINGPONG_THRESH` has moved between
releases.

### Alternatives

Give one row for each alternative: does it keep delayed ACKs persistently,
what does it cost per request, and what does it need (root, a route, a BPF
program)? `ip route ... quickack` only forces quick ACKs on, and the row should
check that rather than assume it. The TCP_INFO idea is only a saving if a
`getsockopt` is cheaper than the `setsockopt` it replaces and the state it
needs is actually exposed. Use the numbers from syscall-cost's microbenchmark,
or time them here if that stage has not merged.

### Measuring

Pass the mode as an environment variable to `bench/http1-server.ts`, read once
at start-up. When the variable is unset, the server must do exactly what it
does today. For every mode, report:

- syscalls per request;
- req/s;
- CPU µs per request, with the noise band;
- pure ACK segments per response.

Run all the modes in one interleaved session.

### Exposure

The user's rule is to expose a new path only if it is useful outside
benchmarks, and otherwise to document the trade-off. Setting the option once at
accept, or not at all, needs no new API, because `netSetOption` already covers
it, so the guide is the place to say it. An Http1Config field earns its place
only if the server itself must act per response. A new builtin (a TCP_INFO
getter) is a `src/` change, a whitelist entry and a security finding. It is
out of scope for this stage and goes in the write-up as a proposal with its
measured saving.

## uring

**Owns:** decided at re-plan.

This stage depends on syscall-cost for development and on quickack for merge,
because both would touch the server loop and the bench program.

The expected outcome is that it is not built. On an eIBRS Xeon with no KPTI,
a syscall's entry and exit usually costs well under 0.5 µs. The measurement
decides, not this expectation.

If it is built, the re-plan covers:

- new `nish:net` builtins over raw `io_uring_setup` and `io_uring_enter` (there
  is no liburing in the image), with a ring, a provided buffer ring, multishot
  recv and send SQEs;
- the Darwin and WASI story;
- the `--sandbox` seccomp rule;
- a `docs/security/runtime.md` finding;
- an Http1Config or loop flag that defaults to epoll;
- the Postgres carrier on the same ring;
- syscalls per request and CPU µs per request against epoll on the same box.
