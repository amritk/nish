---
name: Router prover performance — win back std-router's 4.3% by proving its guards
overview: The panic-free sweep (04495bf8) raised the std-router instruction count from 155,580,314 to 162,304,316 (+4.32%), because std/net/router.ts gained about 22 hand-written guards whose comment says they are never true — the range prover cannot carry a bound around a while loop, out of a call, or out of a private field. This plan teaches src/bounds.ts those three facts, deletes the guards it then proves, and gates std-router at or below 155,580,314 with the std-panics ratchet unchanged or lower. No library helpers; the prover does the work.
priority: 250
issue: 2220
stages:
  - id: rp-s1-attribute
    title: Router perf S1 — attribute the +6.7M instructions
    goal: Know which router guards cost what on the std-router hot path before any compiler work, so later stages target the expensive ones first.
    verification: The attribution table (function, guard line, instructions at 04495bf8^ and at main) is in the S1 issue comment and in this plan's S1 section, and the per-function deltas sum to within 5% of 6,724,002.
    issue: 2221
    todos:
      - id: rp-s1-cachegrind
        content: Run cachegrind with --dump-instr=yes on bench/std-router.ts built at 04495bf8^ and at main, and table the per-function and per-line instruction deltas for match, enter, staticRoute, descend, span, answer, walk, pushPair, endpointFor and routerDecode — see Router perf S1
        status: pending
      - id: rp-s1-classify
        content: Tag each guard in the table with its family (loop-carried, cross-call, field invariant, parallel array, power-of-two mask) and record which stage removes it — see Router perf S1
        status: pending
  - id: rp-s2-loops
    title: Router perf S2 — loop-carried bounds in while loops and conjunctive conditions
    goal: The prover keeps a loop counter's bound across a while loop whose condition is a conjunction, and bounds a counter that rises at most once per pass by the loop variable's range, so the router's segments, end and length guards are proved.
    verification: node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/nish-cmp.js && bash scripts/bootstrap.sh --verify
    issue: 2222
    todos:
      - id: rp-s2-passbound
        content: Extend passBound in src/bounds.ts to read a bound from any conjunct of a && condition, and accumulatorFacts to while loops whose step is the last statement of the body — see Router perf S2
        status: pending
      - id: rp-s2-counter
        content: Add the at-most-once-per-pass counter fact in src/bounds.ts (a local incremented by one on some paths of each pass, never written otherwise, is bounded by its entry value plus the trip bound) — see Router perf S2
        status: pending
      - id: rp-s2-tests
        content: Add tests/cases/arr_bounds_while_conj and arr_bounds_counter_per_pass goldens (.ll, llvm-as, native round trip), a negative where the counter rises twice per pass and keeps its check, and perf_bounds checks in tests/run.js performance — see Tests
        status: pending
      - id: rp-s2-router
        content: Delete the router guards S2 now proves (the segments cap in descend and staticRoute, the end floor, the routerDecode length check), regenerate pins and goldens, and lower tests/std-panics.json and bench/instructions.json to CI's figures — see Router perf S2
        status: pending
  - id: rp-s3-exit-facts
    title: Router perf S3 — facts that cross a call (callee exit facts)
    goal: A private method or module-local function whose every return leaves a fact on a field or out-parameter it writes lets the caller assume that fact after the call, so match, descend and staticRoute stop re-checking what enter() just established.
    verification: node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/nish-cmp.js && bash scripts/bootstrap.sh --verify
    issue: 2223
    todos:
      - id: rp-s3-design
        content: Write the exit-fact rule into docs/wp15-performance.md §2 (which callees qualify, which facts, how a throw or an early return is joined, why a public method never qualifies) before the code — see Router perf S3
        status: pending
      - id: rp-s3-impl
        content: Compute exit facts in src/ranges.ts as the meet over every normal return of a qualifying callee, and apply them at the call site in src/bounds.ts, invalidated by any later write the prover cannot see — see Router perf S3
        status: pending
      - id: rp-s3-tests
        content: Add tests/cases/arr_bounds_exit_fact (positive) and negatives where one return path breaks the fact and where the callee is public, plus a tests/link case across modules that must not take the fact — see Tests
        status: pending
      - id: rp-s3-router
        content: Delete the tStart and tEnd re-checks in match, descend and staticRoute that enter() establishes, regenerate pins and goldens, and lower the ratchet and std-router count — see Router perf S3
        status: pending
  - id: rp-s4-fields
    title: Router perf S4 — private field invariants through ranged integers
    goal: The router's private counters (deepest, foundCount, the segment counts) carry their constructor-capped range as an integer<Lo,Hi> type, so reading them into a ranged local proves the caps the guards restate, with no new prover fact.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/nish-cmp.js
    issue: 2224
    todos:
      - id: rp-s4-types
        content: Type the router's capped private fields as integer<0, N> with N from the constructor limits, read each into a ranged local on the hot path, and check with cachegrind that the entry checks the ranged writes add cost less than the guards they replace — see Router perf S4
        status: pending
      - id: rp-s4-router
        content: Delete the deepest and pushPair top guards the types now prove, and lower the ratchet and std-router count — see Router perf S4
        status: pending
  - id: rp-s5-parallel
    title: Router perf S5 — parallel arrays and stored indices
    labels: [needs-decision]
    goal: Settle and carry out what happens to the guards in walk, span, endpointFor and staticRoute that check one stored index against several arrays of the same length.
    verification: std-router at or below 155,580,314 on CI's instructions table, tests/std-panics.json not raised, and the outcome recorded in docs/wp15-performance.md §2.4.
    issue: 2225
    todos:
      - id: rp-s5-decide
        content: Settle the parallel-array question with the owner — see Router perf S5, Decision needed
        status: pending
      - id: rp-s5-do
        content: Carry out the chosen option in std/net/router.ts (and src/bounds.ts if a prover fact is chosen), with its tests — see Router perf S5
        status: pending
  - id: rp-s6-close
    title: Router perf S6 — gate and close out
    goal: std-router is back at or below its pre-sweep count, every guard the prover covers is gone, the exception recorded in WP80 is closed, and the docs describe the new facts.
    verification: CI instructions row for std-router at or below 155,580,314 on the head that closes this; node tests/run.js std-panics; node scripts/gen-reference.mjs --check; node docs/check-links.mjs
    issue: 2226
    todos:
      - id: rp-s6-gate
        content: Set the std-router baseline in bench/instructions.json to CI's figure and remove the +4.3% exception from .claude/plans/wp80-std-panics-examples.plan.md (todo s6-router) — see Router perf S6
        status: pending
      - id: rp-s6-docs
        content: Update docs/LANGUAGE.md Panic sites and the docs/guide/ page on panic checks to list what the prover now proves across loops, calls and ranged fields, and grep std/ for the remaining never-true comments the new facts cover — see Router perf S6
        status: pending
