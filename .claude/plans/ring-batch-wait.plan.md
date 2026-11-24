---
name: Batched ring waits — pollWaitBatch and the direct ring wait
overview: A loop over NET_LISTEN_RING slots wakes on the first ready event and reaches its rings through an eventfd in epoll. Add a batched wait that sleeps in io_uring_enter for minEvents completions or maxWaitMs, let a loop that holds only ring slots and the signal fd wait on its ring directly, expose the batch on HttpHandler, and measure CPU per request and p50/p99 on bench/handler-ring at 18k and 96k connections.
priority: 80
stages:
  - id: batch-wait
    title: "feat(runtime): pollWaitBatch and the direct ring wait for ring-only loops"
    goal: nish:net has pollWaitBatch(loop, ready, timeoutMs, minEvents, maxWaitMs), which on a ring loop waits in io_uring_enter for minEvents completions or maxWaitMs once the first event is in, and a loop holding only ring slots plus the signal fd waits on its ring without the eventfd and epoll hop, for pollWait and pollWaitBatch alike; documented, tested and recorded.
    verification: node tests/run.js net_loop && node tests/run.js net_ring && node tests/run.js uring && node tests/run.js c-symbols && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && NISH=build/nish bash docs/cookbook/regen.sh --check
    status: pending
    todos:
      - id: ext-arg-wait
        content: In runtime/runtime-uring.c, add a ring wait that enters with IORING_ENTER_GETEVENTS | IORING_ENTER_EXT_ARG, min_complete and a timeout; probe IORING_FEAT_EXT_ARG (and min_wait_usec support) and fall back to today's eventfd path when absent
        status: pending
      - id: batch-semantics
        content: Implement nish_poll_wait_batch in runtime/runtime-net.c with these semantics — block up to timeoutMs for the first event (an idle loop must not wake every maxWaitMs), then wait at most maxWaitMs more for minEvents in total; minEvents 1 behaves exactly like pollWait; ready's length still caps the count; prefer one enter with min_wait_usec on kernels that have it, two enters otherwise
        status: pending
      - id: direct-ring-wait
        content: When a loop's members are one ring set with one ring plus at most the signal fd (no other descriptor), wait in io_uring_enter on that ring instead of epoll_wait on the set's eventfd; watch the signal fd from inside the ring (e.g. a poll SQE) so a signal is still reported promptly; any other member, a second ring, or a refused feature falls back to the epoll path; keep the NURING-8 timer bound and the NURING-14 interrupted-wait rule
        status: pending
      - id: descriptors-prompt
        content: A loop that also holds ordinary descriptors still reports them and signalFd() through pollWaitBatch, at worst maxWaitMs late, and the doc says which bound holds
        status: pending
      - id: builtin-surface
        content: Add pollWaitBatch to nish:net — runtime/nish.d.ts (global and module copies, doc comment with @param and @returns), runtime/nish.h, runtime/nish.mjs, src/nish-modules.ts signature, src/runtime.ts declaration, src/emit-builtins.ts, the Darwin kevent definition (falls back to pollWait semantics), the wasm32/WASI refusal; src/ must not call it (rolling freeze)
        status: pending
      - id: batch-tests
        content: Tests — a uring-test.c mode for the EXT_ARG wait (min reached, timeout, idle block, fallback without EXT_ARG), a tests/link case that drives a ring listener through pollWaitBatch with N clients and checks batch sizes, the maxWaitMs bound, a SIGTERM delivered while waiting for 256, and that a ring-only loop makes no epoll_wait in its steady state (checked by exit status of a helper, not a tool's message text); a positive tests/cases program with its .ll golden and llvm-as pass; reject cases for readonly ready, wrong arity and wasm
        status: pending
      - id: batch-budgets
        content: Update src/c-symbols.ts for any new libc call, tests/runtime-budgets.js .text budgets if the runtime grows, tests/nish-cmp.js DECLARED entries for any corpus program whose IR moves, and regenerate the goldens
        status: pending
      - id: batch-docs
        content: docs/LANGUAGE.md pollWaitBatch rule and the direct-wait note beside pollWait; the NET_LISTEN_RING section of docs/guide/using-nish/networking.md; a docs/cookbook/builtin-net-*.ts entry and the regenerated docs/IR_COOKBOOK.md; regenerated docs/reference/; docs/wp63-iouring-net.md §5/§11 note
        status: pending
      - id: batch-security
        content: docs/security/net-uring.md — scope covers the new wait, the ready bound, the EXT_ARG argument struct, the signal poll SQE's lifetime, the fallback, findings fixed with before/after tests or recorded open, each bound row citing the check that fails without it; docs/security/runtime.md row for runtime-net.c; the docs/security/README.md row counts
        status: pending
  - id: batch-bench
    title: "perf(runtime): batched ring waits on HttpHandler, measured on bench/handler-ring"
    goal: HttpHandler takes the batch as limits (default unchanged), bench/handler-ring can run the ring design at several minEvents, and docs/BENCHMARKS.md records CPU per request and p50/p99 at 18,000 and 96,000 connections for minEvents 1, 64 and 256 with maxWaitMs 1, with the latency each adds.
    verification: node tests/run.js net_handler && bash bench/handler-ring/run.sh --quick --conns 18000 --designs ring --min-events "1 64" --max-wait-ms 1 && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs
    status: pending
    todos:
      - id: handler-limits
        content: Add HandlerLimits.minEvents and HandlerLimits.maxWaitMs to std/net/handler.ts; the wait calls pollWaitBatch when minEvents > 1, pollWait otherwise, so the default is byte-for-byte today's loop; doc comments, a tests/link net_handler case for the batched loop, the regenerated reference and the std line-move pins
        status: pending
      - id: bench-flags
        content: Give bench/handler-ring/run.sh and server.ts --min-events (a list) and --max-wait-ms, so one run interleaves ring at minEvents 1, 64 and 256 with maxWaitMs 1 in rotated order
        status: pending
      - id: bench-run
        content: Run the ring design at 18,000 and 96,000 connections with minEvents 1, 64 and 256, maxWaitMs 1, at the default rate, with the usual rounds; record server CPU µs per request, box µs, p50, p99 and p99.9, the noise band, the commit and the host
        status: pending
      - id: bench-record
        content: Add the table to docs/BENCHMARKS.md's handler-ring block, state the latency each batch adds over minEvents 1 at p50 and p99, say whether the profile's io_cqring_wait, io_eventfd_signal and epoll_wait shares move where it was measured, and name the commit; a Measured trailer in the commit
        status: pending
      - id: bench-docs
        content: The HttpHandler part of docs/guide/using-nish/networking.md names the two limits and when to set them; docs/security/handler.md covers the new limits' validation (bounds, zero, negative)
        status: pending
---

# Batched ring waits — pollWaitBatch and the direct ring wait

## Context

A ring-slot loop (`pollWait` over a `NET_LISTEN_RING` listener) wakes on the
first ready event. The rings reach `pollWait` through a per-ring eventfd that
sits in the set's epoll, which is a member of the loop's epoll
(`runtime/runtime-net.c` `nr_poll_wait`, `runtime/runtime-uring.c` `ur_enter`,
which never passes EXT_ARG). The owner profiled the twelve-dollar entry
`nish-std-amritk` at 90,000 connections. `io_cqring_wait` took 3.2% of the core,
`io_eventfd_signal` 1.2% and `epoll_wait` 1.0%. The top entry spends 0.9%, 0 and
0, because each pass submits and then waits for 256 completions or 1 ms,
whichever comes first (`IORING_ENTER_GETEVENTS` with `min_complete` and an
`EXT_ARG` timeout). Its bigger passes also share one SQLite COMMIT: the WAL
pwrite was 0.9% there against our 1.4%.

## Design decisions (for sign-off)

- **A new builtin, not a loop option.** `pollWaitBatch(loop, ready, timeoutMs,
  minEvents, maxWaitMs)` sits beside `pollWait`. `pollWait`'s declaration and
  ABI do not change, because `src/watch.ts` calls it and is built by the seed.
- **An idle loop does not spin.** The owner's sketch had four arguments, where
  `maxWaitMs` alone bounds the wait, so an idle server would wake 1,000 times a
  second. The plan adds `timeoutMs`. The wait blocks up to `timeoutMs` for the
  first event and then waits at most `maxWaitMs` more for `minEvents`. This is
  the kernel's `min_wait_usec` shape (6.13+), with two enters on older kernels.
- **Direct ring wait only when it is exact.** It applies when the loop holds one
  ring set with one ring and, at most, the signal fd, which it watches through a
  poll SQE on the ring. Anything else falls back to today's epoll path, which is
  correct for every loop.
- **HttpHandler's default is unchanged.** `minEvents` 1 is today's loop. Whether
  to change the default is a separate decision, taken after the numbers.

## Batch S1 — pollWaitBatch and the direct ring wait

**Owns:** `runtime/**`, `src/**`, `tests/**`, `docs/LANGUAGE.md`,
`docs/guide/using-nish/networking.md`, `docs/reference/**`, `docs/cookbook/**`,
`docs/IR_COOKBOOK.md`, `docs/security/**`, `docs/wp63-iouring-net.md`,
`scalar.config.json`

The interface and the runtime are one stage because the builtin is the only way
to exercise the runtime wait. Files that pin owned files are owned with them:
the goldens, `tests/runtime-budgets.js`, `tests/nish-cmp.js`,
`docs/reference/diagnostics/`, and the IR cookbook.

Read `docs/wp63-iouring-net.md` §2 and §3.3 first, and NURING-8, -14, -18 and
-20 in `docs/security/net-uring.md`.

## Batch S2 — HttpHandler limits and the measurement

**Owns:** `std/net/handler.ts`, `bench/handler-ring/**`, `docs/BENCHMARKS.md`,
`docs/guide/using-nish/networking.md`, `docs/reference/**`,
`docs/security/handler.md`, `docs/security/README.md`, `tests/**`,
`docs/wp63-iouring-net.md`

**Depends on:** batch-wait, both to start and to merge. It calls
`pollWaitBatch`, so it cannot be written against `main` until S1 lands. It
stays a separate stage because S1 is worth merging on its own, and the
measurement needs hours of bench time that would otherwise hold the feature.

Every figure follows CLAUDE.md's record rules: name the commit, quote a
maximum as a maximum, and report the noise band. If the container cannot hold
96,000 connections, say so and record the largest C it reached. Do not
substitute a different load.
