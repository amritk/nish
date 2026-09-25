---
name: Nish on Are We Fast Yet — arena scopes through callees, cheaper checked indexing
overview: Close the measured gaps between Nish and C++ on the AWFY ports without changing the safe default. An automatic arena scope for functions whose callees allocate memory that dies with the call (List, Storage), plus a performance diagnostic when a loop's allocations cannot be reclaimed. For checked indexing, a passed check becomes a fact that proves repeats of it (Permute), and field-array headers stop being reloaded across element stores (Queens, Towers). The AWFY programs land as regression cases, and the residual indirection gap gets profiled.
stages:
  - id: arena-callee-scope
    title: "perf(codegen): give a function the arena scope when only its callees allocate"
    goal: A function with a scalar result whose callees allocate memory that nothing outlives brackets itself with nish_arena_mark and nish_arena_release, and a loop that cannot be reclaimed gets a performance diagnostic
    verification: npm run check && npm test (undegraded, read the skip count) && node tests/run.js mem_callee_scope
    todos:
      - id: contained-fact
        content: Add a propagated containment fact to FunctionFacts in self/attributes.ts and self/escape.ts — see Arena scopes through callees
      - id: scope-rule
        content: Extend the arenaScope decision in analyzeFunctions (self/attributes.ts) to callee allocation, with the soundness argument beside it — see Arena scopes through callees
      - id: scope-diagnostic
        content: Add the NL9xxx performance diagnostic for an unreclaimable allocating call in a loop, registered in self/codes.ts — see The diagnostic
      - id: scope-goldens
        content: Add the mem_callee_scope goldens (List shape, Storage shape with a bounded Arena.used round trip, the escaping negatives) and the wordings case — see Tests for stage 1
      - id: scope-docs
        content: Update the automatic arena scope rule in docs/LANGUAGE.md, the soundness rules in docs/ARCHITECTURE.md, docs/wp6-memory.md, and regenerate goldens, cookbook, nish-cmp DECLARED — see Arena scopes through callees
  - id: bounds-repeat-check
    title: "perf(checker): a passed bounds check proves the same index on the same array"
    goal: After a checked access a[i] completes, i is known in range for a on the fall-through path until something could change that, so a repeat access carries no check
    verification: npm run check && npm test (undegraded) && node tests/run.js arr_repeat_check
    todos:
      - id: check-as-guard
        content: In self/bounds.ts record nonNegative(i) and below(i, holder) after a checked element access or charCodeAt on the path that continues — see Repeated checks
      - id: check-order
        content: Make the fact land where the emitter evaluates the check, not where the expression ends, for compound assignment and a[i] = a[j] — see Repeated checks
      - id: check-goldens
        content: Add arr_repeat_check goldens (the swap shape, a local holder, and the invalidation negatives) with native round trips, and measure Permute, Queens and Towers — see Tests for stage 2
      - id: check-docs
        content: Document the rule in docs/LANGUAGE.md bounds section, docs/wp15-performance.md, and regenerate goldens, cookbook, nish-cmp DECLARED — see Repeated checks
  - id: field-array-loads
    title: "perf(codegen): keep a field array's header live across element stores"
    goal: An element store no longer forces LLVM to reload the class field that holds the array and the array's header, and the check's fail path is confirmed cold and out of line, each measured on its own
    verification: npm run check && npm test (undegraded) && node tests/run.js arr_field_reload
    todos:
      - id: element-alias-info
        content: Give array element loads and stores alias information (self/tbaa.ts, self/emit_arrays.ts) that proves they cannot write a class field or an array header, with the soundness argument — see Field-array loads
      - id: cold-fail-path
        content: Measure the bounds.fail lowering in self/emit_arrays.ts (branch weights or equivalent) and keep it only if it measures — see Field-array loads
      - id: reload-guard
        content: Add arr_field_reload golden and a tests/run.js structural guard that opt -O3 leaves one field load and at most two checks in the swap shape — see Tests for stage 3
      - id: reload-docs
        content: Document the alias rule in docs/ARCHITECTURE.md attribute soundness rules and docs/IR_COOKBOOK.md, regenerate goldens and nish-cmp DECLARED — see Field-array loads
  - id: awfy-bench
    title: "test(bench): the Are We Fast Yet ports as benchmarks and regression cases"
    goal: The seven AWFY ports live in bench/, compile and verify in npm test, and the before and after numbers for all seven plus the profile of the residual indirection gap are written down
    verification: npm run check && npm test (undegraded) && node bench/run.mjs --validate --only awfy
    todos:
      - id: awfy-port
        content: Add the seven AWFY Nish ports under bench/awfy/ with the manual Arena calls removed from Storage, with their licence header — see AWFY in bench
      - id: awfy-runner
        content: Teach bench/run.mjs to build and time bench/awfy (median of the last 20 of 30) and validate it in CI's checksum mode — see AWFY in bench
      - id: awfy-numbers
        content: Record the before (0.10.0) and after (main) table for all seven benchmarks in docs/wp9-optimisation.md — see AWFY in bench
      - id: awfy-profile
        content: Profile Queens and Towers unchecked against C++ and write up whether the double indirection remains after stage 3, proposing but not implementing a fix — see The indirection hypothesis
