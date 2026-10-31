---
name: Language features for a typescript-go port
overview: Eleven Nish language, runtime and standard-library changes that a faithful, fast port of the TypeScript 7 compiler (typescript-go) needs, each one PR, each kept fully legal TypeScript that runs unmodified under Node with the same output. Closure capture is handled by a separate session and is not in this plan.
stages:
  - id: control-flow
    title: "feat(checker): labelled break/continue and switch fallthrough"
    goal: Accept labelled break and continue on loops and blocks, and a non-empty switch clause that falls through, with the IR a hand-written flag would give
    verification: npm run check, npm run lint, node tests/run.js cf_ and node tests/run.js switch and node tests/run.js wasi and node tests/run.js performance green, the legality check from Verification on every new case, and CI's four test shards green
    todos:
      - id: cf-labels
        content: Accept labelled loops, labelled blocks and break/continue to a label in src/validator.ts, src/statements.ts, src/loop-flow.ts and lower them in src/emit-control.ts — see Control flow
        status: pending
      - id: cf-fallthrough
        content: Accept a switch clause with statements that falls through to the next, and keep every analysis that walks clauses sound — see Control flow
        status: pending
      - id: cf-tests-docs
        content: Add positive cases with goldens and Node parity, negatives for a label that names nothing or crosses a function, and update the docs — see Control flow
        status: pending
  - id: thread-stack
    title: "feat(runtime): a stack size for scope tasks and parallel workers"
    goal: Let a program give a thread scope and the data-parallel workers a stack size, so a deeply recursive task (a type checker) does not overflow
    verification: npm run check, npm run lint, node tests/run.js thread and node tests/run.js par_ and node tests/run.js wasi green, a deep-recursion link test that fails at the default size and passes with the larger one, the legality check, CI green
    todos:
      - id: stack-api
        content: Add the stack-size option to std/threads.ts and runtime/nish.d.ts with a Node-side no-op — see Thread stack size
        status: pending
      - id: stack-runtime
        content: Apply it with pthread_attr_setstacksize in runtime/runtime-parallel.c, with a guard page, and refuse a size below the platform minimum — see Thread stack size
        status: pending
      - id: stack-tests-docs
        content: Add the deep-recursion link test, a negative test, and the docs — see Thread stack size
        status: pending
  - id: array-sort
    title: "feat(checker): Array sort with a comparator"
    goal: Accept xs.sort(cmp) with a comparator, stable and element-for-element identical to Node's Array.prototype.sort, compiled to a direct call to the comparator
    verification: npm run check, npm run lint, node tests/run.js sort and node tests/run.js arr_ green, a 10,000-element case with ties whose output matches node tests/differential/unmodified.js, the legality check, CI green
    todos:
      - id: sort-impl
        content: Implement a stable merge sort as a std template in std/sort.ts instantiated per comparator, and route xs.sort(cmp) to it from src/arrays.ts and src/emit-arrays.ts — see Array sort
        status: pending
      - id: sort-tests-docs
        content: Add cases for ties, an empty and a one-element array, a comparator that answers a non-integer in f64 mode, negatives for sort with no comparator, and the docs — see Array sort
        status: pending
  - id: map-keys
    title: "perf(runtime): fast integer Map keys, and a composite-key idiom"
    goal: Make Map lookups with integer and enum keys as cheap as FxHashMap, and give a legal-TypeScript way to key a map by two integers without building a string
    verification: npm run check, npm run lint, node tests/run.js map_ and node tests/run.js set_ and node tests/run.js performance green, a Measured trailer from bench/map-keys against the current release, Node parity for every new case, CI green
    todos:
      - id: map-measure
        content: Add bench/map-keys measuring get/set/has for i32, i64 and enum keys against the 0.28 release, and record which hash integer keys use today — see Map keys
        status: pending
      - id: map-hash
        content: Switch integer and enum keys in std/collections.ts to a cheap mixer if they are slower than it, keeping SipHash for strings, and record the HashDoS reasoning — see Map keys
        status: pending
      - id: map-composite
        content: Document and test the composite-key idiom (two i32 packed into one i64 key) in docs/guide/language/maps-and-sets.md — see Map keys
        status: pending
  - id: default-rest-params
    title: "feat(checker): default parameters and rest parameters"
    goal: Accept a parameter with a default value and a final rest parameter on functions, methods and constructors, with Node parity
    verification: npm run check, npm run lint, node tests/run.js param and node tests/run.js fn_ and node tests/run.js wasi and node tests/run.js performance green, the legality check, CI green
    todos:
      - id: params-default
        content: Accept a default parameter value that is a constant or an expression of earlier parameters, and fill it at each call that omits it — see Default and rest parameters
        status: pending
      - id: params-rest
        content: Accept a final rest parameter, lowered to an array the call builds (stack-allocated where escape analysis allows) — see Default and rest parameters
        status: pending
      - id: params-tests-docs
        content: Add positive and negative cases, keep x? refused with a message naming the default-parameter spelling, and update the docs — see Default and rest parameters
        status: pending
  - id: union-scale
    title: "test(checker): discriminated unions at typescript-go scale"
    goal: Prove that a 200-variant discriminated union shaped like typescript-go's node data compiles fast, narrows in a switch and lowers to a jump table, and fix whatever does not
    verification: node tests/run.js union green including the new scale case, compile time of the scale case recorded in the PR, npm run check, npm run lint, CI green
    todos:
      - id: union-generate
        content: Add a generator under scripts/ that writes a 200-variant tagged-union program, and the generated case under tests/cases — see Unions at scale
        status: pending
      - id: union-fix
        content: Measure compile time and read the IR, and fix any quadratic pass or missing jump table it exposes — see Unions at scale
        status: pending
  - id: compressed-refs
    title: "docs: compressed 32-bit references, designed and measured"
    goal: Decide, with numbers, whether Nish should compress object references to 32 bits and how, without changing the language
    verification: npm run lint, docs/check-links.mjs green, the bench builds and prints its table, CI green
    todos:
      - id: refs-bench
        content: Write bench/wp47-refs comparing an AST-shaped pointer graph with the same graph as records in arrays addressed by i32 — see Compressed references
        status: pending
      - id: refs-design
        content: Write docs/wp47-compressed-references.md with the measured numbers, the two designs, and a recommendation — see Compressed references
        status: pending
  - id: inline-fields
    status: cancelled
    title: "perf(codegen): store a readonly class field inline"
    goal: Lay out a readonly field of class type that is initialised with a fresh object and never reassigned inside its owner, with one allocation and no pointer hop, and no change to what a program means
    verification: npm run check, npm run lint, node tests/run.js cls_ and node tests/run.js layout and node tests/run.js mem_ and node tests/run.js wasi and node tests/run.js performance green, a Measured trailer on a nested-field benchmark, Node parity, CI green
    todos:
      - id: inline-rule
        content: Decide which fields qualify in the checker and record it as a fact the emitter reads — see Inline fields
        status: cancelled
      - id: inline-layout
        content: Change the struct layout in src/structs.ts and src/runtime.ts and the C side, the TBAA tree, debug info and the interop headers together — see Inline fields
        status: cancelled
      - id: inline-escape
        content: Treat a reference to an inline field as a reference to its owner in src/escape.ts, so a stack-allocated owner escapes when the field does — see Inline fields
        status: cancelled
      - id: inline-tests-docs
        content: Add layout tests, identity tests, escape tests and the docs — see Inline fields
        status: cancelled
  - id: arena-speculation
    status: cancelled
    title: "feat(runtime): speculative allocation that rolls back"
    goal: Let a parser try a parse and give back everything it allocated when the attempt fails, soundly, in legal TypeScript
    verification: npm run check, npm run lint, node tests/run.js arena and node tests/run.js mem_ and node tests/run.js wasi green, a case whose Arena.used is unchanged after 100,000 failed attempts, Node parity, CI green
    todos:
      - id: spec-api
        content: Add the speculation block to the arena builtins and runtime/nish.d.ts, modelled on using a = arena() — see Arena speculation
        status: cancelled
      - id: spec-rule
        content: Refuse a store of an allocation made inside the block into older memory before the commit, reusing the arena block's escape rule — see Arena speculation
        status: cancelled
      - id: spec-free-lists
        content: Document the free-list idiom for recycled records in docs/guide/language/memory.md — see Arena speculation
        status: cancelled
  - id: thread-handoff
    status: cancelled
    title: "feat(checker): tasks that answer object graphs"
    goal: Let a scope task and a data-parallel body answer class instances and arrays of them, adopted by the parent at join, while threads read a shared const graph
    verification: npm run check, npm run lint, node tests/run.js thread and node tests/run.js par_ and node tests/run.js wasi and node tests/run.js performance green, a link test building one AST per task and reading all of them after the join under ASan, Node parity, CI green
    todos:
      - id: handoff-adopt
        content: Let a task's answer type be a class or an array of them, and link the task arena's chunks into the parent's at join in runtime/runtime-parallel.c — see Thread handoff
        status: cancelled
      - id: handoff-rules
        content: Keep the parent from writing any object a running task can reach, and refuse an answer that points into memory the task does not own — see Thread handoff
        status: cancelled
      - id: handoff-tests-docs
        content: Add link tests, negative tests and the docs, including the threads guide page — see Thread handoff
        status: cancelled
  - id: regions
    status: cancelled
    title: "feat(runtime): regions for programs that do not exit"
    goal: Implement WP46's recommended regions, an arena handle the program frees, so a long-running program's memory follows what it holds rather than what it ever made
    verification: npm run check, npm run lint, node tests/run.js region and node tests/run.js mem_ and node tests/run.js wasi and node tests/run.js performance green, bench/wp46-memory/sessions.ts flat in Arena.mark over 2M requests, Node parity, CI green
    todos:
      - id: regions-impl
        content: Implement the region API and its checker rules as docs/wp46-long-running-memory.md recommends — see Regions
        status: cancelled
      - id: regions-tests-docs
        content: Add positive, negative and use-after-free cases, the memory benchmark result, and the docs — see Regions
        status: cancelled
