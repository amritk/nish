---
name: WP49 stage 6, the gap, second run — task memory, the serve hand-off and static routes
overview: Bring the async TechEmpower entry inside the entry vs entry-copy band on plaintext, json and /db by recycling task memory in the executor, letting serveTask read the handler's request in place, and answering static routes from an exact-path table, after first making run.sh compare one worker against one worker. Then mark WP49 stage 6 built and close issues 1402 and 1468. The owner approved the redesign on 2026-11-12.
stages:
  - id: baseline-check
    title: "test(net): compare one worker against one worker in the TechEmpower gate and re-baseline (WP49 stage 6)"
    goal: run.sh's default comparison is like for like after PR 1448 — entry, entry-copy and async each one process on the same pinned CPU — and main is re-measured and re-profiled on that footing, so every later figure has a baseline.
    verification: bash -n bench/techempower/run.sh && shellcheck -S warning bench/techempower/*.sh && bash bench/techempower/run.sh --quick --only plaintext && node docs/check-links.mjs && npm run lint
    status: pending
    todos:
      - id: baseline-observe
        content: Show what the default run.sh starts today — process count and CPU affinity of entry, entry-copy and async under taskset, read from /proc while it serves — see Baseline check
        status: pending
      - id: baseline-fix
        content: Make run.sh's default contestants one worker each (pass the explicit worker count 1 to entry and entry-copy, fix the stale comment) without touching main.ts or server.ts — see Baseline check
        status: pending
      - id: baseline-remeasure
        content: Re-run the gate on main with the fixed run.sh, in the foreground, split by test, and re-run profile.sh for Ir per request — see Baseline check
        status: pending
      - id: baseline-record
        content: Record the re-baseline in a new docs/BENCHMARKS.md section outside every generated block, and update bench/techempower/README.md and the §6 note of docs/wp49-async-server.md — see Baseline check
        status: pending
  - id: task-recycle
    title: "perf(runtime): recycle a finished task's frame and region instead of freeing them (WP49 stage 6)"
    goal: A spawned task that ends hands its frame and its region back to the executor for the next spawn, so a request's task costs no malloc, free or region teardown, with no change to what a wait asks of the kernel.
    verification: npm run check && npm run lint && node tests/run.js async && node tests/run.js runtime-budget && node tests/run.js net_serve && node tests/run.js tfb && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js && node scripts/security-scope.mjs
    status: pending
    todos:
      - id: recycle-region
        content: Keep a finished task's region on a free list in runtime/runtime-async.c and reset it for the next spawn instead of nish_region_free and nish_region_new — see Task recycle
        status: pending
      - id: recycle-frame
        content: Trim nish_async_spawn and nish_async_done to the recycled path, and change src/emit-async.ts only if the frame set-up it emits is part of the cost — see Task recycle
        status: pending
      - id: recycle-safety
        content: Prove a recycled region leaks nothing between tasks — a link test where task B cannot read task A's bytes, the generation check still drops a late completion, and RSS stays flat over many spawns — see Task recycle
        status: pending
      - id: recycle-budget
        content: Hold RUNTIME_ASYNC_TEXT_BUDGET in tests/runtime-budgets.js, or raise it by the measured amount with the reason in the PR body and docs/security/async.md — see Task recycle
        status: pending
      - id: recycle-measure
        content: Report profile.sh Ir per request before and after and run.sh plaintext, json and db with the band, and show the strace phase's per-request syscall counts unchanged — see Measuring a fix
        status: pending
      - id: recycle-docs
        content: Update docs/security/async.md (what a recycled region may hold, SERVE-7's cross-reference) and add DECLARED entries for any corpus IR that moves — see Task recycle
        status: pending
  - id: serve-handoff
    title: "perf(net): serveTask reads the handler's request in place (WP49 stage 6)"
    goal: A served request reaches its handler without being copied through serveOn, HttpHandler and serveTask — the task reads the slot's parsed request where the handler left it — and the answer path drops the bookkeeping the layering added, with the region and lifetime rule that makes it safe written down.
    verification: npm run check && npm run lint && node tests/run.js net_serve && node tests/run.js tfb && node tests/run.js net_http1_server && node tests/run.js net_router && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && node docs/check-links.mjs
    status: pending
    todos:
      - id: handoff-lifetime
        content: Write the lifetime rule first, in docs/security/serve.md — how long a slot's request bytes stay untouched, who may write the slot, what a task that outlives its connection reads — and revisit SERVE-4 and SERVE-7 against it — see Serve hand-off
        status: pending
      - id: handoff-read-in-place
        content: Replace serveTask's copy of head, spans, params and body in std/net/serve.ts with a Request over the slot's own HttpRequest, keeping the slot pinned until the task answers — see Serve hand-off
        status: pending
      - id: handoff-answer-path
        content: Cut the per-request bookkeeping between serveAnswer and HttpHandler start, write, end, enqueue and settle that the profile attributes to the layering, without changing Http1Server or the JSON writer — see Serve hand-off
        status: pending
      - id: handoff-tests
        content: Pin the rule with link tests — a pipelined batch whose later request arrives while an earlier task still reads, a hangup while a task holds its slot, a body at the slot cap — each with a before and after — see Serve hand-off
        status: pending
      - id: handoff-measure
        content: Report profile.sh Ir per request before and after and run.sh plaintext, json and db with the band, and show the explicit entry's Ir unchanged — see Measuring a fix
        status: pending
      - id: handoff-docs
        content: Update docs/guide/using-nish/async-server.md if a user-visible rule changes (what a handler may keep from its Request), regenerate docs/reference, and add DECLARED entries — see Serve hand-off
        status: pending
  - id: static-routes
    title: "perf(net): answer static routes from an exact-path table ahead of the trie walk (WP49 stage 6)"
    goal: A route with no parameter or wildcard is matched by one exact-path lookup, so /plaintext and /json never enter Router.walk, and every route still resolves to the handler the trie would have picked.
    verification: npm run check && npm run lint && node tests/run.js net_router && node tests/run.js net_serve && node tests/run.js tfb && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && node docs/check-links.mjs
    status: pending
    todos:
      - id: static-table
        content: Build an exact-path table for static routes in std/net/router.ts at registration, in the flat i32 arrays the router already uses, and consult it in match before walk — see Static routes
        status: pending
      - id: static-equivalence
        content: Prove the table and the trie agree — a link test that matches every registered and many unregistered paths both ways, including method mismatch, trailing slash, a static route shadowed by a parameter route, and the limits the negative tests pin — see Static routes
        status: pending
      - id: static-security
        content: Update docs/security/router.md for the table (collision behaviour, bounds, the cost of a hostile path) and docs/guide/using-nish/http-router.md if matching order is described there — see Static routes
        status: pending
      - id: static-measure
        content: Report profile.sh Ir per request before and after, bench/router.ts, and run.sh plaintext and json with the band — see Measuring a fix
        status: pending
      - id: static-declared
        content: Add DECLARED entries to tests/nish-cmp.js for corpus programs whose IR moves — see Generated and shared files
        status: pending
  - id: regate
    title: "docs(net): the async TechEmpower entry re-gated after task recycling, the in-place hand-off and static routes (WP49 stage 6)"
    goal: The gate is measured on main with all three fixes merged, the figures are in docs/BENCHMARKS.md, and WP49 says what the figures say — stage 6 built if every judged cell is inside the band, and the plain truth if not.
    verification: node docs/check-links.mjs && npm run lint && node scripts/gen-reference.mjs --check && grep -n "| 6 |" docs/wp49-async-server.md
    status: pending
    todos:
      - id: regate-measure
        content: Run run.sh on merged main in the foreground, split by test, full rounds, and profile.sh for the final Ir per request — see Regate
        status: pending
      - id: regate-record
        content: Add a new docs/BENCHMARKS.md section outside every generated block with each judged cell, its band and the verdict, and update bench/techempower/README.md — see Regate
        status: pending
      - id: regate-status
        content: If and only if every judged cell is inside the band, set docs/wp49-async-server.md §6, §9 D1, §10 stage 6 and the status line to built, tick the stage 6 gate box in docs/roadmap/wp49-async-server.md, and put Fixes 1402 and Fixes 1468 in the PR — see Regate
        status: pending
      - id: regate-honest
        content: If any judged cell is outside, record the figures and the remaining Ir gap, leave stage 6 at measured and the issues open, and say so in the PR body — see Regate
        status: pending
---

# WP49 stage 6, the gap, second run

## Context

The first gap run (ledger #1407) profiled the async TechEmpower entry and merged four
fixes (#1410 profile, #1421 serve, #1419 pool, #1459 trim), re-measured in #1465. The
gate of `docs/wp49-async-server.md` §6 still fails on `plaintext` 256/1,024/4,096,
`json` 128/512 and `/db` 64 (#1468, #1402).

What `profile.sh` left on #1459's head, per request: async 8,507 Ir against explicit
5,411 on plaintext, 9,887 against 6,588 on json.

| share | where | this run |
| --- | --- | --- |
| about 750 | task memory in `runtime/runtime-async.c`: a region made and freed per task, spawn/done | `task-recycle` |
| about 2,100 | the `serveOn` → `HttpHandler` → `serveTask` hand-off, of which the router walk is 450 to 580 | `serve-handoff`, `static-routes` |
| about 190 / 450 | `Http1Server` and the JSON writer, shared with the explicit entry | out of scope |

**Found while planning.** On main `ba4e8aef`, `run.sh`'s default contestants are
`entry`, `entry-copy` and `async` with no worker argument (`run.sh` L210). Since #1448,
`main.ts` with no worker argument preforks one worker per core and pins worker k to
CPU k, while `async-main.ts` is always one process. Only `--cores-compare` passes the
explicit `1`. So the comparison the gate rests on may no longer be one worker against
one worker, and the comment at `run.sh` L48 still says it is. `baseline-check` settles
what actually runs and fixes it before any other stage starts.

## Approach

Five stages, five PRs. `baseline-check` lands first and alone. The three fixes are
written in parallel once it has merged, since they share no source file, and they merge
one at a time in the order `task-recycle`, `serve-handoff`, `static-routes`. `regate`
starts when all three are on main.

| stage | starts after | merges after |
| --- | --- | --- |
| baseline-check | — | — |
| task-recycle | baseline-check merged | baseline-check |
| serve-handoff | baseline-check merged | task-recycle |
| static-routes | baseline-check merged | serve-handoff |
| regate | all three merged | all three |

Rules that hold for every stage:

- **The per-wait system calls stay as they are.** #1374 ruled out kept epoll
  registrations; that stands. No stage removes or batches the dup, `EPOLL_CTL_ADD`,
  `EPOLL_CTL_DEL` or close a wait makes. `profile.sh`'s strace phase shows it.
- **The explicit baseline does not move.** `bench/techempower/main.ts`, `server.ts`,
  `db-main.ts`, `db-server.ts`, `std/net/http1-server.ts`, `std/net/http1-codec.ts` and
  the JSON writer are not edited. A fix that speeds up the explicit entry too is
  reported as such, with explicit's Ir before and after.
- **Nothing is built on the owner's two open questions.** No change whose gain depends
  on batching concurrent `/db` reads into one `unnest($1::int8[])` statement; `/db` is
  measured with the batching both entries have today. `std/net/postgres-async.ts`,
  `postgres-carrier.ts` and `bench/techempower/async-db-*.ts` are not edited. The
  baseline question is answered by `baseline-check`'s evidence, not assumed.
- **`async` in `src/` stays out.** `src/emit-async.ts` is the lowering, written in the
  frozen subset; it may not use a new construct.

## Baseline check

**Owns:** `bench/techempower/run.sh`, `bench/techempower/profile.sh`, `bench/techempower/README.md`, `docs/BENCHMARKS.md`, `docs/wp49-async-server.md`

1. **Observe.** Start the default contestants the way `run.sh` does and read, for each,
   the number of processes and each one's `Cpus_allowed_list` from `/proc/<pid>/status`
   while it serves. State the answer in the PR body: one worker each, or not. Also
   check `profile.sh` and the db wrappers (which already pass `1 4`).
2. **Fix.** If `entry` and `entry-copy` are not one process on the server CPU, pass the
   explicit worker count `1` in the default contestants (as `--cores-compare` already
   does for its one-worker leg) and correct the comment. `main.ts` and `server.ts` are
   not edited. If they already are one process each, change nothing but the comment and
   say so.
3. **Re-measure** main with the result: `run.sh --only plaintext`, `--only json`,
   `--only db`, default rounds and duration, each in its own foreground call. Then
   `profile.sh` for plaintext and json. Record Ir per request for both entries.
4. **Record** in a new `docs/BENCHMARKS.md` section after "re-measured after the
   profile-led fixes", outside every `<!-- name:begin/end -->` block: what ran before
   the fix, what runs now, every judged cell with its band, and the Ir figures. Note in
   §6 of `docs/wp49-async-server.md` which baseline the gate is read against from here
   on. Do not change §10 or the status line beyond that note.

This stage's figures are the "before" of every fix PR.

## Task recycle

**Owns:** `runtime/runtime-async.c`, `runtime/runtime-region.c`, `runtime/nish.h`, `src/emit-async.ts`, `tests/runtime-budgets.js`, `tests/link/async_*/**`, `tests/cases/async_*`, `tests/run.js` (its own sections), `tests/nish-cmp.js` (its own DECLARED entries), `tests/shard-costs.json` (its own rows), `tests/differential/**`, `docs/security/async.md`, `docs/IR_COOKBOOK.md`, `tests/self/goldens/checked/**`

Today `nish_async_spawn` takes a frame from a per-kind slab (never returned to malloc)
and makes a region with `nish_region_new` (`runtime-async.c` L271); `nish_async_done`
frees it with `nish_region_free` (L316). The profile's 750 Ir is that region's
malloc/free, its teardown, and the spawn/done bookkeeping.

- Recycle the region: a finished task's region is reset and kept for the next spawn,
  per executor (one thread, no lock). Bound what is kept so one large request cannot
  pin its high-water mark for ever — cap the retained size, release what is above it,
  and measure RSS, not `Arena.used()`.
- A reset region must not let the next task read the last one's bytes where the
  language promises fresh memory. Say in `docs/security/async.md` what is and is not
  zeroed and why that is sound, and pin it with a test.
- The generation check that drops a late completion (`async_late_completion`) and
  `async_region_per_task` keep passing unchanged.
- `RUNTIME_ASYNC_TEXT_BUDGET` (3,840 bytes) holds, or the PR raises it by the measured
  amount and says why.
- If `src/emit-async.ts` changes, every `tests/cases/async_*.ll` golden moves with it
  and is shown in the PR; `wasi` and `performance` run before the push.

## Serve hand-off

**Owns:** `std/net/serve.ts`, `std/net/handler.ts`, `bench/techempower/async-main.ts`, `bench/techempower/async-server.ts`, `tests/link/net_serve*/**`, `tests/link/tfb_async_entry/**`, `tests/run.js` (its own sections), `tests/nish-cmp.js` (its own DECLARED entries), `tests/shard-costs.json` (its own rows), `docs/security/serve.md`, `docs/security/handler.md`, `docs/guide/using-nish/async-server.md`, `docs/reference/**`, `tests/self/goldens/checked/**`

Today (`std/net/serve.ts` L582 to L671) the handler parses into the slot's
`st.reqs[k]`, then `serveTask` allocates a second `HttpRequest` in its own region and
copies head, spans, params and body into it before calling the user's handler; the
answer is copied back into the slot's buffers and sent through
`HttpHandler.start/write/end`.

- The copy exists because of the region story in `docs/security/serve.md` (the intro,
  SERVE-4, SERVE-7): a task owns only its region, and the slot belongs to the loop.
  Reading in place needs a rule to replace it. Write that rule first: the slot's
  request bytes are not rewritten, compacted or reused until the task has answered and
  the slot is released; a pipelined successor parses into a different slot; a hangup
  marks the slot and leaves the bytes until the task ends. Then build to it.
- What the user's handler may keep is a user-visible rule. If a `Request` now aliases
  the slot, either the checker's existing region rules already refuse keeping it past
  the handler, or the guide says so. Show which, with a negative test if it is refused.
- The copy of the answer back into the slot (SERVE-4's bounds) stays unless it can be
  removed with the same proof. Its 500-on-overflow behaviour and its six pins stay.
- `std/net/handler.ts` is shared with code outside `serve`. A change there must leave
  the explicit entry's Ir and IR unchanged, shown by nish-cmp and `profile.sh`.
- `std/net/router.ts` belongs to `static-routes`. Do not edit it here.

## Static routes

**Owns:** `std/net/router.ts`, `bench/router.ts`, `tests/link/net_router*/**`, `tests/run.js` (its own sections), `tests/nish-cmp.js` (its own DECLARED entries), `tests/shard-costs.json` (its own rows), `docs/security/router.md`, `docs/guide/using-nish/http-router.md`, `docs/reference/**`, `tests/self/goldens/checked/**`

`Router.match` (`std/net/router.ts` L447) always enters the recursive `walk` (L524).
A route with no parameter and no wildcard can be found by its whole path.

- The table is built at registration, in flat arrays like the rest of the router, with
  a bounded probe. A path that misses the table falls through to the trie unchanged.
- The trie stays the definition of correctness: for every path, table-then-trie gives
  the handler trie-only gives. Where a static route and a parameter route both match,
  the answer is the one the trie gives today.
- A hostile path costs no more than it does today: the lookup is bounded by the path
  length the router already caps, and collisions cannot be driven by the client beyond
  the registered set.
- `std/net/serve.ts` and `handler.ts` belong to `serve-handoff`. If the gain needs a
  change at the call site, say so in the PR body for `regate` instead of editing them.

## Measuring a fix

Every fix PR carries, in its body and its squash commit's `Measured:` trailer:

- `bash bench/techempower/profile.sh --only plaintext` and `--only json`: Ir per
  request, async and explicit, before (main at the PR's base, with `baseline-check`
  merged) and after (the branch), same container.
- `bash bench/techempower/run.sh --only plaintext`, `--only json`, `--only db`: the
  async delta and the entry vs entry-copy band on each judged cell, before and after.
- The strace phase's system calls per request for the async entry, unchanged.

How to run them here, from the last run's ledger:

- **Foreground only.** An idle container is reclaimed with its background run. One
  `--only` test per call so each stays under the per-call limit; lower `--rounds` or
  `--duration` only if a call cannot fit, and say so.
- The container has no `wrk`, `perf` or `strace` until installed; `run.sh` installs
  `wrk` with apt. Postgres 16 binaries are in `/usr/lib/postgresql/16/bin`.
- Measure memory as RSS, not `Arena.used()`.
- One machine, interleaved, as `run.sh` does it. A figure from one run is not a result.

A fix is worth merging on its Ir reduction even if a `run.sh` cell is still outside
the band: the gate is judged once, by `regate`, on all three together.

## Regate

**Owns:** `docs/BENCHMARKS.md`, `docs/wp49-async-server.md`, `docs/roadmap/wp49-async-server.md`, `docs/roadmap/index.md`, `bench/techempower/README.md`

Judged cells, one-sided (inside when d ≥ −band, no flagged cell): `plaintext` at
c=256, 1,024, 4,096; `json` at c=16, 32, 64, 128, 256, 512; `/db` at c=64 and 256.
Recorded, not judged: `plaintext` c=16,384, `db` c=16, and the other db tests.

- All inside: §10 stage 6 reads built, the status line says D1's condition holds, the
  roadmap's gate box is ticked, and the PR carries `Fixes #1402` and `Fixes #1468`.
- Any outside: the figures and the remaining Ir gap are recorded, stage 6 stays
  "measured, gate not met", and the issues stay open. The stage does not tune, re-run
  until lucky, or change `run.sh` to get a pass.

## Generated and shared files

- `tests/self/goldens/checked/**`, `docs/reference/**`, `tests/differential/goldens*`
  and `tests/shard-costs.json` are regenerated with the repo's tooling
  (`node tests/self/goldens.js --update`, `node scripts/gen-reference.mjs`,
  `npm run sync-main` to take in main), never edited or merged by hand.
- `tests/nish-cmp.js` conflicts on every sync. Each stage adds only its own `DECLARED`
  entries, and on a conflict keeps both sides' entries.
- `tests/run.js` is shared by the three fix stages for their own sections only. They
  merge one at a time, and each syncs main before its turn.
- `docs/BENCHMARKS.md` is written only by `baseline-check` and `regate`. Fix PRs put
  their figures in the PR body and the `Measured:` trailer.

## Out of scope

Promises as values, `for await`, async on wasm, HTTP/2 and HTTP/3 under `serve`,
moving tasks between threads, async in `src/`, a public TFB submission, the shared
HTTP/1 codec and JSON writer (a separate run, ledger #1416), the `/db` batching
question, and any change to a wait's system calls.

## Acceptance

Checked on main after the last merge, by something other than reading the diff.

1. `run.sh`, as merged, starts `entry`, `entry-copy` and `async` as one process each
   on the same pinned CPU (process count and affinity read from `/proc` while serving).
2. `run.sh` on merged main puts the async median inside the entry vs entry-copy band
   (d ≥ −band, no flagged cell) on `plaintext` c=256, 1,024, 4,096; `json` c=16 to 512;
   `/db` c=64 and 256, with the `/db` batching as it stands on both entries.
3. `docs/BENCHMARKS.md` has the re-baseline section and the re-gated section, both
   outside every generated block, with each judged cell's figure and band; each fix
   PR's squash commit has a `Measured:` trailer with Ir before and after and the band.
4. `docs/wp49-async-server.md` §10 shows stage 6 built, the status line agrees,
   the roadmap's gate box is ticked, and #1402 and #1468 are closed.
5. The async entry still answers `/plaintext` and `/json` byte for byte like `main.ts`,
   16-deep pipelining included, and `node tests/run.js` for `net_serve`, `net_router`,
   `async` and `tfb` passes on main.
6. `profile.sh`'s strace phase shows the async entry's system calls per request no
   different in kind or count from the re-baseline (no kept registrations).
7. `git diff <base>..main` is empty for `bench/techempower/{main,server,db-main,db-server,async-db-main,async-db-server}.ts`,
   `std/net/http1-server.ts`, `std/net/http1-codec.ts`, `std/net/postgres-async.ts`
   and `std/net/postgres-carrier.ts`, except for changes merged by PRs outside this run.
8. `NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js` is green on main, and
   `node tests/run.js runtime-budget` passes with the async budget unchanged or raised
   by an amount a merged PR states and justifies.

## Verification

- Local, per stage: the stage's `verification` line; `npm run check`; `npm run lint`
  and `npm run lint:dead`; `node tests/run.js <filter>` for what it touches.
- `src/` changes: `WASI_SYSROOT=/usr node tests/run.js wasi` and
  `node tests/run.js performance`.
- Full suite: CI's `test (…, shard N/8)` rows on the PR's head.