---

# Nish on Are We Fast Yet

## Context

The AWFY ports (`amritk/are-we-fast-yet`, branch `claude/brave-ritchie-sjl752`, `benchmarks/Nish/`) show two confirmed gaps, both reproduced on 0.10.0 in this container:

| | shipped | Storage without manual `Arena` | List hand-released | `--unchecked-indexing` |
|---|---:|---:|---:|---:|
| Permute 1000 | 36.3 ms | 36.3 | 36.4 | **22.7** |
| Queens 1000 | 21.8 | 21.8 | 21.8 | 19.0 |
| Towers 600 | 23.5 | 23.3 | 23.8 | 20.8 |
| List 1500 | 28.6 | 26.4 | 27.3 | 26.8 |
| Bounce 1500 | 26.3 | 27.1 | 26.0 | 28.4 |
| Mandelbrot 500 | 58.3 | 58.1 | 57.8 | 57.8 |
| Storage 1000 | 172.2 | **357.4** | 166.3 | 170.7 |

Median of the last 20 of 30 iterations, 4-core cloud container, `--profile speed`. The container is noisy: List's arena effect is inside the noise here, so the acceptance criteria use memory ratios and IR shape, which do not depend on the machine.

**Finding 1, root cause.** [`self/attributes.ts`](../../self/attributes.ts) `analyzeFunctions` sets `arenaScope = directArena && !allocLeaks && !returnsAllocation && !usesArenaControl`. `directArena` counts only the function's *own* arena allocations. `List.benchmark` allocates nothing itself. In `Storage.benchmark` with the manual calls removed, `new Random()` is stackable and becomes an `alloca`, so `directArena` is false there too. Either way everything the callees allocate stays in the arena until the harness's outer release.

**Finding 2, root cause.** `Permute.swap` emits four checks. After `opt -O3` three survive: the element store carries `!alias.scope` for the data domain but no TBAA, while `this.v` is loaded with a struct-path TBAA tag, so LLVM cannot prove the store leaves `this.v` alone. It reloads the field and the header, then re-checks `j`. `nish_panic_index` is already declared `noreturn cold`.

## Approach

- The compiler has two separate levers, so there are two separate fixes. The checker's flow facts ([`self/bounds.ts`](../../self/bounds.ts)) decide which checks are *emitted*. The alias information ([`self/tbaa.ts`](../../self/tbaa.ts), [`self/emit_arrays.ts`](../../self/emit_arrays.ts)) decides what LLVM can *remove* afterwards. Stage 2 is idea (a), stage 3 is ideas (b) and (c), so each is measured on its own.
- The arena change extends the existing whole-program fixpoint rather than adding a pass: containment is a fact like `allocEscapes`, propagated over the call graph like `readsArenaState`.
- The default stays checked, and nothing changes semantics. Every elision carries its argument next to the code, in the form [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) "Attribute soundness rules" uses.

## Merge order and shared files

Stages 1–3 are developed in parallel against `main`. They merge in the order **1 → 2 → 3 → 4**, and stage 4 starts only after stage 3 merges, because it measures the result.

Each stage's code files are disjoint (its `Owns` line). The files below are *regenerated or appended* by every stage that moves IR, so they are serialised by the merge order instead of being owned. After its predecessor merges, a stage merges `main` in and **regenerates** them with the repo's tools (`npm run test:update`, `node tests/self/goldens.js --update`, `bash docs/cookbook/regen.sh`). It never hand-merges them.