---

# Language features for a typescript-go port

## Context

We surveyed typescript-go and the Rust ports of it (tsrs, ts-rust, tsz, rscript, stc) to find what Nish lacks for a faithful, fast port of the TypeScript 7 compiler. None of the ports frees memory during a compile, so Nish's arena is enough there. The gaps are threads that hand back object graphs, layout (inline fields, compact references), a few control-flow and parameter forms, sorting, map hashing, and memory for long-running programs. Closure capture is the subject of a separate session and is out of this plan.

## The hard rule: stay fully legal TypeScript

Every program these stages accept must:

1. type-check with `tsc --strict` against [runtime/nish.d.ts](../../runtime/nish.d.ts), and
2. run unmodified under Node (`node tests/differential/unmodified.js`) with the output its compiled self prints.

So no stage adds syntax TypeScript lacks, and no stage gives an existing TypeScript construct a meaning Node would not reproduce. Three consequences are decided here:

- Optional parameters `x?: T` stay refused: in TypeScript the omitted value is `undefined`, which Nish does not have. Default parameters give the same convenience with no `undefined`.
- `Map` keeps JavaScript's key semantics. A key compared by value would diverge from Node, so composite keys are an idiom (pack into one integer), not a change to `Map`.
- Inline fields and compressed references change layout only, never meaning, and need no new syntax.