---

## Context

The panic-free sweep (04495bf8, WP80 S6 fixup, issue 2209) made [std/net/router.ts](../../std/net/router.ts) clear `--deny-panics` by adding hand-written guards in front of every index and add the prover could not discharge. Most carry a comment saying the guard is never true. They cost instructions on every lookup: [bench/instructions.json](../../bench/instructions.json) moved std-router from 155,580,314 to 162,304,316 (+4.32%, tolerance 0.001), and [.claude/plans/wp80-std-panics-examples.plan.md](../../.claude/plans/wp80-std-panics-examples.plan.md) records that as an accepted exception (todo `s6-router`). Every other program in the instruction table held or fell.

A library helper (a "safe get" or a checked add) would not help. Nish already bounds-checks every index and overflow-checks every signed add by default, so a helper is the same check behind a call. The cost is the guard the prover cannot see through. Removing it means the prover has to know what the guard restates.

The router's guards fall into five families. These are taken from reading the hot path; S1 measures their cost.

| Family | Where (std/net/router.ts) | Why the prover misses it today |
| --- | --- | --- |
| Loop-carried | `segments` cap in `descend` / `staticRoute` ("a proof does not follow a loop"), `end` floor, `routerDecode` `length >= n` | `forgetAcross` (src/bounds.ts) drops a loop-written local's upper bound; `passBound` takes only a plain `<`/`<=` on a local stepped by one, so a `&&` condition gives -1; `accumulatorFacts` handles `for` only |
| Cross-call | `tStart < 0 \|\| tEnd < 0` after `enter()` in `match`; the same range re-checked at the top of `descend` / `staticRoute` | entry facts flow from caller to a private callee (src/ranges.ts) but nothing flows back; there is no callee postcondition |
| Field invariant | `deepest > 1073741822`, `pushPair` `top` cap | a field's value is unknown at every read; the constructor caps (maxSegments ≤ 256, maxParams ≤ 256) are not facts |
| Parallel array | `walk`, `span`, `endpointFor`: one index checked against `segStart`, `segEnd`, `firstChild`, `labelStart`, ... | no equal-length relation between arrays; rejected on purpose in docs/wp15-performance.md §2.4 |
| Mask | `staticRoute` slot vs `staticSlots.length` (power-of-two table) | no fact for `x & (len - 1)` |

