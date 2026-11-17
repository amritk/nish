---
name: WP63 follow-up — the three gaps that block switching a server to the ring
overview: "Running a one-core SQLite server on S2–S4 (one ring process against five SO_REUSEPORT epoll processes, 90,000 keep-alive connections, about 4 s think time) measured 37.4 against 41.4 µs per request, but three things block the switch. Idle slots hold their 4 KiB receive queue (PSS 492 MB against 115 MB). p99 is 65 ms against 20 ms. netShutdown and netMss refuse slot handles, so Http1Server's lingering close on a slot becomes an immediate close. Close all three in three serial PRs, and re-measure at 96,000 and 300,000 connections."
stages:
  - id: s1-idle-memory
    title: "fix(runtime): free an idle ring slot's receive queue"
    goal: "An idle keep-alive slot holds no receive queue. The queue is freed once nr_read drains it (roff == rlen) and starts at 1024 bytes, or something measured better. It lands with a NURING finding whose before/after test measures idle-slot memory with many connections, and a bench/handler-ring re-run at 96,000 reporting PSS."
    verification: "node tests/run.js uring && node tests/run.js net_ring && node tests/run.js net_handler_ring && node tests/run.js c-symbols && node scripts/security-scope.mjs && npm run lint && npm run check"
    todos:
      - id: s1-free-on-drain
        content: "In runtime/runtime-net.c free nr_conn.rbuf (rbuf NULL, rcap 0, roff and rlen 0) when nr_read drains the queue to roff == rlen. Also free it on slot reuse at accept, so a reused slot does not inherit a stale capacity. Keep the receive-hold threshold and the NR_RECV_MAX cap behaving exactly as now."
        status: pending
      - id: s1-initial-size
        content: "Start the queue at 1024 bytes (inside glibc's tcache) instead of 4096 and keep the doubling growth. If a measured alternative beats it (for example, handing the provided buffer's bytes straight to the reader when the queue is empty, with no copy and no allocation), use that and give the numbers in the PR."
        status: pending
      - id: s1-memory-test
        content: "Add a tests/run.js check (uring or net_ring section) that holds a few thousand keep-alive connections on a ring listener, each idle after one request, and asserts the server's memory per idle connection (PSS or RSS from /proc, read by a helper it builds, never a tool's message text) stays under a bound that the old runtime exceeds. Show it failing on the base runtime and passing on the fix."
        status: pending
      - id: s1-nuring-finding
        content: "Record NURING-38 in docs/security/net-uring.md. Cover the idle slot's memory, an unbounded total across connections that a peer controls by opening and idling, and the use-after-free and double-free surface of freeing in nr_read: what a read after free and a close after free do. Give the disposition and the before/after test name, and update the summary counts."
        status: pending
      - id: s1-bench-96k
        content: "Re-run bash bench/handler-ring/run.sh --conns 96000, with ring and epoll interleaved as the script does. Record µs/req and PSS beside S4's 518 MB and 129 MB in docs/BENCHMARKS.md (the WP63 S4 section) and in docs/wp63-iouring-net.md's S4 note and open questions, with the noise band and the exact command."
        status: pending
  - id: s2-slot-shutdown
    title: "feat(runtime): give netShutdown and netMss a slot path"
    goal: "netShutdown on a ring slot half-closes the connection (the peer reads EOF after the bytes already sent). Http1Server's lingering close on a ring listener therefore lingers instead of falling back to an immediate close. netMss on a slot returns a positive MSS or a documented answer. The restriction-set decision is recorded, and the guide says what each call does on a slot."
    verification: "node tests/run.js uring && node tests/run.js net_ring && node tests/run.js sandbox && node tests/run.js http1 && node tests/run.js c-symbols && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run lint && npm run check"
    todos:
      - id: s2-shutdown-op
        content: "Route nish_net_shutdown for a slot handle (>= NR_BASE) through the ring. Use IORING_OP_SHUTDOWN on the fixed file, queued like a send so it goes out after the bytes queued before it. Bytes still in the slot's send queue must reach the peer before the FIN. Add the op to the UR_OP_ defines, the probe list and ur_restrict's allowed ops. If the probe lacks it, fall back cleanly (the listener stays on epoll, as for any other missing op) and do not fail."
        status: pending
      - id: s2-restriction-decision
        content: "Decide how SHUTDOWN fits the S3 restriction set and record it as a NURING finding in docs/security/net-uring.md. The default argument: SHUTDOWN reaches only fixed files the ring already owns, and CLOSE on the same files is already allowed, so it adds no authority. Check that against the kernel's op (a SHUT_RD or SHUT_RDWR on a slot, a stale or freed slot index, a slot reused after its generation moved on) and give a before/after test. The seccomp filter is syscall-level and needs no change; say so in the finding only if the code shows it."
        status: pending
      - id: s2-mss
        content: "Give nish_net_mss a slot answer. TCP_MAXSEG cannot be read from a direct descriptor without IORING_OP_URING_CMD, which widens the restriction set. Choose between reading it once at accept time (a registered-file-free path), returning the MSS the listener's socket reports, or returning a documented negative code. Record the choice and the reason. Fix today's mismatch, where the guide says -9 and the code returns -1. Check that Http1Server's mss <= 0 branch still holds."
        status: pending
      - id: s2-linger-test
        content: "Add a tests/link program, or extend net_ring_halfclose, that drives Http1Server on NET_LISTEN_RING into its lingering close. Assert by the exit status of a helper the test builds that the peer receives the whole response and then EOF, not a reset, while it is still sending. Show it failing on the base runtime. Add a slot netShutdown negative: a closed or stale handle still answers -9."
        status: pending
      - id: s2-guide
        content: "Update docs/guide/using-nish/networking.md (the NET_LISTEN_RING section on what -9 means for slots) and docs/guide/using-nish/http-server.md (lingering close on a ring listener). Update the netShutdown and netMss doc comments in runtime/nish.d.ts if what they say changes, and regenerate docs/reference with node scripts/gen-reference.mjs. If std/net/http1-server.ts changes and moves a nish-cmp program's IR, add the DECLARED entries to tests/nish-cmp.js and regenerate the goldens."
        status: pending
  - id: s3-tail-latency
    title: "perf(runtime): find and fix the ring's p99 stall, and measure 300,000 connections"
    goal: "The cause of one ring process's 65 ms p99 (against 20 ms for five epoll processes) is found with evidence. It is fixed with before/after p99, or recorded as the cause. bench/handler-ring reports latency percentiles, and docs/BENCHMARKS.md has 96,000 and 300,000 rows for the final code."
    verification: "node tests/run.js uring && node tests/run.js net_ring && node tests/run.js net_handler_ring && node tests/run.js c-symbols && node scripts/security-scope.mjs && bash -n bench/handler-ring/run.sh && npm run lint && npm run check"
    todos:
      - id: s3-percentiles
        content: "Make the load generator behind bench/handler-ring (bench/fd-limit/loadgen.c) record per-request latency, with keep-alive think time configurable (about 4 s). Report p50, p99 and p99.9 beside µs/req and PSS over a steady window that excludes the connect burst. The server is pinned to one core, as the entry ran it."
        status: pending
      - id: s3-reproduce
        content: "Reproduce the gap in this container at about 90,000 connections. Run one ring process, five SO_REUSEPORT epoll processes and one epoll process interleaved, so 'one process doing alone what five interleave' is separated from a ring-specific stall. Give each configuration's p99 with its noise band."
        status: pending
      - id: s3-localise
        content: "Find where a ring pass stalls, with counters or timestamps rather than guesses. Candidates: accept batching (ACCEPT_DEPTH 32 single-shot), buffer-ring exhaustion and multishot re-arm (the nobufs park and catch-up), nr_pump's 64 rounds of 256 events, the O(npend) pend walk, the ur_catch_up stalled-send scan, and send flushing (one ur_submit_queued per wait). Report the longest pass and what it was doing."
        status: pending
      - id: s3-fix-or-record
        content: "Fix the stall if the fix is local to the ring runtime (for example bounding a pass by time or events so handlers interleave, or batching re-arms). Give before/after p99 and µs/req with noise bands, and keep every uring and net_ring test green. If the cause is structural (one process against five), record it with the numbers instead. Either way, add a NURING finding if the change touches the attacker-facing surface, for example a peer able to lengthen a pass for everyone."
        status: pending
      - id: s3-300k
        content: "Re-measure bench/handler-ring at 96,000 and 300,000 connections on the final code (PSS, µs/req, p99). If 300,000 cannot be reached in this container, record the limit hit (ports, memory, a kernel cap) with the number it reached. Write docs/BENCHMARKS.md (WP63 section), docs/wp63-iouring-net.md (S4 note, open questions) and the roadmap page's state line if its figures move."
        status: pending