## Shared files

Each stage owns its compiler and runtime files exclusively while it runs (the `Owns` lines below, and the wave order). These files are shared, edited by appending a stage's own section or row, and conflicts in them are resolved by the worker next to merge: [docs/LANGUAGE.md](../../docs/LANGUAGE.md), [docs/AI.md](../../docs/AI.md), `docs/guide/**`, [docs/IR_COOKBOOK.md](../../docs/IR_COOKBOOK.md), `docs/cookbook/**`, [docs/MASTER_PLAN.md](../../docs/MASTER_PLAN.md), [src/codes.ts](../../src/codes.ts) (new codes only, each the next free number in its band), [runtime/nish.d.ts](../../runtime/nish.d.ts), [README.md](../../README.md), [std/README.md](../../std/README.md), [llms.txt](../../llms.txt), [scalar.config.json](../../scalar.config.json). Generated files are regenerated, never merged by hand: `tests/self/goldens/checked/**`, the differential goldens, `tests/differential/emit-ts-known.txt` (only under the CI-pinned Node).

## Waves and merge order

| Wave | Stages, run together | Waits for |
| --- | --- | --- |
| 1 | control-flow, thread-stack, array-sort, map-keys | — |
| 2 | default-rest-params, union-scale, compressed-refs | control-flow merged (shares `src/statements.ts`, `src/parser.ts`) |
| 3 | inline-fields, thread-handoff | default-rest-params merged (inline-fields) and thread-stack merged (thread-handoff) |
| 4 | arena-speculation | inline-fields merged (shares `src/escape.ts`) |
| 5 | regions | arena-speculation merged (shares the arena runtime and its escape rule) |

**This run builds waves 1 and 2 only** (signed off 2026-10-31). Waves 3–5 (inline-fields, thread-handoff, arena-speculation, regions) are cancelled here and kept as the design for a later run.

At most four stages run at once. A stage starts when the row it waits for has merged.

## Control flow

