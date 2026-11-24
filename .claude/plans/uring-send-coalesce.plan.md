---
name: Ring sends — one SEND per response, buffers from a pool
overview: On a ring slot every write is its own malloc'd record and its own IORING_OP_SEND, and a slot has one send in flight, so Http1Server's netWrite2 (head + body) leaves as two SENDs, the second a later io_uring_enter and, under TCP_NODELAY, a second packet. Profiled on a 90,000-connection keep-alive run (~19k req/s, one core) the kernel's send path was 16.1% of the core against 13.5% for an entry that sends once per response, and the runtime's malloc + memcpy, nr_send, ur_service and memmove about 2.5% more. Coalesce a slot's queued bytes so a response leaves as one SEND, take send buffers from a per-ring pool, keep every memory bound docs/security/net-uring.md lists, and re-measure.
priority: 100
stages:
  - id: s1-coalesce-pool
    title: "perf(runtime): coalesce a ring slot's queued sends into one SEND, from a per-ring buffer pool"
    goal: A write to a ring slot whose last queued send is not yet submitted appends to it (bounded by NR_AREA), so netWrite2 and back-to-back netWrites within one pass leave as one IORING_OP_SEND; send buffers come from a bounded per-ring pool instead of a malloc per send, and an idle slot holds none; nish_uring_stats counts SENDs submitted, and a test fails at more than one SEND per head+body response; every bound in docs/security/net-uring.md still holds and the record lands with the change.
    verification: node tests/run.js uring && node tests/run.js net_ring && node tests/run.js net_handler_ring && node tests/run.js c-symbols && node tests/run.js runtime_test && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/security-scope.mjs
    todos:
      - id: s1-counter
        content: Add a `sends` counter (IORING_OP_SEND SQEs submitted) to struct nish_uring_stats in runtime/runtime-uring.c (both the Linux and the stub definition, and the copy runtime-net.c declares if any), and a tests/runtime/uring-test.c mode that answers N head+body responses written as two sends within one pass and prints sends per response. Record the figure on main's send path (2.0 expected) before changing it — it goes in the PR body as the "before".
        status: pending
      - id: s1-coalesce
        content: "Coalesce. Today ur_enqueue calls ur_send_head at once, which writes the SQE and marks the record in_flight before io_uring_enter, so nothing can be appended to it. Defer it: a slot with queued bytes and no SEND in the kernel is marked for submission, and the SEND SQE is written when the ring submits (nish_uring_wait's service/submit), from the head record's whole unsent length. A write to a slot whose tail record is not submitted appends to that record while the record has room; NR_AREA still bounds a slot's queued bytes (nr_send unchanged in contract). nish_net_write2 on a slot copies both ranges in one call (a two-range nish_uring_send, or two appends to one record) so it never depends on pass timing. Byte order, partial-send requeue (q->off), shutdown records queued behind sends (NURING-39), SEND_FAILED, close/linger (NURING-10, -12) and generation checks (NURING-4) keep their behaviour; a stalled SQ (stalled_sends) still re-submits."
        status: pending
      - id: s1-pool
        content: "Pool. Send records' buffers come from a per-ring free list of fixed-size buffers (size chosen and justified in the record, e.g. covering a typical response; larger writes chain buffers or fall back to one exact allocation) instead of malloc + memcpy per send. A slot holds buffers only while it has bytes queued, and returns them when its queue drains, it fails, or it closes (an idle keep-alive slot holds none, as NURING-38 established for the receive side). The free list keeps at most a fixed cap of buffers per ring (or bytes), frees the rest, and nish_uring_destroy / ur_free_ring free it all; give stats a pool counter (buffers allocated, or held) the tests read."
        status: pending
      - id: s1-tests
        content: "Tests in tests/runtime/uring-test.c (modes run by tests/run.js's uring section) and, where a Nish program is the right driver, a tests/link/net_ring_* case: (a) one SEND per head+body response and one per back-to-back netWrites in a pass — fails at 2; (b) a write while a SEND is in the kernel is appended to the next record, and the peer reads every byte in order across partial sends with a slow reader; (c) steady-state responses allocate no new pool buffers after warm-up; (d) an idle slot after a response holds no send buffer; (e) the pool's cap: a burst across many slots leaves at most the cap cached after they drain — fails without the cap; (f) NR_AREA still answers -11 at 256 KiB queued. Each new bound cites the check that fails without it."
        status: pending
      - id: s1-record
        content: "Update docs/security/net-uring.md: scope rows for the new and changed functions (the deferred submit, the append path, the pool, the two-range send), NURING-2's text where the per-send copy changed, new NURING-40+ findings for what coalescing and the pool introduce (a peer that never reads pins the pool's buffers up to NR_AREA per slot; the pool cap; a send buffer reused after a SEND_FAILED or a close while the kernel holds it — freed only on its completion, as ur_unlink_all does today), each with a before/after test or recorded open; the memory-bounds properties re-checked against the code with the check that pins each; and the record's row in docs/security/README.md with its new counts. Run node scripts/security-scope.mjs."
        status: pending
  - id: s2-measure
    title: "docs(bench): ring sends per response, packets per response and CPU at 18k and 96k"
    goal: bench/handler-ring reports packets per response (TCP OutSegs over the measured window / responses) beside server CPU per request and PSS, and docs/BENCHMARKS.md has a section that measures main before s1-coalesce-pool against main after it — bench/handler-ring at 18,000 and 96,000 connections and the h1 design (Http1Server) on rings — interleaved, with the byte-identical copy as the noise band, naming the commit of the bench code.
    verification: bash -n bench/handler-ring/run.sh && node docs/check-links.mjs && npm run lint
    todos:
      - id: s2-packets
        content: "Add packets per response to bench/handler-ring/run.sh's per-round output and its summary table: the delta of /proc/net/snmp Tcp OutSegs (and InSegs) over the measured window divided by the responses counted in that window, beside srv_us, srv_user_us, srv_sys_us and srv_pss_mb. Say in the script's header what the figure counts (the box's segments, the load generator's included, so a pure-ACK segment counts) and keep the existing outputs' names unchanged. Develop this against main now; it does not depend on s1."
        status: pending
      - id: s2-run
        content: "Once s1-coalesce-pool is on main (the lead messages when it merges), build the compiler at the commit before s1's merge and at s1's merge commit, and run, interleaved, 5 rounds each: `bash bench/handler-ring/run.sh --nodb --conns 18000 --designs \"ring h1 ...\"` and the same at 96000 (with --think as the script's 90k example uses), before vs after with a byte-identical copy for the noise band. Record server CPU per request (user, sys), packets per response, PSS per connection, req/s and any lost connections. If this container cannot hold 96,000 connections (descriptor or port limits), record exactly what refused and the largest count that ran, and do not claim the 96k row."
        status: pending
      - id: s2-doc
        content: "Add the section to docs/BENCHMARKS.md, following CLAUDE.md's record rules: the table names the commit whose bench code produced it and claims only fields that version prints; every 'up to', 'lower than' and figure is recomputed from the recorded run; the PR body states how many figures were checked. The Measured: trailer on the commit states the figures and their noise band."
        status: pending
