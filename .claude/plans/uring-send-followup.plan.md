---
name: Ring send coalescing follow-up — PSS, SENDs under load, large sends without malloc
overview: "Follow-up to the uring-send-coalesce run (#2247, #2252, #2251, issue #2260). Attribute and fix or record the PSS rise, count SENDs per response under real load, send writes over UR_CHUNK_DATA from chained pool buffers, and fix the record and benchmark nits."
priority: 80
issue: 2260
stages:
  - id: send-runtime
    title: "S1 — large sends from pool buffers, a stats dump the server prints, and the PSS attribution"
    goal: "A write over UR_CHUNK_DATA is sent from chained pool buffers with no allocation per send in steady state; a ring server can print its nish_uring_stats when an environment knob asks; the PSS rise after #2252 is attributed per component at 18k and 96k and fixed or recorded; NURING-12 and NURING-44 read true; the runtime budget and its wp7 rows match the measured .text."
    verification: "node tests/run.js uring && node tests/run.js runtime-budget && node tests/run.js c-symbols && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs"
    status: pending
    todos:
      - id: chain-large-sends
        content: "In runtime/runtime-uring.c, split a write above UR_CHUNK_DATA (and a pool record a body overflows) across chained pool records instead of one exact malloc in ur_record; state how many SENDs a 64 KiB response takes and keep NURING-40's one-SEND result for small responses"
        status: pending
      - id: bigsend-mode
        content: "Add a uring-test mode (e.g. bigsend) that sends steady 64 KiB responses and fails on any allocation after warm-up, exact mallocs included (a counter beside pool_new, or an interposed malloc); show in the PR that it fails with the chaining removed; register it in tests/run.js's uring mode list"
        status: pending
      - id: shutdown-record
        content: "Take nish_uring_shutdown's record without a calloc per close, or record why not in NURING-44"
        status: pending
      - id: stats-dump
        content: "Let a ring server print its nish_uring_stats (sends, pool_new, pool_held, pool_cached, live, slots) on request, e.g. at exit or on a signal when an environment variable is set; default behaviour and output unchanged without it; c-symbols reserves any new libc call; the networking guide names the knob"
        status: pending
      - id: pss-attribution
        content: "Run bench/handler-ring at 18k and 96k (ring, h1-ring, with --base-compiler at c12ccb0f^) and read PSS against pool_held and pool_cached and the per-slot arrays #2252 added; attribute the +1.6–1.9 MiB at 96k and +0.4 MiB at 18k; fix it in the runtime or record the split and the decision in net-uring.md"
        status: pending
      - id: record-nits
        content: "Fix NURING-44's location column (ur_append was folded into nish_uring_send) and NURING-12's 256 KiB wording (bytes, while buffer memory can reach NURING-44's figure); add rows for any new finding; keep NURING-44 open unless a check pins a slot's whole memory; keep docs/security/README.md's counts and rows in step"
        status: pending
      - id: budget-rows
        content: "Re-measure clang -Oz .text of runtime-uring.c, move RUNTIME_URING_TEXT_BUDGET in tests/runtime-budgets.js with its comment, and bring docs/wp7-runtime.md's ceiling row and history rows up to date (they still say 9,728 / 9,477, missing the direct-wait merge)"
        status: pending
  - id: send-bench
    title: "S2 — SENDs per response under load and a main-reachable bench commit"
    goal: "bench/handler-ring reports SENDs per response from the server's printed stats at 18k and 96k, before and after #2252; docs/BENCHMARKS.md records it with a main-reachable commit, and the coalescing section's c664c0ed is replaced by the commit main holds."
    verification: "bash bench/handler-ring/run.sh --nodb --quick && node tests/run.js handler-ring && node docs/check-links.mjs && npm run lint"
    status: pending
    todos:
      - id: bench-sends
        content: "Have bench/handler-ring/run.sh set S1's stats knob on the server, read the SEND count and divide by responses served, and print sends/rsp beside out/rsp; a base compiler without the knob prints n/a rather than a wrong figure; a tests/run.js handler-ring check pins the parsing"
        status: pending
      - id: bench-run
        content: "Run 18k and 96k for ring and h1-ring with --base-compiler at c12ccb0f^ (the before side then prints n/a for SENDs, so also run the after side with coalescing measured per the knob), 5 rounds, and record SENDs per response, packets per response, CPU per request with its noise band, and PSS"
        status: pending
      - id: bench-record
        content: "Add the results to docs/BENCHMARKS.md naming a commit main can reach (this PR's squash commit or a commit already on main), and replace c664c0ed in the 'Coalesced ring sends, before and after' section with 13e36187, which landed that bench code"
        status: pending
---

# Ring send coalescing follow-up

## Context

#2252 (c12ccb0f) made a ring slot's head and body and back-to-back
`netWrite`s leave as one SEND, with a per-ring pool of 16 KiB send
buffers capped at 32 free. #2251 (13e36187) added packets per response and
`--base-compiler` to `bench/handler-ring`. Issue #2260 lists what the
acceptance pass of #2247 left: a write above `UR_CHUNK_DATA` still mallocs
once per send (`ur_record`, `runtime/runtime-uring.c:1073`), no bench reads
`nish_uring_stats`, PSS rose with no attribution, and the benchmark section
names a branch commit main never saw.

Facts from the code at 4d557ecc:

- `struct nish_uring_stats` already has `sends`, `pool_new`, `pool_held`
  and `pool_cached`. Only `tests/runtime/uring-test.c` reads them.
- `uring-test` mode `pool` pins `pool_new` after warm-up; no mode counts
  exact mallocs.
- `RUNTIME_URING_TEXT_BUDGET` is 10,240 with 9,936 measured;
  `docs/wp7-runtime.md` row 196 still says 9,728 / 9,477.
- NURING-45..50 were added by #2256 (ring-batch-wait); new findings take
  the next free number.

S2 depends on S1's merge: it reads the stats S1 makes printable. The two
share no concurrent files.

## S1 — large sends from pool buffers, a stats dump the server prints, and the PSS attribution

**Owns:** `runtime/runtime-uring.c` `runtime/runtime-net.c` `runtime/nish.h` `src/c-symbols.ts` `tests/runtime/uring-test.c` `tests/run.js` `tests/runtime-budgets.js` `docs/wp7-runtime.md` `docs/security/net-uring.md` `docs/security/README.md` `docs/wp63-iouring-net.md` `docs/guide/using-nish/networking.md` `bench/handler-ring/**`

`runtime-uring.c`'s `.text` grows, so this stage owns the budget file and
its wp7 rows. It owns `bench/handler-ring/**` only to measure PSS; S2
changes the bench's output. The PSS figures go in `net-uring.md` (and the
PR body); S2 copies them into BENCHMARKS.md if it re-runs them.

## S2 — SENDs per response under load and a main-reachable bench commit

**Owns:** `bench/handler-ring/**` `bench/fd-limit/loadgen.c` `docs/BENCHMARKS.md` `tests/run.js`

Starts after S1 merges. A BENCHMARKS.md table names a commit main can
reach.