The same loop and call comments appear in std/compress/zlib.ts, gzip.ts and checksum.ts (4 sites), and "never true" guards appear in 12 other std files. Those are not in scope, but S6 greps them so the facts' reach is recorded.

## Approach

- **Prover first, guards second.** Each compiler stage lands the fact, its golden and negative tests, and deletes only the router guards it proves in the same PR. The deletion proves the fact reaches real code: with the guard gone, `--deny-panics` must still pass (std-panics ratchet) and the instruction count must fall.
- **Order by cost and risk.** Loop facts (S2) are local to one function and extend existing machinery (`passBound`, `accumulatorFacts`). Exit facts (S3) are a new interprocedural fact and need a written rule first. Field ranges (S4) need no compiler change. They come after S2 and S3 because their entry checks on writes may cancel the gain, which S1's numbers decide. The parallel-array family (S5) contradicts an earlier decision, so it waits for the owner.
- **Exit facts stay narrow.** Only callees that already qualify for entry facts (private methods, module-local functions with every caller visible) get exit facts. Only facts on locals passed out or on `this` fields the callee writes count, and a later write the prover cannot see clears them. Public and exported functions never qualify, so a fact never crosses a module boundary or an API a user can call.
- **S1 may reorder the stages.** If the cachegrind table shows one family holds most of the 6.7M, that family's stage goes first; the plan's todos do not change.

## Router perf S1 — attribute the +6.7M instructions

Build `bench/std-router.ts` with the compiler at `04495bf8^` (std before the sweep) and at `main`, run each under `valgrind --tool=cachegrind --dump-instr=yes`, and use `cg_annotate` to get per-function and per-line counts. The deltas for the ten hot-path functions (`match`, `enter`, `staticRoute`, `descend`, `span`, `answer`, `walk`, `pushPair`, `endpointFor`, `routerDecode`) should sum to about 6,724,002. Put the table in this section and in the S1 issue, with each guard's family and the stage that removes it.

No code changes. Done when the table accounts for the delta within 5%.

## Router perf S2 — loop-carried bounds in while loops and conjunctive conditions

**passBound.** Today ([src/bounds.ts](../../src/bounds.ts), `passBound`):

```ts
const cond = unwrapBoundsParens(loop.children[1])
if (cond.kind !== NodeKind.Binary || (cond.text !== "<" && cond.text !== "<=")) { return toI64(-1) }
```

Walk a `&&` chain and take the bound from any conjunct of the form `i < e` / `i <= e` on the stepped local. Every conjunct holds inside the body, so this is sound. `accumulatorFacts` gains the `while` shape: the step is the body's last statement and no `continue` skips it.

**Per-pass counter.** A local `c` that is written only as `c = c + 1` (or `c += 1`), at most once on any path through one pass, and not written outside the loop after entry, satisfies `c ≤ c₀ + trips` where `trips` is the loop variable's range (`tEnd - end₀` for the router). With `tEnd ≤ target.length ≤ 2³¹-1` this bounds `segments + 1` and removes the overflow check. The fact replaces `forgetAcross`'s "unknown" for such a counter only. Any other write keeps today's behaviour.

**Router.** Delete the `segments < 0 || segments > 1073741821` guards in `descend` and `staticRoute`, the `end` floor, and the `routerDecode` length re-check once the goldens show the checks gone.

## Router perf S3 — facts that cross a call (callee exit facts)

Write the rule into docs/wp15-performance.md §2 first. The draft:

- A callee qualifies if it already takes entry facts (private method, or a module-local function whose every call site is visible).
- Its exit facts are the meet (intersection) of the facts holding on each `this.f` it writes and each value it returns, at every `return` and at the fall-through end. A path that throws contributes nothing, because the caller does not continue on it.
- At the call site, the caller takes the exit facts for fields the callee wrote. They hold until the next write to that field, or a call the prover cannot see into, which might write it.
- Recursion: a callee in a cycle gets no exit facts (no fixpoint in this stage).

Implement the meet in [src/ranges.ts](../../src/ranges.ts) next to the entry-fact join, and apply it in `src/bounds.ts` where a call's result is bound. The router's `enter()` writes the target start and end. After S3, `match`, `descend` and `staticRoute` drop their `tStart < 0 || tStart >= tEnd || tEnd > target.length` re-checks.

## Router perf S4 — private field invariants through ranged integers

