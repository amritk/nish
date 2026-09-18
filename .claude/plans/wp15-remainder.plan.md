---
name: WP15 remainder — the padding warning and the header hoist
overview: Closes the two items WP15 still has open — the tenth performance rule (wasteful struct padding, behind the deliberate diagnostic sort it needs) and §2c candidate 2 (hoisting the array header into the loop preheader, worth 2.48x on the field shape self/ is written in) — then re-points the note at what shipped.
stages:
  - id: diag-sort
    title: A deliberate sort for the diagnostic stream
    goal: Give the warning list an explicit report order in both compilers, so a pass-1 warning no longer precedes every pass-2 warning in the same file.
    verification: npm run check && npm test && npm run bootstrap
    status: pending
    todos:
      - id: sort-src
        content: Replace the load-order assumption in src/diagnostics.ts with an explicit stable sort over the warning list — see A deliberate sort for the diagnostic stream
        status: pending
      - id: sort-self
        content: Mirror the same order in the sorted() merge sort in self/diagnostics.ts, byte for byte — see A deliberate sort for the diagnostic stream
        status: pending
      - id: sort-case
        content: Add tests/cases/diag_order pinning a pass-1 and a pass-2 warning in one file, in source order — see A deliberate sort for the diagnostic stream
        status: pending
      - id: sort-repin
        content: Re-pin every existing golden whose diagnostic order moved, and say in the pull request body how many moved — see A deliberate sort for the diagnostic stream
        status: pending
  - id: hoist-bench
    title: The field-shape benchmark, committed
    goal: Land the §2c field-shape program in bench/ so the hoist's 2.48x is re-derivable by anyone rather than quoted from this note.
    verification: npm run build && node dist/index.js bench/hoist_field.ts -o build/hoistir/ --link build/hoist --profile speed && build/hoist
    status: pending
    todos:
      - id: bench-program
        content: Add bench/hoist_field.ts — a loop over an array held in a class field, timed in alternating rounds inside the program — see The field-shape benchmark
        status: pending
      - id: bench-baseline
        content: Record the pre-change baseline in bench/README.md with its box, flags and statistic — see The field-shape benchmark
        status: pending
  - id: pad-warning
    title: NL9010 — wasteful struct padding
    goal: Ship the tenth and last §8 rule, naming the current size, the achievable size and the field order that gets there.
    verification: npm run build && node tests/run.js perf_padding && npm run check && npm test && npm run bootstrap
    status: pending
    todos:
      - id: pad-arith
        content: Compute the best packing beside computeLayout in src/checker/classes.ts, reusing the existing offsets rather than a second layout walk — see NL9010
        status: pending
      - id: pad-self
        content: Mirror the same arithmetic in computeLayout in self/structs.ts — see NL9010
        status: pending
      - id: pad-code
        content: Regenerate the registry with scripts/gen-diagnostic-codes.mjs so NL9010 lands in both src/codes.ts and self/codes.ts — see NL9010
        status: pending
      - id: pad-cases
        content: Add tests/cases/perf_padding and perf_padding_quiet, plus a negative case for a struct already optimally ordered — see NL9010
        status: pending
      - id: pad-rule
        content: State the rule in docs/LANGUAGE.md beside the other nine performance warnings — see NL9010
        status: pending
  - id: header-hoist
    title: Candidate 2 — hoist the array header into the preheader
    goal: Load an array's header once in the loop preheader wherever the whole program proves nothing in the loop grows it, with one length value feeding the loop condition and the bounds check both.
    verification: npm run check && npm test && npm run bootstrap && build/hoist
    status: pending
    todos:
      - id: nogrow-fact
        content: Add the does-not-grow-an-array fact to the call-graph fixpoint in src/codegen/attributes.ts, separating growth from the stores PointerParamFacts already tracks — see Candidate 2
        status: pending
      - id: nogrow-self
        content: Mirror the fact in self/attributes.ts — see Candidate 2
        status: pending
      - id: hoist-emit
        content: Hoist the header load into the preheader in src/codegen/emit/control-flow.ts where the fact holds, reusing one length for the condition and the check — see Candidate 2
        status: pending
      - id: hoist-self
        content: Mirror the hoist in self/emit_control.ts — see Candidate 2
        status: pending
      - id: hoist-measure
        content: Measure bench/hoist_field.ts before and after, and state the number, the box and the statistic in the commit body — see Candidate 2
        status: pending
      - id: hoist-count
        content: Re-count the header-domain loads inside loops in self/bounds.ts by the §2c method and report the new figure against 24 — see Candidate 2
        status: pending
      - id: hoist-cookbook
        content: Add the hoisted-header lowering to docs/IR_COOKBOOK.md — see Candidate 2
        status: pending
  - id: wp15-docs
    title: Re-point the note at what shipped
    goal: Make WP15 say what is now true — the tenth rule shipped, candidate 2 shipped with its measured number, and §2.4 is closed rather than deferred.
    verification: node docs/check-links.mjs && npm test
    status: pending
    todos:
      - id: docs-sec8
        content: Mark the padding row shipped in §8 and record the sort it needed — see Re-point the note
        status: pending
      - id: docs-sec2c
        content: Record candidate 2 as shipped in §2c and §9 item 1b, with the measured number rather than the banked estimate — see Re-point the note
        status: pending
      - id: docs-stale
        content: Delete the stale closing line of §9 that still defers the §2.4 opt-out, which §2.4 itself records as closed — see Re-point the note
        status: pending
      - id: docs-master
        content: Bring docs/MASTER_PLAN.md §9 into agreement, quoting no number without a date — see Re-point the note
        status: pending
