---
name: pollWaitBatch at least as cheap as a nap
overview: Nish 0.46.0's pollWaitBatch costs more CPU per request than the pollWait-then-empty-loop nap it was meant to replace. Make its window sleep without entering the ring per trickling completion, pump once, measure it against the nap at 18k and 96k, and report the send buffer pool's PSS.
spec: docs/wp63-iouring-net.md
priority: 80
stages:
  - id: batch-sleep
    title: pollWaitBatch sleeps its window out and pumps once, measured against the nap
    goal: On bench/handler-ring, pollWaitBatch(loop, ready, 1000, 64, 1) costs no more CPU per request than pollWait plus a 1 ms empty-loop nap after a short pass, at 18,000 and 96,000 connections, within the noise band; its window no longer services completions as they trickle in; the result, p50/p99 and the send pool's PSS are recorded in docs/BENCHMARKS.md.
    verification: node tests/run.js uring && node tests/run.js net_ring && node tests/run.js net_poll_batch && node tests/run.js net_handler && node tests/run.js handler-ring && node tests/run.js runtime-budget && node tests/run.js c-symbols && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && bash bench/handler-ring/run.sh --conns "18000 96000" --designs "ring ring-copy ring-nap" --min-events "1 64" --max-wait-ms 1
    status: pending
    todos:
      - id: diagnose
        content: Measure where nr_batch's extra CPU goes against the nap (enters per window, CQEs per wake — send completions count toward min_complete, so (min - n) CQEs can arrive before (min - n) ready slots — pumps and collects per window, task-work runs), with the NISH_URING_STATS counters or a temporary counter, and write the finding in the PR body
        status: pending
      - id: nap-design
        content: Add a ring-nap design to bench/handler-ring (server.ts env + run.sh) that runs the plain pollWait loop and, after a pass of fewer than 64 events, pollWait on an empty pollCreate() loop for 1 ms, as the entry's workaround does; it runs interleaved with ring@M and is printed against ring@1 like them
        status: pending
      - id: window-sleep
        content: Rework nr_batch so that after the first event the window is slept without GETEVENTS processing between completions (sleep the window out, e.g. a ppoll on the watched signalFd or a timed sleep, or one io_uring_enter whose min_complete and EXT_ARG timeout cannot end early on send CQEs), then nr_pump and nr_collect_from once; keep the early return when signalFd's poll answers, and keep the non-direct (no EXT_ARG, several sets, restricted ring) paths correct
        status: pending
      - id: tests
        content: A uring-test or tests/run.js check that fails when the window enters the ring or pumps once per trickling completion (count enters/pumps per batch window under a steady trickle), plus the existing batch checks (idle blocks timeoutMs, ≤ maxWaitMs after the first event, prompt SIGTERM) still passing
        status: pending
      - id: measure
        content: Run bench/handler-ring at 18,000 and 96,000 connections, interleaved rounds, designs ring@1, ring@64 (maxWaitMs 1), ring-nap and ring-copy for the band; record CPU µs/request, p50 and p99 per design with the noise band and the commit in docs/BENCHMARKS.md, and state whether pollWaitBatch is now at or below the nap
        status: pending
      - id: pss
        content: With BENCH_URING_STATS=1, report the ring server's PSS at 18k and 96k (heap, anon, pool_cached × 16 KiB, the mlist) beside the #2271 note in docs/security/net-uring.md, and reconcile it with the entry's 55 → 75 MB rise at 90k under 0.46.0 — say what of the 20 MB the pool explains and what it does not; report only, no cap change unless the figures show the cache is the whole rise
        status: pending
      - id: docs
        content: Update the nr_batch / nish_poll_wait_batch comments, docs/LANGUAGE.md and docs/guide/using-nish/networking.md if pollWaitBatch's observable timing changes (e.g. it now always sleeps the window instead of returning at minEvents), docs/security/net-uring.md rows that describe the batch wait, the runtime budgets and docs/wp7-runtime.md rows if .text moves, and docs/reference via gen-reference if runtime/nish.d.ts changes
        status: pending
---

# pollWaitBatch at least as cheap as a nap

## Context
Reported against 0.46.0 on the twelve-dollar entry nish-std-amritk (90,000 keep-alive connections on `NET_LISTEN_RING`, ~20k req/s, one core), same code otherwise:

| loop | CPU µs/request |
| --- | --- |
| `pollWaitBatch(loop, ready, 1000, 64, 1)` | 29.1 (minEvents 8: 29.7) |
| `pollWait`, then `pollWait` on an empty `pollCreate()` loop for 1 ms after a pass of < 64 events | 25.7 |
| plain `pollWait` | ~27.9 |

`nr_batch` (`runtime/runtime-net.c`) loops on `nish_uring_wait_direct` / `nish_uring_wait` for `(min - n)`, then `nr_pump` and `nr_collect_from`, once per wake, so during the window it serves completions as they trickle in. The empty-loop nap sleeps without entering the ring, so DEFER_TASKRUN's task work runs once, in the next wait, for everything that arrived. A likely amplifier: `min_complete` counts CQEs, and send completions are CQEs too, so the enter returns well before `(min - n)` slots are ready.

Built by the ring-batch-wait run (#2249, PRs #2256 and #2261); its open follow-up is #2263. The send pool PSS note came in with #2271.

## pollWaitBatch sleeps its window out and pumps once, measured against the nap
Owns: `runtime/runtime-net.c` `runtime/runtime-uring.c` `runtime/nish.d.ts` `tests/**` `bench/handler-ring/**` `docs/BENCHMARKS.md` `docs/LANGUAGE.md` `docs/guide/using-nish/networking.md` `docs/reference/**` `docs/security/net-uring.md` `docs/security/README.md` `docs/wp63-iouring-net.md` `docs/wp7-runtime.md` `scalar.config.json`
Model: lead (judgement on a kernel interaction and a perf claim).

The fix is measurement-gated: the stage is done when the recorded table shows ring@64 at or below ring-nap's CPU per request within the ring/ring-copy band at both connection counts. If no design reaches it, the PR records the data and the best design found, and says so.