The constructor caps `maxSegments` at 1..256 and `maxParams` at 0..256, and `deepest` and `foundCount` never exceed them. Type those private fields `integer<0, 257>` (or the exact cap) and read them into ranged locals (`const deepest: integer<0, 257> = this.deepest`) on the hot path. The range type gives the floor and `maxIndex` with no prover change (WP31, [docs/wp31-ranged-integers.md](../../docs/wp31-ranged-integers.md) §8). A write to a ranged field adds an entry check, so compare the cachegrind count before and after. Keep the change only where the hot path reads more than it writes. Delete the `deepest > 1073741822` and `pushPair` `top` guards the types prove.

## Router perf S5 — parallel arrays and stored indices

`walk`, `span`, `endpointFor` and `staticRoute` check one stored index against several arrays the router always grows together (`segStart`/`segEnd`; `firstChild`/`paramChild`/`wildChild`/`nextSibling`/`labelStart`/`labelEnd`; `endpointNext`/`routeMethod`). S1 says how much of the delta this is.

### Decision needed

docs/wp15-performance.md §2.4 rejected equal-length array facts as too wide a relation for the prover to track soundly. The options are:

1. **Restructure the layout (recommended if S1 shows this family matters).** Pack each parallel group into one array of records, or one flat `i32` array with a stride, so one index is checked against one length. This changes std only and needs no new prover fact.
2. **Add a narrow equal-length fact.** Arrays that are private fields, created with the same length expression and only ever grown together in one method, are equal in length. This reverses §2.4 for a narrow case and needs its own design note.
3. **Accept the cost.** Keep these guards, and set the std-router gate to whatever S2–S4 reach.

Until this is settled, S6's gate is "the S2–S4 figure", not 155,580,314.

## Router perf S6 — gate and close out

Set std-router's baseline in [bench/instructions.json](../../bench/instructions.json) to CI's figure, which must be at or below 155,580,314 unless S5 chose option 3. Remove the +4.3% exception from [.claude/plans/wp80-std-panics-examples.plan.md](../../.claude/plans/wp80-std-panics-examples.plan.md). Update [docs/LANGUAGE.md](../../docs/LANGUAGE.md) "Panic sites" and the guide page on panic checks to say what is now proved across `while` loops, calls to private methods and ranged fields. Grep std/ for the remaining "does not follow a loop", "does not cross a call" and "never true" comments, and list which ones the new facts would cover as follow-up candidates (zlib, gzip, checksum, dns-resolver, ...). Do not edit them here.

## Out of scope

- Removing the same guards outside std/net/router.ts. S6 only lists them.
- A general interprocedural fixpoint, exit facts for public or exported functions, or facts that cross a module boundary.
- A `x & (len - 1)` mask fact for the `staticSlots` table, unless S1 shows it is a large share of the cost. If it is, it becomes a new stage.
- Library helpers (a checked-get or checked-add API). They would add a call around the same check.
- Changing the default checks, `--deny-panics`, or the NL9007 rule.

## Tests

- Golden IR cases under `tests/cases/`, mirroring the `arr_bounds_*` family: `arr_bounds_while_conj`, `arr_bounds_counter_per_pass` (S2) and `arr_bounds_exit_fact` (S3). Each has a `.ll`, an `llvm-as` pass and a native round trip. Each gets a negative that keeps its check: a counter rising twice per pass, a return path that breaks the exit fact, a public callee. Register them with `node tests/differential/goldens.js --update`.
- `tests/run.js` `performance` section: `perf_bounds_*` checks that the new facts remove the in-loop check, so NL9007 does not fire.
- `tests/link`: a cross-module case where an exported function's postcondition must not be taken, next to `tests/link/range_export*` and `tests/link/net_router_negative_range`.
- `tests/run.js` `std-panics`: the ratchet in `tests/std-panics.json` drops by the guards each stage deletes and never rises.
- `bench/instructions.json`: std-router falls in each stage that deletes a hot-path guard. Every count comes from CI's table, never a local run.

## Verification

For each `src/` stage, before pushing:

```bash
npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
node tests/run.js performance
WASI_SYSROOT=/usr node tests/run.js wasi
node tests/run.js std-panics
node tests/run.js instructions
node tests/run.js link
node tests/self/goldens.js --update
NISH=build/nish bash docs/cookbook/regen.sh --check
node scripts/gen-reference.mjs --check
node tests/nish-cmp.js
bash scripts/bootstrap.sh --verify
```

Before merging, check that CI is green on every shard and that CI's std-router row is at or below the stage's target.
