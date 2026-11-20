---
name: WP63 — io_uring direct descriptors for nish:net, follow-ups
overview: WP63 is landed with no open roadmap boxes. Open issues leave the 90,000-connection p99 control unrun and a few stale doc lines, plus a set of ring-in-place follow-ups from WP47.
roadmap: docs/roadmap/wp63-iouring-net.md
spec: docs/wp63-iouring-net.md
priority: 80
stages:
  - id: ring-p99-control
    title: WP63 S4 — the ring p99 control at 90,000 connections and the stale doc lines
    goal: bench/handler-ring/run.sh has run ring, epoll and epoll1 at 90,000 connections on a host with a hard nofile limit of at least 100,000, the cause of the tail is confirmed or replaced in BENCHMARKS.md, and the stale lines are fixed.
    verification: bash bench/handler-ring/run.sh --conns 90000 --think 4 --warmup 4 --designs "ring epoll epoll1" && node scripts/gen-reference.mjs --check && node docs/check-links.mjs
    status: pending
    issue: 1728
    todos:
      - id: p99-90000
        content: Re-run bench/handler-ring/run.sh at 90,000 connections with the one-epoll-process control on a host whose hard RLIMIT_NOFILE is at least 100,000, or against the owner's SQLite entry — see WP63 S4 p99 control
        status: pending
      - id: p99-cause
        content: Confirm the queue-on-one-core cause or replace it in docs/BENCHMARKS.md and docs/wp63-iouring-net.md S4, and settle the pinned-to-one-core conflict — see WP63 S4 p99 control
        status: pending
      - id: stale-lines
        content: Fix the loadgen window sentence in docs/BENCHMARKS.md against bench/fd-limit/loadgen.c, and check the security README io_uring row against net-uring.md counts — see WP63 S4 p99 control
        status: pending
  - id: ring-inplace-followups
    title: WP63 S6 — ring-in-place follow-ups, peekWait, shared-region lend cost and unpinned copyBytes lowering
    goal: The remaining non-blocking findings of the ring-in-place run are fixed or recorded as declined, and the 10 KB in-place slowdown has its cause measured.
    verification: node tests/run.js ring && node tests/run.js shm && node tests/run.js performance && npm run lint
    status: pending
    issue: 1238
    todos:
      - id: ring-peekwait
        content: Add peekWait to std/sync/ring.ts so a peek consumer on a doorbell ring need not poll, with the guide updated — see WP63 S6 ring-in-place follow-ups
        status: pending
      - id: ring-single-process-pin
        content: Add a single-process test that reserves against a partly full ring and places a marker against a nonzero head offset — see WP63 S6 ring-in-place follow-ups
        status: pending
      - id: shm-lend-walk
        content: Stop giveBack and reuse lends walking the whole window list in std/sync/shm.ts and runtime/runtime-shm.c, or record SHM-6 as accepted — see WP63 S6 ring-in-place follow-ups
        status: pending
      - id: copybytes-memmove-pin
        content: Pin that copyBytes lowers to one memmove through src/kernels.ts with a golden or IR check — see WP63 S6 ring-in-place follow-ups
        status: pending
      - id: readonly-body-partial-send
        content: Exercise a readonly body through sendBody's partial-send remainder copy in tests/link for std/net/http1-server.ts — see WP63 S6 ring-in-place follow-ups
        status: pending
      - id: inplace-10kb-cause
        content: Measure why the in-place path is 18.3 percent slower end to end at 10 KB with a ring sized to fit in cache, and record it in docs/wp47 section 7 — see WP63 S6 ring-in-place follow-ups
        status: pending
---

# WP63 — io_uring direct descriptors for nish:net, follow-ups

## Context
All six stages (measurement, S1 to S5) have landed and no roadmap boxes are open; see [the roadmap page](../../docs/roadmap/wp63-iouring-net.md). The design note's [§10](../../docs/wp63-iouring-net.md#10-stages) also asks for `bench/handler-ring/wins.sh` to be rerun on the entry before it adopts `mmap_size` or the shared cache; that is not a box and is not planned here.

## WP63 S4 — the ring p99 control at 90,000 connections and the stale doc lines
Issue #1728 (follow-up of the wp63-ring-gaps run, #1712, #1715 and #1717). Acceptance criterion 6 was partial: the one-epoll-process control ran at 18,000 connections because the container's hard `RLIMIT_NOFILE` is 20,000 (one epoll process holds at most 19,936). At matched load the owner's gap (65 ms ring against 20 ms for five epoll processes) did not reproduce, and the recorded cause, a queue on one core, conflicts with the owner's statement that the server was pinned to one core. Run `bash bench/handler-ring/run.sh --conns 90000 --think 4 --warmup 4 --designs "ring epoll epoll1"` on a host with a hard nofile of at least 100,000, ideally against the owner's SQLite entry.
Stale lines, status on this checkout: the `netShutdown`/`netMss` `-9` line in `docs/LANGUAGE.md` looks already fixed (it now says a slot shuts down through the ring and `netMss` answers `-1`, `docs/LANGUAGE.md:12089-12094`); the loadgen-window sentence in `docs/BENCHMARKS.md` ("closed its window only after `take()`'s sample reads") is still present; the pumped-completion line already says "an inference, not a measurement"; the `docs/security/README.md` io_uring row was not confirmed against net-uring.md's "twenty fixed, two open" and needs a count check. Those may already be done in part.
Likely files: `bench/handler-ring/`, `bench/fd-limit/loadgen.c`, `docs/BENCHMARKS.md`, `docs/security/README.md`.

## WP63 S6 — ring-in-place follow-ups, peekWait, shared-region lend cost and unpinned copyBytes lowering
Issue #1238 belongs to the WP47 ring-in-place run (`std/sync/ring.ts`, `std/sync/shm.ts`, wp47 section 7), not WP63; it was assigned here and is included as a separate stage. Its bench items (deadlines, `mode` and `n` validation, the claim about being paced) look addressed by #1831 (in 0.44.0, "ring-in-place bench validation, its deadline claims, and single-process ring pins"), so check each box before taking it. Open: no `peekWait` (a peek consumer on a doorbell ring polls); `giveBack` and `reuse` lends walk the whole window list (SHM-6); no test pins `copyBytes` lowering to one `memmove` (`src/kernels.ts:273`); a `readonly` body is not exercised through `sendBody`'s partial-send remainder copy. The measured 10 KB in-place slowdown (18.3%, band 8.0%) was being measured in #1230, check its result first.
Likely files: `std/sync/ring.ts`, `std/sync/shm.ts`, `runtime/runtime-shm.c`, `src/kernels.ts`, `bench/ring-inplace/`.