---

## Context

WP15 is about ninety percent shipped. [`docs/wp15-performance.md`](../../docs/wp15-performance.md) §9 marks items 1, 1a, 1c, 1d, 1e, 2, 4, 5, 6 and 7 done, and items 1f and 3 measured and declined. Two things are genuinely open, and one more only looks open.

| Item | State in the tree today |
| --- | --- |
| §8's tenth rule, wasteful struct padding | Nine codes exist, `NL9001` through `NL9009`. `NL9010` does not. |
| §2c candidate 2, the header hoist | `PointerParamFacts` in [`src/codegen/attributes.ts`](../../src/codegen/attributes.ts) tracks `stores`, which lumps `push` in with every other store. There is no does-not-grow fact. |
| §2.4, the explicit opt-out | **Already closed.** §2.4's body records the count that was owed — seventeen surviving checks across `self/` — and concludes the opt-out stays unbuilt. Only §9's closing line still calls it deferred. |

## Approach

The two open items are independent in substance but not in the tree — both churn goldens under [`tests/cases/`](../../tests/cases), which is this repository's one genuinely shared resource. So they serialise, and the plan does not pretend otherwise. The only real parallelism available is the benchmark, which lives alone in [`bench/`](../../bench).

The ordering is otherwise forced. The padding warning cannot ship before the sort, because a struct is laid out in pass 1 and every §8 warning today comes out of one source-order walk in pass 2 — so the warning would print ahead of every warning in the same file. The hoist cannot be measured before the benchmark exists.

## A deliberate sort for the diagnostic stream

**Owns:** `src/diagnostics.ts`, `self/diagnostics.ts`, `tests/cases/**`, `tests/wordings/**`

**Merges after:** nothing — this is the first stage.

[`src/diagnostics.ts:38`](../../src/diagnostics.ts) states the assumption being removed — that warnings *need no sort* because the analysis meets them in module load order and then in source order. That holds for the nine pass-2 warnings and stops holding the moment a pass-1 warning joins them.

The sort is over the warning list only; `throwIfErrors` already sorts errors and is not touched. Order is by file, then by span start, then by code, and it must be **stable**, because [`self/diagnostics.ts:281`](../../self/diagnostics.ts) already promises stability for reproducible multi-error goldens and the two compilers are compared byte for byte.

This changes the order of a machine-readable stream. That is the reason it is its own stage rather than a side effect of the next one.

## The field-shape benchmark

**Owns:** `bench/**`

**Merges after:** nothing — runs concurrently with the sort.

§2c names the shape verbatim — `knownAtMost` in [`self/bounds.ts`](../../self/bounds.ts), a `while` over `state.atMostIndex.length` reading two arrays held in class fields. The benchmark is that shape, standalone, timed in alternating rounds inside the program so neither scan is inlined away, following [`bench/substr.ts`](../../bench/substr.ts) which was committed for the same reason.

The baseline to beat is §2c's measured pair — 756 ms for the field shape against 305 ms for the parameter shape, the 2.48x this stage exists to make re-derivable.

## NL9010

**Owns:** `src/checker/classes.ts`, `self/structs.ts`, `src/codes.ts`, `self/codes.ts`, `docs/LANGUAGE.md`, `tests/cases/**`