---

# WP63 follow-up — the ring's three gaps

Requirements (from the owner): S2–S4 of WP63 are on `main`. The twelve-dollar
server challenge entry `nish-std-amritk` was run on them: one ring process
against five SO_REUSEPORT epoll processes, 90,000 keep-alive connections, about
4 s think time, SQLite on every request, the server pinned to one core. It
measured 37.4 against 41.4 µs per request. Three gaps block the switch: idle-slot
memory, p99 latency, and netShutdown and netMss on slot handles. The ring is also
re-measured at 300,000 connections, which S4 did not reach. The repository's
definition of done holds throughout: c-symbols, the security record and the guide.

The three stages are **serial**. Every one of them edits `runtime/runtime-net.c`,
`docs/security/net-uring.md` and `tests/run.js`, so no two can run concurrently
with disjoint ownership. Each is worth merging on its own, and the three together
fail the one-PR test. S2 waits for S1 to merge, and S3 waits for S2, so S3
measures the final code.

Facts the stages rest on (read at base `05c92f49`):

- `nr_conn` is in `runtime/runtime-net.c`. Its `rbuf` is grown in
  `nr_dispatch`'s data path (`rcap ? rcap : 4096`, then doubled), kept across slot
  reuse, and freed only in `nr_close`. `nr_read` copies out and advances `roff`.