---

# Ring sends — one SEND per response, buffers from a pool

## Context

`runtime/runtime-uring.c` keeps a per-slot queue of `struct ur_send` records,
each `malloc(sizeof *q + n)` with the bytes copied in (`nish_uring_send`).
`ur_enqueue` calls `ur_send_head` at once, which writes the SEND SQE and sets
`in_flight` before the ring is entered, so the head is never extendable and
every later write is a new record that waits for the head's completion.
`nish_net_write2` (`runtime/runtime-net.c`) calls `nr_send` twice, so
`Http1Server`'s head + body (`std/net/http1-server.ts`, `netWrite2`) become two
SENDs and two round trips through the completion queue.

## s1-coalesce-pool

**Owns:** `runtime/runtime-uring.c`, `runtime/runtime-net.c`, `runtime/nish.h`, `src/c-symbols.ts`, `tests/runtime/uring-test.c`, `tests/link/net_ring_*/**`, `tests/run.js`, `docs/security/net-uring.md`, `docs/security/README.md`

`tests/run.js` is owned only for the `uring` / `net_ring` sections' mode list
and checks. `src/c-symbols.ts` only if a new libc call needs reserving (the
`c-symbols` run says so). No `std/` or `src/` codegen change is expected, so no
goldens, nish-cmp IR or reference pages should move; if one does, that is a
sign the change left its lane.

## s2-measure

**Owns:** `bench/handler-ring/**`, `docs/BENCHMARKS.md`

Depends on s1-coalesce-pool for merge (it measures s1's merged code). The
instrumentation todo starts at once against main; the run and the doc wait
for the lead's message that s1 merged.
