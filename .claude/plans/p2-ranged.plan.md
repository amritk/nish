---
name: Clear the open bugs, then threads P2 (scope) and ranged integers W1–W4
overview: Fix the six open compiler bugs (issues 224, 225, 233, 234, 235 and 246), then build wp29 P2 — using s = scope(); s.spawn(fn, arg), joined on every exit of the block — and wp31 W1–W4, the integer<Lo, Hi> type with checked entry, the proofs that drop the check, the host-boundary RangeError, and the measurement.
stages:
  - id: threads-reduce-fixes
    title: fix(interop) — parallelReduce under Node, and NL2348 at the call for a non-scalar reduce
    goal: A parallelReduce program prints the same natively and under Node's documented prelude path, and a reduce over string or class elements is refused with one NL2348 at the user's call naming the type (issues 224 and 225).
    verification: npm run check && node tests/run.js par_ && node tests/run.js threads && npm test (zero non-environmental skips)
    todos:
      - id: b1-node
        content: Remove the i64-with-number mixing from std/threads.ts reduceBlockCount and reduceBlockStart without changing the blocking — see Stage B1
        status: pending
      - id: b1-resolve
        content: Make nish/threads resolve under the documented Node path and add a tests/run.js check that runs a parallelReduce and a parallelMapInto program under Node against native output — see Stage B1
        status: pending
      - id: b1-nl2348
        content: Refuse a non-scalar reduce element type at the call in src/parallel.ts with NL2348, pinned by reject_par_reduce_result_type (string and class) — see Stage B1
        status: pending
  - id: result-must-handle
    title: fix(checker) — a stored Result is not a discard, and Map of Result compiles
    goal: An assignment of a Result is not NL2025, a discard of a T in a generic body is judged against the template, and new Map<string, Result<i32, string>>() compiles and runs, including get, delete and compaction (issue 233).
    verification: npm run check && node tests/run.js result && node tests/run.js map_value_result && npm test (zero non-environmental skips)
    todos:
      - id: b2-assign
        content: Exempt an assignment expression statement from rejectDiscardedResult in src/result.ts and its call site, and settle r2 = r1 on locals — see Stage B2
        status: pending
      - id: b2-generic
        content: Judge a discard in a generic body against the template's declared type so T = Result does not trip NL2025 in std/collections.ts — see Stage B2
        status: pending
      - id: b2-zeroof
        content: Fix zeroOf in src/emit-map.ts for a K_RESULT value and add map_value_result (set, has, get, delete, compaction) — see Stage B2
        status: pending
  - id: narrowing-soundness
    title: fix(checker) — a proof never leaves a proof consumer, and an assignment ends a narrowing in an && chain
    goal: The issue-234 ternary, array-literal and let programs and the issue-235 && chain program are all refused with stable codes, for T | null and Result alike.
    verification: npm run check && node tests/run.js reject_result_ && node tests/run.js reject_null_ && node tests/run.js narrow && npm test (zero non-environmental skips)
    todos:
      - id: b3-canon
        content: Canonicalise a narrowed identifier to the unknown state wherever its value flows (initialiser, ternary arm, array element, argument, return, store) in src/expressions.ts and src/arrays.ts — see Stage B3
        status: pending
      - id: b3-chain
        content: End a variable's narrowing for later operands of an && or || chain once an operand assigns it, in narrowBinary — see Stage B3
        status: pending
      - id: b3-tests
        content: Add reject_result_ternary_keeps_proof, reject_result_array_keeps_proof, reject_result_let_keeps_proof, reject_null_narrowing_assigned_in_chain and its Result twin, and the LANGUAGE.md rule — see Stage B3
        status: pending
  - id: lexer-surrogates
    title: fix(checker) — a surrogate-pair escape is the code point it spells
    goal: A high-surrogate escape followed by a low-surrogate escape encodes as one 4-byte UTF-8 code point, so the issue-246 program prints true 4 4 natively, and a lone surrogate has a written rule and a case.
    verification: npm run check && node tests/run.js str_ && node tests/run.js lex && npm test (zero non-environmental skips)
    todos:
      - id: b4-join
        content: Join a \uD8xx–\uDBxx escape with an immediately following \uDCxx–\uDFxx escape in src/lexer.ts before utf8Encode — see Stage B4
        status: pending
      - id: b4-lone
        content: Decide and state the lone-surrogate rule in docs/LANGUAGE.md (WTF-8 as today, or a refusal with a code), with its case — see Stage B4
        status: pending
      - id: b4-tests
        content: Add str_surrogate_pair (=== against the literal emoji, and a Map key found by either spelling) — see Stage B4
        status: pending
  - id: threads-scope
    title: feat(checker) — threads P2, using s = scope() and s.spawn(fn, arg)
    goal: using s = scope(); s.spawn(entry, arg) spawns an OS thread per call and joins every one of them at every exit of the block, natively, and runs the same program under Node, per wp29 §4.2 and wp20 T1/T2.
    verification: npm run check && node tests/parser-oracle.js --verbose && node tests/run.js thread_ && node tests/run.js par_ && node tests/run.js self && npm test (zero non-environmental skips)
    todos:
      - id: p2-decide
        content: Record the P2 decisions (using only for scope, no thread count, what a spawn may take and hand back, Node's flag) in wp29 §4.2's status note and §11 — see Stage P2
        status: pending
      - id: p2-parse
        content: Lex and parse a using declaration as a kind of the existing variable declaration, with the parser oracle mapping it — see Stage P2
        status: pending
      - id: p2-check
        content: Check scope and spawn in src/parallel.ts — using required, entry a named top-level function, argument shareable or lent, with new NL23xx codes — see Stage P2
        status: pending
      - id: p2-emit
        content: Emit spawn and the join at every exit of the block, nested inside the arena bracket, with the runtime in runtime/runtime-parallel.c — see Stage P2
        status: pending
      - id: p2-node
        content: Add scope and spawn to std/threads.ts so the same file runs under Node, and a tests/run.js check comparing it with native — see Stage P2
        status: pending
      - id: p2-docs
        content: Add the LANGUAGE.md rules, AI.md, cookbook entry, RUN_UNDER_NODE.md line and a measured heterogeneous example — see Stage P2
        status: pending
  - id: ranged-w1
    title: feat(checker) — ranged integer types (WP31)
    goal: integer<Lo, Hi> is a type — parsed, interned as K_RANGED, mangled rng.p0.p255, i32 everywhere — every entry into it is checked at run time, every §4 refusal has a code, and -g writes a typedef, exactly as wp31 §10's W1 row lists.
    verification: npm run check && node tests/parser-oracle.js --verbose && node tests/run.js rng_ && node tests/run.js dbg_rng && node tests/differential/unmodified.js --compiler build/nish-test && node tests/run.js self && npm test (zero non-environmental skips)
    todos:
      - id: w1-parse
        content: Add N_TYPE_LITERAL as the next node kind (63 today, N_COUNT moving to 64) to src/nodes.ts and parsePrimaryType, with the parser oracle mapping — see Stage W1
        status: pending
      - id: w1-type
        content: Add K_RANGED to the type table with rangedOf, typeName, mangle and resolveReference, turning NL2333 into the type — see Stage W1
        status: pending
      - id: w1-refuse
        content: Refuse every §4 row, a literal type anywhere else, and a ranged type in a declare function, each with a new NL2xxx code and a wordings program — see Stage W1
        status: pending
      - id: w1-entry
        content: Check every §6 entry with one unsigned compare and a cold panic through one shared panic-tail helper, and a compile error for an out-of-range literal — see Stage W1
        status: pending
      - id: w1-widen
        content: Implement §7's widening (const keeps the range, let widens, operators read i32, type arguments keep it) — see Stage W1
        status: pending
      - id: w1-dbg
        content: Emit the DW_TAG_typedef for -g and add the runtime/nish.d.ts line — see Stage W1
        status: pending
      - id: w1-docs
        content: Add the LANGUAGE.md Types rule, AI.md, the cookbook entry, and the Node divergence in its three places — see Stage W1
        status: pending
  - id: ranged-w2
    title: perf(checker) — prove range entries and index through declared ranges (WP31)
    goal: declaredRange feeds knownNonNegative and maxIndexOf, the walk records nodeProvenRange so proven entries emit nothing, u8/u16 gain their upper bound, and a check left inside a loop warns with a new performance code (wp31 §8).
    verification: npm run check && node tests/run.js perf_rng && node tests/run.js arr_bounds_ranged && node tests/run.js perf && node tests/run.js self && npm test (zero non-environmental skips)
    todos:
      - id: w2-query
        content: Add declaredRange to src/types.ts and use it in knownNonNegative and maxIndexOf in src/bounds.ts — see Stage W2
        status: pending
      - id: w2-judge
        content: Judge each §6 entry in walkExpression and walkDeclaration into program.nodeProvenRange and have the emitter skip proven checks — see Stage W2
        status: pending
      - id: w2-facts
        content: Add the toI32 of an unsigned initialiser fact and the new NL9xxx warning with the perf gate at zero for std and examples — see Stage W2
        status: pending
      - id: w2-tests
        content: Add perf_rng_loop, perf_rng_quiet, arr_bounds_ranged and perf_rng_counter — see Stage W2
        status: pending
  - id: ranged-w3
    title: feat(interop) — ranged parameters at the host boundary (WP31)
    goal: Under the linkage condition a ranged parameter is checked at the call site, otherwise in the callee's prologue, and the N-API and wasm bridges throw a RangeError before the call; the header and .d.ts carry the range in a comment (wp31 §9).
    verification: npm run check && node tests/run.js interop_rng && node tests/run.js interop && npm test (zero non-environmental skips)
    todos:
      - id: w3-abi
        content: Rename privateResultAbi to privateAbi and place ranged checks at call sites or in the prologue by it — see Stage W3
        status: pending
      - id: w3-bridges
        content: Read a ranged N-API argument as a double and throw napi_throw_range_error, and the same RangeError in the wasm loader — see Stage W3
        status: pending
      - id: w3-sidecars
        content: Write the range in the C header and .d.ts comments and skip non-scalar ranged positions with the existing not-declared line — see Stage W3
        status: pending
      - id: w3-tests
        content: Add interop_rng_* (header under clang -Werror -pedantic, .d.ts under tsc, a Node call that must throw) — see Stage W3
        status: pending
  - id: ranged-w4
    title: docs(wp31) — record the ranged-integer measurements
    goal: bench/cursor.ts and the getByte program are committed and measured under wp15 §2's protocol, and the three §10 criteria are written into wp31 and wp15 item 6 with their numbers.
    verification: node bench/run.mjs --validate && node tests/run.js bench && node docs/check-links.mjs && npm test (zero non-environmental skips)
    todos:
      - id: w4-cursor
        content: Commit bench/cursor.ts and re-derive the proven and unchecked ratio on it — see Stage W4
        status: pending
      - id: w4-getbyte
        content: Commit the getByte program with i integer<0, 255> and check its IR and attributes, then time it against unchecked — see Stage W4
        status: pending
      - id: w4-record
        content: Write the numbers into docs/wp31-ranged-integers.md §10 and docs/wp15-performance.md item 6 — see Stage W4
        status: pending
---

# Clear the open bugs, then threads P2 and ranged integers

## Context

`main` is at `2b2eb95` (#256 moved the compiler from `self/` to `src/`; issues filed before it cite `self/` paths). The Release PR #249 (0.13.0) is open and is never touched by this run.

Open bugs: #224 and #225 (escalated by the wp29 P1 run, #211), #233, #234, #235 and #246 (filed by the WP32 run, #226). #215 and #216 were resolved on `main` by the awfy-perf-2 run (#217: #218, #220, #221, #222, #236; `docs/wp9-optimisation.md` "Against #217's targets", and `perf_arena_control` plus `mem_loop_scope_chunk` in `tests/run.js`). The lead closes them, and the finished ledgers #199, #217 and #226, with evidence. #211 closes when B1 merges. The design notes are [`docs/wp29-thread-surface.md`](../../docs/wp29-thread-surface.md) §4.2, §7 and §11 (with [`docs/wp20-threads.md`](../../docs/wp20-threads.md) T1/T2) and [`docs/wp31-ranged-integers.md`](../../docs/wp31-ranged-integers.md), whose §10 table *is* the W1–W4 contract. LANGUAGE.md stays normative.

## Approach

- **Bugs first, then features.** Wave 1 is B1, B2, B4 and W1 (the longest chain). P2 starts once B1 merges, and B3 once B2 merges. W2 → W3 → W4 are sequential.
- **Every stage is one squash-merged PR** with a conventional title (the stage title), and meets the repo's definition of done. That means: goldens with an `llvm-as` pass, native round trips, a negative test per rule, and the LANGUAGE.md rule and cookbook entry for a construct.
- **Node kinds and codes are append-only and shared.** W1 owns the next node kind (`N_TYPE_LITERAL`, 63 on `main` today; wp31 §4's 61 predates `N_ARROW`). P2 adds **no node kind**: `using` is a declaration kind on the existing variable-declaration node. A new diagnostic code takes the next free number in `src/codes.ts` at merge time. When two stages collide, the later one renumbers after merging `main`, and its title, tests and docs follow.
- **Shared files are edited by section**, not owned: `docs/LANGUAGE.md`, `docs/AI.md`, the cookbook, `tests/run.js` (each stage adds its own named check), and `src/codes.ts`. Regenerated stores belong to no stage: `tests/self/goldens/**`, `tests/perf-baseline.json`, `bench/instructions.json`, `tests/differential/goldens/unfrozen.txt` and `tests/nish-cmp.js` DECLARED. Two concurrent stages both touch `src/statements.ts` and `src/expressions.ts` (B2, B3, W1), in different functions. The later merger merges `main` and resolves; it never rebases or force-pushes.
- **The rolling freeze.** `src/` may not *use* `using` or `integer<…>` in its own source. The seed cannot parse either.

## Stage B1 — threads-reduce-fixes (#224, #225)

**Owns:** `std/threads.ts`, `src/parallel.ts`, `src/emit-parallel.ts`, `tests/cases/*par_reduce*`, `tests/cases/reject_par_*`, `runtime/nish.mjs` and the Node resolution of `nish/threads` if needed, and its own `tests/run.js` check.

- `reduceBlockCount`/`reduceBlockStart` compute in i64 with a number literal, which throws under Node's prelude. They must compute the same blocks without that mixing. The blocking is part of the determinism contract (wp29 §11), so the block boundaries must not change: pin them with a case whose `n` is large enough to overflow i32 in `n * k`.
- #224 notes that `nish/threads` does not resolve under Node (the package self-reference is `@amritk/nish`). Make the documented `docs/RUN_UNDER_NODE.md` path work for a `nish/threads` import. Add a `tests/run.js` check that runs a reduce and a map program under Node and compares them with native output. The suite has none today.
- #225: a reduce over `string[]` or a class array must hit NL2348 at the user's call, before the std body is instantiated. Extend `reject_par_result_type` or add `reject_par_reduce_result_type`, with one `.err` each for `string` and a class.

## Stage B2 — result-must-handle (#233)

**Owns:** `src/result.ts`, the NL2025 call sites in `src/statements.ts`, `zeroOf` in `src/emit-map.ts`, `std/collections.ts` (only if the generic rule is not chosen), `tests/cases/map_value_result*`, `tests/cases/*result_store*`, and the Result section of LANGUAGE.md.

- An assignment expression statement (`rs[0] = rs[1]`, `r2 = r1`) moves a `Result` and is not a discard.
- A discard of a `T` in a generic body is judged against the template's declared type, as Rust's `must_use` is. The alternative (rewriting the std sites and documenting that must-handle applies per instantiation) is acceptable only with the reason written in the PR.
- `zeroOf` answers `null` (a pointer) for `K_RESULT`. `map_value_result` exercises `set`, `has`, `get`, `delete` and a compaction.

## Stage B3 — narrowing-soundness (#234, #235)

**Depends on:** B2 merged (the `let` case is masked by #233). **Owns:** `checkIdentifier`, `checkConditional` and `narrowBinary` in `src/expressions.ts`, `checkArrayLiteral` in `src/arrays.ts`, the `let` initialiser path in `src/statements.ts`, the `reject_result_*keeps_proof*` and `reject_*narrowing_assigned_in_chain*` cases, and the narrowing section of LANGUAGE.md.

- **The rule (from #234):** a proof state is visible only to a proof consumer. A proof consumer is the receiver of `.ok`, `.value`, `.error`, `isOk()`, `isErr()`, `unwrapOr`, `expect` or `orReturn`, or a narrowing test. Everywhere else a narrowed identifier's value flows, it is canonicalised to the unknown state. That refuses some programs `tsc` accepts, which is the safe direction. LANGUAGE.md says so.
- **The rule (from #235):** in an `&&`/`||` chain, an operand that assigns a narrowed variable ends its narrowing for every later operand. This is `assignInto`'s statement rule applied inside an expression. Confirm or refute #235's claim that the `p = null` store is missing from the IR, and fix it if real.
- One reject case per kind (`T | null`, `Result`). Every existing golden stays byte-identical, or the PR says why it moved.

## Stage B4 — lexer-surrogates (#246)

**Owns:** `src/lexer.ts` (the `\u` branch and `utf8Encode`), `tests/cases/str_surrogate*`, `tests/cases/reject_*surrogate*`, and the string-literal section of LANGUAGE.md.

- A high-surrogate escape immediately followed by a low-surrogate escape encodes as the 4 bytes of the one code point, so `"😀" === "😀"`. `\u{1F600}` is already right.
- A lone surrogate needs a rule: keep WTF-8 bytes (documented), or refuse with a code. Choose, state it, and pin it with a case. The PR says which and why.

## Stage P2 — threads-scope

**Depends on:** B1 merged (both own `std/threads.ts` and `src/parallel.ts`). **Owns:** `src/parallel.ts`, `src/emit-parallel.ts`, `runtime/runtime-parallel.c` (and `runtime/nish.h` for any new symbol), the `using` token and declaration parse in `src/lexer.ts`/`src/tokens.ts`/`src/parser.ts`/`src/validator.ts`, the block-exit hook in `src/emit-control.ts`, `std/threads.ts`, `runtime/nish.d.ts` (the scope declaration), `tests/parser-oracle.js` (its `using` mapping), `tests/cases/thread_*` and `tests/cases/reject_thread_*`, `examples/` (one new program), `docs/wp29-thread-surface.md`, and the threads sections of LANGUAGE.md, AI.md and RUN_UNDER_NODE.md.

These are the decisions to record first, in wp29's status note and §11. They are the defaults unless the worker finds evidence against them, which it states:

- **`using` is accepted only for a `scope()`** (wp29 §11's narrow answer; widening later is not a break). Anything else under `using` is refused, as is `const s = scope()`: a scope must be introduced by `using`.
- **`scope()` takes no thread count.** Each `spawn` is one OS thread (wp29 §9 declines knobs before measurements).
- **`spawn(entry, arg)`**: `entry` is a named top-level function `(a: A) => void`. `A` is shareable per wp20 T2. wp29 §7 lets a worker *write through a pointer the parent lent it*, which T2's list does not allow. The stage must settle how a worker hands a result back, soundly: two spawns of one scope, or a spawn and the parent, never both reach one mutable value while the scope is open. If a lending rule can't be proved locally, only T2-shareable arguments are admitted, and results come back through a `parallelMapInto`-style disjoint destination, or not at all. Either way it is written down.
- **A worker may not allocate anything the parent reads** (wp29 §7). Its allocations live in its own thread-local arena.
- **The join is emitted at every exit of the block** (fall-through, `return`, `break`, `continue`), nested inside the WP6 arena bracket: the parent marks, the children run, the children join, the parent releases. A spawn inside a P1 region, or a spawn inside a spawn, follows whatever `nish_par_depth` decides, and the PR says what.
- **Under Node**, `using` needs `--js-explicit-resource-management` on Node 22 (it is native from Node 24). `std/threads.ts`'s `scope()` returns an object with `[Symbol.dispose]`, and `spawn` runs its task. The same program must print the same output whenever its tasks do not print, and `RUN_UNDER_NODE.md` says so.
- **Codes:** each refusal is a new NL23xx code, with its `reject_thread_*` case and a `tests/wordings/` program. That covers: no `using`, an entry that is not a top-level function, an argument that is not shareable (naming the field that disqualifies it, per wp20's table), and a `using` of anything else. `reject_thread_unjoined` is not needed; the construct replaces it.
- **Tests:** `thread_scope_basic` (two heterogeneous spawns, results read after the block), `thread_scope_exit_paths` (join on `return`/`break`), `thread_scope_nested_arena`, and the reject cases. Each has a golden `.ll`, an `llvm-as` pass and a native round trip. Add one example with a measured before/after on four cores, recorded in the PR's `Measured:` trailer.

## Stage W1 — ranged-w1

**Owns:** `N_TYPE_LITERAL` in `src/nodes.ts`/`src/parser.ts`, `tests/parser-oracle.js`, `K_RANGED` in `src/types.ts`, `resolveReference` in `src/annotations.ts`, the entry points in `src/statements.ts`/`src/expressions.ts`/`src/members.ts` and argument checking, the declare-function refusal in `src/declarations.ts`, the panic-tail helper across `src/emit-builtins.ts`/`src/emit-result.ts`/`src/attributes.ts`, the entry emission, `src/debug.ts` (typedef), `runtime/nish.d.ts` (the one line), `tests/cases/rng_*`, `tests/cases/reject_rng_*`, `tests/cases/dbg_rng*`, `tests/wordings/**` (its programs), `tests/differential/unmodified.js` (`KNOWN`), `tests/differential/known-failures.txt`, `docs/RUN_UNDER_NODE.md` (one bullet), and the Types section of LANGUAGE.md, AI.md and the cookbook.

wp31 §10's W1 row, verbatim, is the todo list; §4, §5, §6, §7 and §9 (the DWARF and declare-function parts) are the spec. Points to hold:

- **Node kinds:** `N_TYPE_LITERAL` is the next kind (63; `N_COUNT` 64). wp31 §4 says 61, written before two kinds were appended. A literal type is parsed wherever a type is parsed, and refused by the checker everywhere except as a bound of `integer`.
- **Mangling:** `rng.p0.p255` / `rng.m128.p127`. `Box<integer<0, 255>>` is `%struct.Box$rng.p0.p255`.
- **Entries:** every §6 entry is checked in W1, since nothing is elided yet. A range that is all of `i32` gets no check. The check survives `--unchecked-indexing`. The panic tail is factored once, and `runtime.c`'s budget does not move.
- **Divergence:** the Node divergence is recorded in its three places, as §6 lists them.
- **Tests:** the tests column of the W1 row. Existing goldens move only where the shared panic helper changes their IR, and the PR says which and why.

## Stage W2 — ranged-w2

**Depends on:** W1 merged. **Owns:** `src/bounds.ts`, `declaredRange` in `src/types.ts`, the entry judge in the walk and `nodeProvenRange` in `src/program.ts`, the entry emission's skip, the new performance code, `tests/cases/perf_rng_*`, `tests/cases/arr_bounds_ranged*`, and `tests/perf-baseline.json`.

wp31 §8 and the W2 row are the spec. `knownNonNegative` reads `declaredRange` in place of `isUnsigned`, `maxIndexOf` takes the smaller of the facts and `Hi + 1`, and `Lo > 0` is never proven from flow. `perf_rng_counter` is §7's loop-counter trap: a warning, then a panic at run time. `str_bounds_proven.ll` does not move.

## Stage W3 — ranged-w3

**Depends on:** W2 merged. **Owns:** `privateResultAbi` → `privateAbi` in `src/emit-result.ts` and `src/interop-abi.ts`, the prologue check, `src/interop-header.ts`, `src/interop-dts.ts`, `src/interop-napi.ts`, `src/interop-wasm.ts`, `runtime/shim.mjs` if the loader needs it, `tests/cases/interop_rng_*`, and the interop section of LANGUAGE.md.

wp31 §9 is the spec. The value is read as a double, because `ToInt32` would wrap 4294967301 to 5, and a test uses exactly that value. A non-scalar ranged position gets the existing "not declared" skip.

## Stage W4 — ranged-w4

**Depends on:** W3 merged. **Owns:** `bench/cursor.ts`, `bench/getbyte*.ts`, `bench/run.mjs` (their entries), `docs/wp31-ranged-integers.md` (§10 and the status line), `docs/wp15-performance.md` item 6, and `docs/BENCHMARKS.md` if the programs join the suite.

wp31 §10's three numbered steps, in order, under wp15 §2's protocol. The numbers go in whatever they turn out to be: if getByte measures about 1.00x, the note says the range is a frontend fact and not a speed-up.

## Out of scope

- P3 (`Mutex<T>`, `Channel<T>`), a non-scalar worker result copied at the join, and `scope(n)`.
- A lower-bound fact family, merging range-only instantiations, a constant as a bound, and `FixedBuffer<N>` (wp31 §11).
- Adopting `integer<…>` in `src/`, which the rolling freeze blocks until the next release.
- The Release PR #249.

## Verification

Every PR meets these, in addition to its stage's verification line:

- `npm run check`;
- an undegraded `npm test` (read the skip count, not just the exit code);
- `npm run lint` clean (every rule is an error since #255);
- `node docs/check-links.mjs` when Markdown changes;
- the title passing `node scripts/changelog-gen.mjs --check-subject`;
- `scripts/bootstrap.sh --verify` reaching the fixed point for any `src/` change.

The repo has no line-coverage tool; the golden harness and the definition of done in `CLAUDE.md` are the gate.
