---
name: Nish on Are We Fast Yet, round 2 — header TBAA, call-site ranges, loop-body arena scopes, inline fixed arrays
overview: Follow-up to awfy-perf (#207), closing the gaps its acceptance escalated in #215 and #216. Tag array-header accesses so class-field stores stop forcing reloads, and carry index ranges across calls so Permute's remaining checks can be proven. Reclaim each loop iteration's temporaries when they cannot outlive the pass, and store fixed-length array fields inline in their object. Then re-measure all seven benchmarks against 0.10.0.
stages:
  - id: header-tbaa
    title: "perf(codegen): give array header loads and stores their own TBAA subtree"
    goal: A class-field store no longer forces LLVM to reload an array header's length or data pointer, with a soundness argument covering every writer of a header
    verification: npm run check && npm test (undegraded) && node tests/run.js arr_header_tbaa
    todos:
      - id: header-tag
        content: Add a header subtree to self/tbaa.ts and tag every header length/capacity/data access in self/emit_arrays.ts — see Header TBAA
      - id: header-soundness
        content: Write the soundness argument into docs/ARCHITECTURE.md attribute rules, covering push/pop, runtime writers, inline records, stack arrays and threads — see Header TBAA
      - id: header-guard
        content: Add arr_header_tbaa goldens and a tests/run.js opt -O3 guard on the Towers moveTopDisk shape — see Header TBAA
  - id: range-facts
    title: "perf(checker): prove an index in range from what every call site guarantees"
    goal: A parameter used as an index is proven in range when every call site passes a value the caller has proven in range for the same array, so AWFY Permute's swap needs no checks, soundly
    verification: npm run check && npm test (undegraded) && node tests/run.js arr_range_call
    todos:
      - id: range-design
        content: Decide and write down the fact that crosses a call (index parameter vs a path holder like this.v) and its invalidations, before coding — see Call-site ranges
      - id: range-analysis
        content: Implement the whole-program pass (new self/ranges.ts) feeding self/bounds.ts, driven from self/compilation.ts — see Call-site ranges
      - id: range-goldens
        content: Add arr_range_call goldens (the Permute shape proven, and negatives — a caller with no proof, a callee that resizes, recursion that breaks the bound, an exported function) with native round trips — see Call-site ranges
  - id: loop-arena-scopes
    title: "perf(codegen): reclaim a loop iteration's temporaries when nothing outlives the pass"
    goal: A loop body whose allocations (direct or through callees) cannot outlive the iteration is bracketed with nish_arena_mark and nish_arena_release, in any function, pointer-returning ones included, and NL9011 fires only where that still fails
    verification: npm run check && npm test (undegraded) && node tests/run.js mem_loop_scope
    todos:
      - id: loop-rule
        content: Define and implement the per-iteration containment rule and scope in self/escape.ts and self/attributes.ts, with the soundness argument — see Loop-body arena scopes
      - id: loop-emit
        content: Emit mark at the top of the body and release on every path that leaves the iteration (continue, break, return, the back-edge) in self/emit_control.ts / self/emit.ts — see Loop-body arena scopes
      - id: loop-nl9011
        content: Narrow NL9011 to loops that still cannot be reclaimed, and add the missing case that asserts no NL9011 under Arena control — see Loop-body arena scopes
      - id: loop-goldens
        content: Add mem_loop_scope goldens (the #216 summarise shape with a bounded Arena.used round trip, and escaping negatives that read values back) — see Loop-body arena scopes
  - id: inline-fixed-arrays
    title: "perf(codegen): store a fixed-length array field inside its object"
    goal: A class field that provably only ever holds one array of a length the compiler knows, and whose array never escapes as a value, is laid out inline in the object, with reference semantics unchanged
    verification: npm run check && npm test (undegraded) && node tests/run.js cls_inline_array
    todos:
      - id: inline-design
        content: Write the qualifying rule and its semantics argument (aliasing, assignment, push, escape through a callee returning the array) before coding — see Inline fixed arrays
      - id: inline-layout
        content: Implement the two-sided layout change (self/runtime.ts, self/structs.ts, runtime/nish.h) and the access lowering (self/emit_arrays.ts, self/emit_classes.ts, self/members.ts) — see Inline fixed arrays
      - id: inline-tests
        content: Add cls_inline_array goldens with native round trips, negatives for every disqualifier, and a tests/layout check — see Inline fixed arrays
  - id: awfy-remeasure
    title: "docs(bench): Are We Fast Yet after round 2"
    goal: The before/after table for all seven, 0.10.0 against main after round 2, is re-measured and published beside round 1's, with the RSS rows and the Queens/Towers gap to C++
    verification: npm test (undegraded) && node bench/run.mjs --validate --only awfy
    todos:
      - id: remeasure-table
        content: Re-run the round-1 protocol for all seven, add the round-2 table and the C++ comparison to docs/wp9-optimisation.md — see Re-measure
---

# Nish on Are We Fast Yet, round 2

## Context

Round 1 (#207: #210, #209, #208 and #214) left two escalations, and the owner chose these fixes for them:

- **#215, speed targets.** Permute ran 14.7% faster (15.5% on a second VM), short of the 20% target. On one VM Bounce was 19.2% slower and Queens 5.2% slower; on another, neither regressed. The profile in `docs/wp9-optimisation.md` §"Are We Fast Yet" found three causes:
  - Towers reloads `header.data` three times per move. Header loads carry `!alias.scope` but no `!tbaa`, and class-field stores carry `!tbaa` but no scope, so nothing separates the two.
  - Permute's `swap` keeps two checks that only an interprocedural fact can remove.
  - Queens pays one extra dependent load per access, which C++ avoids.
- **#216, NL9011.** A pointer-returning function that loops over an allocating callee gets no scope and no warning, and keeps its memory (85 MB at 4000 rounds). The case asserting NL9011's silence under `Arena` control is missing.

The owner chose four fixes: header TBAA, call-site range facts, inline fixed-length arrays, and loop-body arena scopes. Loop alignment was not chosen.

## Approach and risk

The rules are unchanged from round 1. There are no benchmark-specific tricks, checks stay on by default, and semantics do not change. Every new tag, elision or layout change carries a soundness argument next to the existing ones.

Two stages carry real risk, and the plan accepts that a stage may end as a draft PR with a written finding rather than a merge:

- **range-facts.** The proof needs `i < this.v.length` inside `swap`. It rests on a range that survives recursion (`permute(6)` → `n ∈ [0, 6]`) and on `this.v`'s length being unchanged across calls that write `this.count`. If that is not provable soundly and generally, the stage delivers the analysis it did build, its negative cases, and the reason.
- **inline-fixed-arrays.** Reference semantics decide which fields qualify. `const a = this.piles; a[0] = x` must still write the field. Queens' fields are assigned from a helper (`filledBooleans(8)`), so qualifying them means seeing through a callee that returns a fresh array of a constant length. Rewriting the port to fit the rule is a benchmark trick and is out.

## Merge order and shared files

Development runs as follows:
- header-tbaa, range-facts and loop-arena-scopes start now, in parallel.
- inline-fixed-arrays starts after header-tbaa merges, because it builds on the same tagging and owns the same two files.
- awfy-remeasure starts after everything else merges.

Merge order: **header-tbaa → range-facts → loop-arena-scopes → inline-fixed-arrays → awfy-remeasure.**

The files below are shared and regenerated, never hand-merged. After its predecessor merges, a stage merges `main` in and regenerates them with the repo's tools:
- existing `tests/cases/*.ll` and `tests/link/**`
- `tests/self/goldens/**` and `tests/differential/goldens/unfrozen.txt`
- `docs/IR_COOKBOOK.md` and `docs/cookbook/**`
- `tests/nish-cmp.js` (DECLARED) and `tests/perf-baseline.json`
- `docs/LANGUAGE.md` and `docs/ARCHITECTURE.md` (each stage edits its own section)
- `tests/run.js`: each stage adds its own named check and touches no other

## Header TBAA

**Owns:** `self/tbaa.ts`, `self/emit_arrays.ts`, `tests/cases/arr_header_tbaa*`, plus the shared files.

- Add a `header` subtree beside #208's `element` subtree, under the same root and disjoint from every class-field struct path. Tag every load and store of a header's `length`, `capacity` and `data` fields.
- The soundness argument must name every writer of a header and show that each one is tagged or opaque:
  - the array's own lowering (`push`, `pop`, length stores, `new Array`);
  - the runtime (C, a separate TBAA root, reached through calls);
  - stack arrays (an `alloca` header);
  - arrays of inline records;
  - `--threads` builds.
- **Guard:** in `tests/run.js`, a Towers `moveTopDisk` shape compiled with `opt -O3` loads `header.data` once per move, where 0.10.0 loaded it three times. In checked mode, the length is not reloaded after a class-field store.
- **Negatives:** a program where a header really does change between two reads (`push` in a callee, `pop` through an alias) must keep both loads, with a native round trip that reads the value back.

## Call-site ranges

**Owns:** `self/bounds.ts`, `self/ranges.ts` (new), `self/compilation.ts`, `tests/cases/arr_range_call*`, `docs/wp15-performance.md`, plus the shared files.

- **Design first.** Decide which fact crosses a call. One candidate: parameter `k` is in `[0, len(P))`, where `P` is a path holder rooted at another parameter (`this.v`). It holds for a function when every call site proves it for the arguments it passes. Write that design and its invalidations into the PR body before coding.
  - The callee must not resize `P` or rebind any link of the path before the access. The existing `bounds.ts` invalidations still apply inside the callee.
  - Exported functions and any function whose callers are not all visible keep their checks.
  - Recursion needs a fixpoint that starts from "no fact" and only adds facts every call site proves.
- **Permute's shape.** `permute(n)` calls `swap(n1, i)` with `i ≤ n1 = n − 1`. `n` comes from `permute(6)`, and `this.v = new Array(6)` is set before that call. Say what the analysis proves there and what it does not. A partial result counts if it is sound: for example, proving the `swap` checks only when the caller's loop guards on `this.v.length`.
- **Negatives, each keeping its check** with a native round trip:
  - a caller with no proof;
  - a callee that `push`es or `pop`s;
  - a recursion whose bound grows;
  - an exported function;
  - a call through a method whose receiver's field is rebound between calls.

## Loop-body arena scopes

**Owns:** `self/escape.ts`, `self/attributes.ts`, `self/emit.ts`, `self/emit_control.ts`, `self/codes.ts`, `tests/cases/mem_loop_scope*`, `tests/cases/perf_arena_*`, `tests/wordings/**`, `docs/wp6-memory.md`, plus the shared files.

- **Per-iteration containment.** Nothing allocated during one pass of the body, directly or by callees, is reachable after that pass except through scalar locals.
  - It is contained if no allocation is assigned to a local declared outside the loop, stored into memory older than the pass, returned, or passed to a capturing parameter.
  - This reuses #210's `contained` fact and the escape analysis's `leaks`/`escapes` flow.
- **Placement.** Emit `nish_arena_mark` at the top of each pass. Release on every edge that leaves the pass: the back-edge, `continue`, `break` and `return`. A `return` releases before the value it returns is computed only when that value is scalar.
- **Arena control.** Take no loop scope in a function that uses `Arena.mark`/`release`/`reset`.
- **`readsArenaState`** keeps its round-1 meaning.
- **NL9011** fires only where neither a function scope nor a loop scope applies, and names why.
- **Missing test.** Add a `tests/run.js` check, or a case with a `.err` expecting no performance line, that proves no NL9011 fires for a function using `Arena` control.
- **Cases:**
  - #216's `summarise(rounds): Box` shape, whose `.out` prints that `Arena.used()` after 4000 rounds equals the value after 1;
  - negatives where an iteration's allocation is kept in an outer local, pushed into an outer array, or stored into a field, each reading the value back after arena reuse;
  - a loop with `continue` and `break`.

## Inline fixed arrays

**Owns:** `self/emit_arrays.ts`, `self/emit_classes.ts`, `self/tbaa.ts`, `self/runtime.ts`, `self/structs.ts`, `self/members.ts`, `self/program.ts`, `runtime/nish.h`, `runtime/runtime.c` (only if the layout needs it), `tests/layout/**`, `tests/cases/cls_inline_array*`, plus the shared files. It may read `self/escape.ts`; it may edit that file only after loop-arena-scopes has merged, and must say so in the PR.

- **The qualifying rule.** Write the rule and its semantics argument into the PR and `docs/LANGUAGE.md` before coding. A field `f: T[]` qualifies only if all of these hold:
  - every assignment to it is a fresh array whose length the compiler knows as one constant K: `new Array<T>(K)`, an array literal of K elements, or a call to a function proven to always return a fresh array of length K (so `filledBooleans(8)` can qualify);
  - no code takes `this.f` as a value (assigning it to a local, passing it, returning it, capturing it) except for indexing and `.length`;
  - nothing calls `push`, `pop` or any other length-changing operation on it;
  - the class is not an interop or exported layout.
- **Layout.** The header and the K elements live inside the object; the header's `data` points into the object. Reassigning the field copies the fresh array's elements in, which is observably the same because no other reference to either array exists.
- **Two-sided.** Keep `self/runtime.ts` and `runtime/nish.h` in agreement, and add a `tests/layout` check.
- **Negatives, one for every disqualifier, each with a native round trip:** a field read into a local and written through it, a `push`, a length that is not a constant, and a field passed to a function.
- **Report** Queens and Towers `-O3` loads per access before and after.

## Re-measure

**Owns:** `docs/wp9-optimisation.md`, `bench/README.md`, plus `bench/run.mjs` only for a genuine measurement bug. It does not touch compiler code.

Re-run round 1's protocol on one machine:
- the same `bench/awfy` sources for 0.10.0 and main;
- pinned with `taskset`, the median of the last 20 of 30, five rounds alternating builds;
- the `--unchecked-indexing` and C++ columns;
- the RSS rows, plus #216's `summarise` probe at 100, 1000 and 4000 rounds.

Add a round-2 table beside round 1's, and say plainly which targets are met.

## Out of scope

- Loop alignment or any other linker/codegen flag chosen for benchmarks.
- Changing the AWFY ports to fit an optimisation.
- Making `--unchecked-indexing` the default.
- Inline arrays of variable or unknown length, and inline arrays in interop-exported classes.

## Verification

Every stage runs `npm run check`, `npm test` undegraded with its skip count stated, `npm run lint`, and `node docs/check-links.mjs`. Every PR body carries:
- the TypeScript and exact IR for each case it adds;
- its soundness argument;
- the AWFY numbers for all seven benchmarks before and after, measured in its own container.