- `ur_restrict` in `runtime/runtime-uring.c` allows ACCEPT, RECV, SEND, CLOSE,
  ASYNC_CANCEL and NOP. The keeper ring allows NOP only. The probe list must gain
  every op the runtime relies on.
- `nish_net_shutdown` has no `NR_BASE` route, so a slot reaches `shutdown(2)` and
  gets -9. `nish_net_mss` calls `getpeername` first and returns -1. The guide's
  networking.md says -9 for both.
- `Http1Server` (`std/net/http1-server.ts`) falls back to an immediate close when
  `netShutdown` is negative, and leaves `socketMss` unset when `netMss` is <= 0.
- bench/handler-ring reports µs/req and PSS but no latency percentiles. Its
  memory is read by `bench/fd-limit/loadgen.c` from `/proc/<pid>/smaps_rollup`.
- The highest finding in net-uring.md is NURING-37.

## S1 — free an idle slot's receive queue

**Owns:** `runtime/runtime-net.c`, `tests/run.js`, `tests/runtime/**`,
`tests/link/net_ring_*/**`, `docs/security/net-uring.md`, `docs/BENCHMARKS.md`,
`docs/wp63-iouring-net.md`, `docs/roadmap/wp63-iouring-net.md`,
`bench/handler-ring/**`, `bench/README.md`

The owner's measurement: freeing in `nr_read` once `roff == rlen` and starting at
1024 bytes gave 147 MB and 36.7 µs/req, against 492 MB and 37.4 µs/req. Land
that or something measured better. The test is the before/after for NURING-38:
it must fail on the base runtime.

## S2 — a slot path for netShutdown and netMss

**Owns:** `runtime/runtime-net.c`, `runtime/runtime-uring.c`,
`runtime/runtime-sandbox.c`, `runtime/nish.d.ts`, `std/net/http1-server.ts`,
`tests/run.js`, `tests/runtime/**`, `tests/link/net_ring_*/**`,
`tests/link/net_ring_linger*/**`, `tests/nish-cmp.js`,
`docs/security/net-uring.md`, `docs/guide/using-nish/networking.md`,
`docs/guide/using-nish/http-server.md`, `src/c-symbols.ts`

Generated, regenerated with the repo's tooling: `docs/reference/**`,
`tests/self/goldens/checked/**`.

Adding IORING_OP_SHUTDOWN to the allowed ops is the expected answer. If the
review of the op finds it widens authority, the fallback is to document the
immediate close in the guide and record the decision. That is allowed, but the
PR must say why.

## S3 — the p99 stall, and 300,000 connections

**Owns:** `runtime/runtime-net.c`, `runtime/runtime-uring.c`,
`bench/handler-ring/**`, `bench/fd-limit/**`, `bench/README.md`, `tests/run.js`,
`tests/runtime/**`, `tests/link/net_ring_*/**`, `tests/link/net_handler_ring/**`,
`docs/BENCHMARKS.md`, `docs/wp63-iouring-net.md`,
`docs/roadmap/wp63-iouring-net.md`, `docs/security/net-uring.md`,
`docs/guide/using-nish/networking.md`

This is an investigation first. A recorded cause with numbers is an acceptable
outcome. A fix is welcome where it is local and keeps every ring test green. The
`Measured:` trailer follows `.claude/testing.md`. Every figure in BENCHMARKS.md
names the command that produced it.
