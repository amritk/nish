---
name: WP49 — async/await on the server, and the TechEmpower top
overview: Stage 6's gate is still unmet, since the async TechEmpower entries sit outside the explicit ones' noise band on plaintext and json. Two further items are left, awaitAll lane costs recorded open in the security record and the owner's decision on whether to submit to TechEmpower.
roadmap: docs/roadmap/wp49-async-server.md
spec: docs/wp49-async-server.md
priority: 10
labels: [ready]
issue: 1854
stages:
  - id: s6-gate
    title: WP49 S6 — the async entries within the explicit ones' noise band on plaintext, json and db
    goal: Re-run bench/techempower/run.sh unchanged and the async entry is inside the explicit one's band on every judged plaintext, json and db cell, with figures in docs/BENCHMARKS.md and WP49 stage 6 ticked.
    verification: node tests/run.js net_serve && node tests/run.js tfb && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js && npm run check && npm run lint
    status: pending
    issue: 1637
    related: [1402, 1468, 1509, 1610]
    labels: [needs-decision]
    todos:
      - id: s6-owner-choice
        content: Put the three remaining cuts to the owner with figures (design B borrowed view, spike-a revived with an inlined region switch, Router.match's last ~455 Ir) and record the choice — see WP49 S6, Decision on the cuts
        status: pending
      - id: s6-spike
        content: Spike each approved cut and measure Ir per request with bench/techempower/profile.sh plus a plain serve and Router app — see WP49 S6
        status: pending
      - id: s6-build
        content: Build the approved cut in std/net/serve.ts, std/net/router.ts or src/emit-async.ts, keeping every answered byte identical — see WP49 S6
        status: pending
      - id: s6-queries-cell
        content: Explain or fix the /queries?queries=20 c=64 cell that fell from 31,287 to 28,382 req/s in bench/techempower — see WP49 S6
        status: pending
      - id: s6-regate
        content: Re-gate with the unchanged run.sh before and after in one container, write the BENCHMARKS.md section, update docs/wp49-async-server.md section 10 and tick the roadmap box — see WP49 S6
        status: pending
  - id: awaitall-lanes
    title: WP49 S7 — awaitAll lanes, a lazy region for members that never wait and a free list for region tails
    goal: A awaitAll member that never waits pays no region, and a loop with no per-pass release no longer keeps the region's unused tail, with ASYNC-16 and ASYNC-17 updated in docs/security/async.md.
    verification: node tests/run.js async && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && node scripts/security-scope.mjs && npm run lint
    status: pending
    issue: 1327
    todos:
      - id: lazy-region
        content: Take a member's region only when it first pends and move what it allocated since its mark into the region then, in runtime/runtime-async.c — see WP49 S7 awaitAll lanes
        status: pending
      - id: tail-free-list
        content: Keep the caller's tail and the region's tail through a free list of tails, or copy the answer out, so adoption stops keeping the unused chunk tail — see WP49 S7 awaitAll lanes
        status: pending
      - id: measure-ratchet-rss
        content: Measure each fix with the instructions ratchet and an RSS test over 30k and 150k rounds, since Arena.used() cannot show ASYNC-17 — see WP49 S7 awaitAll lanes
        status: pending
      - id: update-record
        content: Move ASYNC-16 and ASYNC-17 from open to fixed in docs/security/async.md with before and after figures — see WP49 S7 awaitAll lanes
        status: pending
  - id: submit-techempower
    title: WP49 S8 — submit to TechEmpower
    goal: The owner has decided whether and when to submit the TechEmpower entry, and the decision is recorded in WP49 D6 and WP39 E9.
    verification: node docs/check-links.mjs && npm run lint
    status: pending
    labels: [needs-decision]
    issue: 1905
    todos:
      - id: submit-decide
        content: Record the owner's answer on submitting in docs/wp49-async-server.md section 9 D6 and docs/wp39-http-server.md E9 — see WP49 S8 Decision needed
        status: pending
---

# WP49 — async/await on the server, and the TechEmpower top

## Context
Stages 1 to 5 and the measured async entries of stage 6 have landed; see [the roadmap page](../../docs/roadmap/wp49-async-server.md). Left are the stage 6 gate, two recorded-open costs of `awaitAll`, and the submission question. Spec: [the design note](../../docs/wp49-async-server.md), section 10 holds the stage table and section 9 the decisions.

## WP49 S6 — the async entries within the explicit ones' noise band on plaintext, json and db
Spec: [design note §6](../../docs/wp49-async-server.md#6-tfb-what-the-top-takes) (the gate) and [§10](../../docs/wp49-async-server.md#10-stages).
Five reports, one gap, each a regate after a different build. The newest, #1637, is the state to start from: after the resume build (#1621) 4 of 11 judged cells are inside (json 64, json 128, db 64, db 256); plaintext 256/1024/4096 and json 16/256 are outside; json 32 and 512 are not judgeable in that container. Peak RSS at plaintext c=16384 went 32.4 to 26.9 MiB.
- #1402: the first gate, plaintext −33% to −71%, json −2.5% to −17%, db −74% to −79%.
- #1468: after the profile-led fixes; names task memory, the layered hand-off and the router as the remaining Ir.
- #1509: after task recycling and the one-pass answer; the static-route table #1491 was escalated, and read-in-place is blocked by the checker's region rules.
- #1610: after the hand-off build (#1601, #1596); flags `/queries?queries=20` at c=64 as worse beyond both bands (−9.3%).
- #1637: after the resume build; the async entry still runs about 2,054 more instructions a request than the explicit one on plaintext and 2,425 on json (second task about 425, router about 455 and 348, `serveTask`'s request copy about 378).
Owner's rules from #1637, unchanged: only changes that help regular serve and Router users; nothing in `bench/techempower/` or `run.sh`; no kept epoll registrations; every answered byte identical; serve invariants and `net_serve_*` and `tfb_async_*` probes hold; public API source-compatible; no judged or recorded cell worse beyond its band. Workers must get `wrk` working before measuring; a new tests/link probe importing `std/net/*` needs its own nish-cmp DECLARED entry. #1637 carries a ready `/feature` prompt.
Likely files: `std/net/serve.ts`, `std/net/router.ts`, `std/net/handler.ts`, `runtime/runtime-async.c`, `src/emit-async.ts`, `docs/BENCHMARKS.md`.

### Decision on the cuts
Which of the three remaining cuts to build, asked of the owner first with figures (this stage is not labelled needs-decision so the lead can ask and continue). (a) Design B, a task reads its spawner's slot in place through a borrowed non-growable view; removes about 378 Ir but is a construct (ARCHITECTURE checklist, rolling freeze), ceiling about 370 Ir. (b) Spike-a (#1620) revived with the region switch inlined so a suspending handler pays nothing, plus a RUNTIME_ASYNC_TEXT_BUDGET raise; about −132/−112 Ir on a non-suspending handler. (c) Router.match's remaining about 455 Ir. No recommendation in the issues; the unsound upper bound of dropping spawn, region and copy together was about 760 Ir.

## WP49 S7 — awaitAll lanes, a lazy region for members that never wait and a free list for region tails
Issue #1327. #1320 gave each `awaitAll` member a region of its own (HF-13); two costs are recorded open in `docs/security/async.md`.
- ASYNC-16: a member that never waits pays make, enter, leave, adopt, retire and a lock in threaded builds, about 25 to 29 ns a call against about 4.6 ns before. Fix: take the region only when the member first pends and move what it allocated since its mark into it.
- ASYNC-17: a loop with no per-pass release keeps about 1.3 KB per joined call against about 0.43 KB of answer; 30k rounds peak at 76 MB, 150k at 386 MB, because adoption keeps the region's first chunk with its unused tail.
Measure each fix with the instructions ratchet and an RSS test. Likely files: `runtime/runtime-async.c`, `std/async.ts`, `docs/security/async.md`, `tests/runtime-budgets.js`.

## WP49 S8 — submit to TechEmpower
Spec: [design note §9, D6](../../docs/wp49-async-server.md#9-decisions) (shared with WP39 E9). D6 says submission waits for every test type to pass the verifier with numbers from a separate client machine, and a public number is the owner's call each time. The stage-6 gate still stands.

### Decision needed
Whether and when to submit. An open, unmerged PR (#1809) proposes retiring the TechEmpower submission in favour of HttpArena (WP71 to WP73): it records that TechEmpower archived its Framework Benchmarks on 2026-03-24 and takes no entries, moves WP39 E9 to not planned and calls D6 moot. Options: (1) accept #1809 and close this stage as not planned; (2) keep it open until the owner rules on #1809; (3) submit anyway, which #1809's premise says is not possible. Recommended: resolve #1809 first, since if it merges this stage is moot.