**Owns:** `src/validator.ts`, `src/statements.ts`, `src/loop-flow.ts`, `src/emit-control.ts`, `src/parser.ts`, `src/nodes.ts`, `src/emit-ts-control.ts`, `tests/cases/cf_label*`, `tests/cases/cf_switch_fall*`, `tests/cases/reject_label*`, `tests/cases/reject_switch_fall*`, plus the shared files.

- Labelled `break`/`continue` lower to a branch to the labelled construct's exit or latch block. The parser already keeps a label's text on `N_BREAK`/`N_CONTINUE` for the current refusal.
- Fall-through: a clause with statements that does not end in `break`/`return`/`continue` flows into the next clause's block. Today this is `reject_switch_fallthrough`. Every pass that walks clauses (definite return, loop-flow, bounds, escape, secret) must see the extra edge.
- Negatives: a label naming nothing, `continue` to a block label, a label crossing an arrow or function, a duplicate label.
- Docs: the `LANGUAGE.md` rows in "Forbidden constructs" (labeled statements) and "switch" move to accepted rules; the guide page `docs/guide/language/control-flow.md`; `README.md` ~590, which lists labelled break/continue as a refusal.

## Thread stack size

**Owns:** `std/threads.ts`, `runtime/runtime-parallel.c`, `runtime/nish.h`, `tests/link/thread_stack*/**`, `tests/cases/reject_thread_stack*`, plus the shared files.

- A legal-TypeScript option on the thread surface (the worker designs the spelling, for example a `scope()` argument and a matching option for the data-parallel forms), declared in `runtime/nish.d.ts` and ignored under Node.
- `pthread_attr_setstacksize` with the size rounded to the page size; the platform minimum refused with a diagnostic when it is a constant and a panic when it is not.
- Test: recursion depth that overflows the default and completes with the larger size.

## Array sort

**Owns:** `std/sort.ts` (new), `src/arrays.ts`, `src/emit-arrays.ts`, `src/std-modules.ts`, `tests/cases/arr_sort*`, `tests/cases/reject_arr_sort*`, plus the shared files.

- `xs.sort((a, b) => a.k - b.k)` accepted on arrays (not on readonly arrays), returning the receiver as JavaScript does. A stable merge sort (JavaScript requires stability since ES2019), so equal keys keep their order exactly as Node's.
- The comparator is a function argument, so the same instantiation rules as function parameters apply. Comparator results follow JavaScript: negative, zero, positive; `NaN` treated as zero.
- `xs.sort()` with no comparator (string order in JavaScript) stays refused with a message showing the comparator form.

## Map keys

**Owns:** `std/collections.ts`, `src/map.ts`, `src/emit-map.ts`, `bench/map-keys/**`, `tests/cases/map_key_*`, `docs/wp32-map.md`, `docs/security/` record for collections if one exists, plus the shared files.

- Measure before changing: if integer keys already hash with a cheap mixer, this stage only adds the benchmark, the idiom and the doc.
- A cheap integer mixer is predictable. Write down in `docs/wp32-map.md` (and the security record, if collections has one) why that is acceptable for integer keys, or keep a keyed hash where keys can come from an attacker.
- Composite keys: `(a: i32, b: i32) → toI64(a) * 2^32 + toI64(b)` as a documented, tested idiom with Node parity.

## Default and rest parameters

**Owns:** `src/declarations.ts`, `src/expressions.ts`, `src/symbols.ts`, `src/members.ts`, `src/emit-classes.ts` (calls are emitted there), `tests/cases/param_*`, `tests/cases/reject_param_*`, plus the shared files. The closure session also edits `src/expressions.ts`. Whichever merges second rebases.

- A default is filled at the call site, evaluated left to right after the arguments before it, matching JavaScript's evaluation order.
- Rest parameter: the call builds the array. It is stack-allocated when the callee does not capture it.
- `x?: T` stays refused (see the hard rule), and its message names `x: T = <default>`.

## Unions at scale

**Owns:** `scripts/gen-union-scale.mjs` (new), `tests/cases/union_scale*`, `src/types.ts`, `src/emit.ts`, `src/emit-control.ts`, `src/statements.ts` (the union and switch code; control-flow has merged by wave 2). A fix needed outside these files is reported in the PR body, not made.

- Generate 200 variants with 2–6 fields each, a `switch (n.kind)` over all of them, and accessor functions. Record compile time and check the `switch` lowers to a `switch` instruction (a jump table), not a compare chain.
- Fix any pass that is quadratic in the number of variants.

## Compressed references

**Owns:** `bench/wp47-refs/**`, `docs/wp47-compressed-references.md` (new).