- existing `tests/cases/*.ll`, `tests/link/**/expected.ir` whose IR moves
- `tests/self/goldens/**`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`
- `tests/nish-cmp.js` (the `DECLARED` list only), `tests/perf-baseline.json`
- `docs/LANGUAGE.md`, `docs/ARCHITECTURE.md` (each stage edits its own section)

`CHANGELOG.md` is generated from commit messages and is not edited. The squash-merge subject and body are the release entry.

## Arena scopes through callees

**Owns:** `self/attributes.ts`, `self/escape.ts`, `self/emit.ts`, `self/compilation.ts`, `self/dump.ts`, `self/codes.ts`, `self/diagnostics.ts`, `tests/cases/mem_callee_scope*`, `tests/cases/perf_arena_*`, `tests/wordings/**`, `docs/wp6-memory.md`, plus the shared files above.

A new fact per function, **contained**: every arena allocation made while it runs, by itself or by anything it calls, is unreachable once it returns, except through its return value. It holds when:

- no direct allocation `escapes` (the WP9 refinement of `allocLeaks`);
- every call site's pointer result flows `local` or `returned`, never into a parameter, `this`, a field of a non-local object, a module variable, or a capturing parameter of another call (`EscapeResult.callSites` already carries each flow);
- every callee is contained (fixpoint, starting from "contained" and falling to "not contained", so recursion like `makeList` resolves).

**The scope rule** becomes: the existing rule, **or**
`contained && scalar return type (number, bool, enum, void) && !usesArenaControl && some callee net-allocates`,
where *net-allocates* is "allocates and has no scope of its own". The last clause stops a scope from nesting pointlessly around a callee that already reclaims.

The soundness argument goes beside the code. After the release, the only values that leave the frame are the scalar result and writes the callees made to pre-existing memory. Containment says none of those writes stored a pointer above the mark. `readsArenaState` keeps its current role (`marksTailCall`). A function that `Arena.release`s or `Arena.reset`s stays excluded.

Expected on the ports: `List.benchmark` and `Storage.benchmark` (manual calls removed) get a scope. `Towers.benchmark` and `Permute.benchmark` do not, because they store fresh arrays into `this`, and that is correct.

### The diagnostic

A new `performance` code, the next free NL9xxx in [`self/codes.ts`](../../self/codes.ts). It fires on a call inside a loop when the callee net-allocates, the call's result does not outlive the iteration, and the enclosing function gets no scope. The message names what refused the scope (returns a pointer, an escaping allocation named by line, uses `Arena` control) and suggests the rewrite, the way NL9007 names its guard.

It must not fire on a function that uses `Arena.mark`/`release` itself, because the programmer is already managing that memory. The performance gate holds `std/` and `examples/` at zero warnings. If it fires in `self/compile.ts`'s compile, the new code gets a `tests/perf-baseline.json` entry at the measured count, with the reason in the PR body. The wording gets a program in `tests/wordings/` so `tests/diagnostic_coverage.js` reaches it.

This lives in the emitter's analysis phase, not the checker, so the stage decides where the report is made (the facts are computed in C0). It records that choice in the PR and does not break "the emitter never reports a user error": a performance note is not an error, but check how `self/compilation.ts` surfaces C0 facts first.

### Tests for stage 1

| case | shape | proves |
|---|---|---|
| `mem_callee_scope` | List's `benchmark`: three pointer-returning calls, one `i32` out | `nish_arena_mark`/`release` bracket it, `.ll` + `.out` |
| `mem_callee_scope_tree` | Storage's: a stack object passed down, a recursive tree builder, result discarded, run 10,000 times from `main` | `.out` prints that `Arena.used()` after the loop equals the value after one iteration |
| `mem_callee_scope_escape` | a callee stores its allocation into `this` / a parameter's field | no scope (negative) |
| `mem_callee_scope_return` | pointer return type | no scope (negative) |
| `mem_callee_scope_control` | caller uses `Arena.release` | no scope, no diagnostic |
| `perf_arena_loop` + wording | loop over an allocating call in a pointer-returning function | the new code, exact message |

## Repeated checks

**Owns:** `self/bounds.ts`, `tests/cases/arr_repeat_check*`, `docs/wp15-performance.md`, plus the shared files.

A checked `a[i]` (read, write, compound) or `s.charCodeAt(i)` that *executes* establishes `nonNegative(i)` and `below(i, a)` on the path that continues. The failing path calls `nish_panic_index`, which is `noreturn`, so no path continues with `i` out of range. The facts go into the same five families, keyed the same way, and the existing invalidations drop them: any call drops array-length facts, a `push`/`pop`/length write drops them, a store to a field named on a path holder drops path facts, and reassigning `i` or the root drops everything. Nothing new is invalidated, so nothing new has to be argued there.

Order matters. The fact is recorded at the point the emitter evaluates that check. For `this.v[i] = this.v[j]` the emitter checks `j` (the RHS) before `i` (the LHS store) — read [`self/emit_arrays.ts`](../../self/emit_arrays.ts) to confirm. `walkExpression` interleaves the verdicts in emission order, the way the `substring` bounds already are (header of `bounds.ts`). Include a case where the RHS contains a call, so the fact recorded before the call is dropped.

Expected on `swap`: four checks become two (`tmp = v[i]` and `v[j]` stay, both stores are proven). NL9007 stops firing on the proven repeats.

### Tests for stage 2

`arr_repeat_check` (swap on a field array), `arr_repeat_check_local` (local holder), and the negatives, where each keeps its check: `arr_repeat_check_call` (call between), `arr_repeat_check_push`, `arr_repeat_check_field_store` (`this.v = …` between), `arr_repeat_check_reassign` (`i` changes). Each has a native round trip. One `.out` shows an out-of-range repeat still panics with the index message. Report Permute, Queens and Towers before and after in the PR, measured with the AWFY harness from the plan's Context.

## Field-array loads

**Owns:** `self/tbaa.ts`, `self/emit_arrays.ts`, `self/emit_classes.ts`, `tests/cases/arr_field_reload*`, `tests/run.js` (one new structural guard), plus the shared files.

**(b)** Element loads and stores get alias information that lets LLVM prove an element store cannot write a class field slot or an array header. Candidates are a TBAA type per element kind under the existing root, or putting class field accesses into their own alias-scope domain next to the existing header/data domains (`arr_alias_domains`). The stage picks one and writes the argument into ARCHITECTURE.md's attribute soundness rules. The argument has to cover:

- a data block and a class object are distinct allocations and never overlap;
- arrays of **inline records**, whose element stores *do* write record fields, so those accesses must keep the tags that let them alias the record's field accesses;
- `Result` by-value objects and the WP17 stack objects;
- `--threads` builds.

A pointer-typed element (Towers' `(TowersDisk | null)[]`) must not be tagged as aliasing a pointer-typed field unless it can.

**(c)** Check whether the `bounds.fail` block is already placed out of line under `-O3` (the callee is `cold`). Measure an explicit branch weight on the `icmp ult` branch (`!prof`, or `llvm.expect`) on Permute, Queens and Towers. Keep it only if it measures past noise, and record the numbers either way.

Measure (b) and (c) separately, as separate commits with numbers in each commit body, against stage 2's merged result where available and otherwise against `main`.

### Tests for stage 3

`arr_field_reload` (the swap shape) as a golden. A `tests/run.js` structural guard, in the style of the `opt -O2` vectorisation guard on `cf_sum_loop`: after `opt -O3` the swap function has exactly one load of the field and one header load. Once stage 2 is merged it also has at most two `nish_panic_index` calls. A negative case, `arr_field_reload_records`, shows an inline-record array still reloads.

## AWFY in bench

**Owns:** `bench/awfy/**`, `bench/run.mjs`, `bench/README.md`, `docs/wp9-optimisation.md`, `docs/BENCHMARKS.md` (only if `bench/run.mjs` regenerates it), plus the shared files (bench/ is in the self-hosting corpus, so `tests/self/goldens/` and `tests/nish-cmp.js` will see the new programs).

- Copy the seven ports and `harness.ts`/`som.ts` into `bench/awfy/`, keeping the SOM/AWFY attribution header and adding the upstream licence note. Remove the manual `Arena.mark`/`release` from `Storage.benchmark`, because the compiler now owns it. Keep the harness's per-iteration release, which stands in for the GC between measurements.
- Place them where the corpus rules expect a multi-module program (`main.ts` in the directory, see `tests/self/corpus.js`). Check the differential register and the performance gate, which applies to `examples/` and `std/`, not `bench/`.
- `bench/run.mjs`: a mode that builds `bench/awfy` checked, runs each of the seven for 30 iterations, and reports the median of the last 20. `--validate` runs one short iteration of each and checks that `verifyResult` passed.
- `docs/wp9-optimisation.md`: a section with the table for all seven, 0.10.0 (the seed) against `main`, on one machine, with the machine line.

### The indirection hypothesis

Profile Queens and Towers, unchecked and released, against the C++ port (`benchmarks/C++` in the AWFY repo, clang 18 `-O3 -flto -march=native`), with `perf stat` / `perf record` or callgrind. Establish whether `this → header → data` reloads remain after stage 3. Write the evidence and a proposed fix (for example, fixed-length arrays inline in the object) into the same doc section. **Do not implement it**: the ask was to profile before changing anything.

## Out of scope

- Changing the default to unchecked, adding flags, or changing any semantics.
- Per-iteration (loop-body) arena scopes. The diagnostic points at them, but they are not built.
- Interprocedural range facts (proving `swap(n1, i)` in range from `permute`).
- Inline fixed-size arrays in objects (hypothesis 3's likely fix): proposed, not built.
- Any edit to the AWFY repository itself.

## Verification

Every stage: `npm run check`, then `npm test` with LLVM 18 on `PATH`. Read the summary: **no `DEGRADED:` line**, and the skip count is stated in the PR. Also `npm run lint`, and `node docs/check-links.mjs` when Markdown changed. Every PR body carries the TypeScript snippet and exact IR for each case it adds (repo rule), and the AWFY numbers for all seven benchmarks, before and after.