**Merges after:** `diag-sort`, and develops after it too — its goldens pin an order that does not exist until the sort lands.

The arithmetic is already there. `computeLayout` in [`src/checker/classes.ts:109`](../../src/checker/classes.ts) walks fields in declaration order, rounding each to its alignment; the better packing is the same walk over fields sorted by descending alignment. The warning fires when that packing is strictly smaller, and the message names all three things §8's hint column specifies — current size, achievable size, and the order.

`self/structs.ts:69` holds the mirror.

The registry is generated, never hand-edited — `scripts/gen-diagnostic-codes.mjs` appends one past the highest in the band and preserves every existing assignment.

## Candidate 2

**Owns:** `src/codegen/attributes.ts`, `self/attributes.ts`, `src/codegen/emit/control-flow.ts`, `src/codegen/emit/arrays.ts`, `self/emit_control.ts`, `self/emit_arrays.ts`, `docs/IR_COOKBOOK.md`, `tests/cases/**`

**Merges after:** `pad-warning` and `hoist-bench`. It re-pins every golden whose array loop changed shape, so it holds the goldens alone.

Two halves, and the first is the prerequisite §2c names.

**The fact.** `attributes.ts` runs a call-graph fixpoint that already answers whether a callee captures or stores through a pointer parameter. What it cannot answer is the narrower question the hoist needs — does anything reachable from this loop *grow* this array. Growth is `push` and the reallocation behind it, not every store; an element write leaves the header alone, which is exactly what the §2b alias domains encode. So this is a refinement of `PointerParamFacts`, propagated the same way, not a new analysis.

**The hoist.** With the fact, the emitter loads the header once in the preheader. The criterion is the sharp one §2c insists on — **one length value feeding the loop condition and the bounds check both** — because §2c's own probe reaches zero header loads by hand and still measures 761 ms when two lengths leave the second loop exit that stops the vectoriser. A hoist that leaves two lengths is worth nothing, and the acceptance number is the parameter shape's 305 ms, not merely fewer loads.

The real-code check is the count §2c recorded — 24 functions in `self/bounds.ts` carrying a header-domain load inside a loop, counted by walking the `opt -O2` CFG for blocks that reach themselves. The same count after the change is what says the fact fires where it matters.

## Re-point the note

**Owns:** `docs/wp15-performance.md`, `docs/MASTER_PLAN.md`

**Merges after:** `pad-warning` and `header-hoist` — it records what they measured.

WP15 is the file that records what was decided and what it measured, so the last stage writes the results back into it rather than leaving the note describing a tree that no longer exists. The §2.4 line is a staleness fix, not a change of decision — the opt-out stays unbuilt.

## Out of scope

- **The §2.4 opt-out itself.** §2.4 counted the surviving checks and closed the item. Nothing here reopens it.
- **`readonly T[]` marking, and `!invariant.load` on element data.** Candidate 1, refuted in §2c and again in the section that reaches `wp9-optimisation.md`. Unsound, and this plan does not revisit it.
- **The `min` shape in the bounds domain.** §2 names it as deliberately not recognised — a peephole inside a soundness-critical analysis.
- **Item 8, generics and `Result<T, E>`.** `docs/wp18-generics.md` owns it.
- **`CHANGELOG.md`.** Generated from commit subjects and bodies by `scripts/changelog-gen.mjs`. Every stage writes its changelog entry as its commit message, never by editing the file.

## Tests

Every stage ships the full construct checklist from `docs/ARCHITECTURE.md` — a golden `.ll`, an `llvm-as` pass, a native round trip with expected stdout, and at least one negative case.

| Stage | Cases |
| --- | --- |
| diag-sort | `tests/cases/diag_order`, plus every existing golden whose order moved |
| pad-warning | `tests/cases/perf_padding`, `perf_padding_quiet`, and a struct already optimally ordered |
| header-hoist | `tests/cases/arr_hoist` and a negative case where a `push` in the loop forbids the hoist |

The two compilers are compared byte for byte by the oracles, so each stage lands in `src/` and `self/` together.

## Verification

`npm run check` and an **undegraded** `npm test` — the skip count read, not just the exit code — for every stage. Any stage touching `self/` also clears `npm run bootstrap`, since `npm run check` is `tsc --noEmit` over `src/` alone and never sees a type error written under `self/`.

This repository has no coverage command and no configured thresholds. The gate standing in for coverage is undegraded `npm test` plus each stage's own scoped verification line above, recorded as a named deviation in the run ledger.