- Benchmark one AST-shaped workload two ways: class objects linked by pointers, and records in arrays addressed by `i32` with `uncheckedGet`. Report memory and time.
- Design two options: a whole-program mode that compresses every reference to a 32-bit offset into a reserved range (as tsrs does), and a library pool type. Recommend one with the numbers. No compiler change in this stage.

## Inline fields

**Owns:** `src/structs.ts`, `src/runtime.ts`, `src/emit-classes.ts`, `src/escape.ts`, `src/tbaa.ts`, `src/debug.ts`, `src/interop-header.ts`, `src/interop-abi.ts`, `runtime/runtime.c`, `runtime/nish.h`, `tests/layout/**`, `tests/cases/cls_inline_*`, plus the shared files.

- Qualifies: a `readonly` field of class type, assigned exactly once in the constructor or its initialiser from `new C(...)` or an object literal, in a class that is not exported to C or a host. Nothing else changes layout.
- Meaning is unchanged: reading the field yields a pointer into the owner, identity and `===` behave as before, and Node needs no change.
- Escape analysis: a pointer to an inline field keeps its owner alive, so storing `o.inner` anywhere makes `o` escape.
- Layout is two-sided (orientation, rule 4): `src/runtime.ts` and the C side change together, and `tests/layout` cross-checks against clang.

## Arena speculation

**Owns:** `src/escape.ts`, `src/builtins.ts`, `src/emit-builtins.ts`, `runtime/runtime.c`, `tests/cases/arena_spec*`, `tests/cases/reject_arena_spec*`, `docs/guide/language/memory.md`, plus the shared files.

- A `using`-scoped speculation (the worker picks the spelling, legal TypeScript and declared in `runtime/nish.d.ts`) with an explicit commit. Leaving the block without committing rewinds the arena to where the block began; committing keeps everything.
- Before the commit, nothing allocated in the block may be stored into older memory: the same rule `using a = arena()` enforces today. After the commit the allocations are ordinary.
- Under Node the block is a no-op, so output is identical.

## Thread handoff

**Owns:** `src/parallel.ts`, `src/emit-parallel.ts`, `runtime/runtime-parallel.c`, `std/threads.ts`, `docs/wp29-thread-surface.md`, `docs/guide/using-nish/threads.md`, `tests/link/thread_handoff*/**`, `tests/cases/reject_thread_handoff*`, plus the shared files.

- A task's answer (spawn's destination element, or a data-parallel result element) may be a class instance or an array of them. At join the task arena's chunks are linked into the parent's arena (extend `nish_cross_adopt`), so nothing is copied.
- Soundness: the answer may point only into memory the task allocated or into the shared const graph the task captured; the parent writes nothing a running task can reach (the existing R7-style rule, extended to objects).
- Shared read-only graphs: tasks already read captured `const` references. Pin with a test that many tasks read one graph while each builds its own.

## Regions

**Owns:** `src/regions.ts` (new), `src/escape.ts`, `runtime/runtime.c`, `docs/wp46-long-running-memory.md`, `bench/wp46-memory/**`, `tests/cases/region_*`, `tests/cases/reject_region_*`, plus the shared files.

- Implement the recommendation of [docs/wp46-long-running-memory.md](../../docs/wp46-long-running-memory.md), in legal TypeScript, with its checker rules against use after free. Mark WP46 built.
- The sessions benchmark must hold `Arena.mark()` flat over 2M requests.
- This is a new allocator surface, so it ships with its `docs/security/` record and scope row (`CLAUDE.md` → "Attacker-facing code"), if the record's scope rules cover it.

## Out of scope

Closure capture (another session); function values stored in fields (waits for closure capture and is a later run); `x?: T` optional parameters; nullable scalars (`i32 | null`); function parameters on methods; a compressed-reference compiler mode (this plan only designs it).

## Tests

Every construct follows `docs/ARCHITECTURE.md` → "How to add a construct": golden `.ll`, `llvm-as` pass, native round trip with expected stdout, at least one negative test, registered with `node tests/differential/goldens.js --update`. Performance claims carry a `Measured:` trailer with its noise band.

## Verification

Per stage, besides the stage's own line:

```bash
npm run check
npm run lint
node tests/run.js <the stage's filters>
WASI_SYSROOT=/usr node tests/run.js wasi
node tests/run.js performance
node tests/self/goldens.js --update   # then read the diff
node tests/differential/unmodified.js
npx tsc --noEmit --strict --target es2022 --lib es2022 runtime/nish.d.ts <every new tests/cases/*.ts>
```

The legality check is the last line: every new positive case must pass it. The full suite is CI's four shards, each read for its skip count.
