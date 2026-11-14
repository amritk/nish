Design and measure WP54: dynamic dispatch over interfaces ("trait objects") for Nish, lowered as a closed-world tag-and-switch rather than a vtable. This session delivers the design note, the measurements and the roadmap page in one PR. It does not implement the construct in `src/`; the implementation stages each get their own session from the note's stages section.

The hard requirement: **no program gets slower or uses more memory because this exists**, and a program that adopts it is never slower or larger than the same program written by hand today. Every claim of that kind in the note is a measurement or a test, never prose.

## Read first, in this order

1. `CLAUDE.md`, then `.claude/orientation.md`, then `.claude/architecture.md` and `docs/ARCHITECTURE.md` → "How to add a construct" (the TypeScript-reading rule in step 1 applies to the design).
2. `docs/wp51-function-references.md` in full. It is the template for this note, in structure and in rigour: §1 the decision, §2 the rule and lowering, §3 dispatch measurements, §4 the escape proof through a dispatched call (cases A, B, C), §4.4 the safeguards, §6 the table of what leaned on "no function values", §9 stages, §10 risks, §12 the programs and the runner. WP54 reuses WP51's machinery (per-place sets, dispatchers as checked functions recorded in `nodeCallees`, the escape-join refusal NL2736, the wide-set warning NL9017, the debug-profile tag check). Find where each lives in `src/` (`src/fnref-places.ts` first) and say what extends and what is new.
3. `docs/LANGUAGE.md` → "Function references", "Classes" (no inheritance, `implements` as field-prefix widening), "Discriminated unions" (`A | B` as `%union.tagged`), the `<T extends Shape>` constraint rule (`tests/cases/gen_constraint`, `gen_constraint_method`), the value-representation table (`class C`, `interface I` → `%struct.C*`, "no header and no vtable"), and "Memory model".
4. `docs/wp25-inheritance.md` §2 and its "Dynamic dispatch" bullet (Rust-style `dyn` opt-in on interfaces), `docs/wp28-compatibility-mode.md` §7.4 (what an opaque callee costs: 1.26x to 1.40x for the call, 8.76x for the lost escape proof) and its C7 row, `docs/wp6-memory.md`, `docs/wp46-long-running-memory.md`, `docs/wp48-compressed-references.md`.
5. `.claude/testing.md` → "The performance gate" and "A `Measured:` trailer"; `tests/nish-cmp.js`'s header.
6. `docs/roadmap/index.md` → "Picking up a work package". Before starting, search open PRs and issues for "dyn", "trait object", "dynamic dispatch" and "WP54"; if the number is taken, use the next free one and say so.

## What the construct is

Today an interface describes layout only (`Interface ... cannot declare methods`), every method call names one symbol, and the workaround is an enum tag plus a central `switch`, or a table of WP51 function references taking an explicit context. The motivating program is a registry: about 13 implementations × N hooks (emitters, per-target hooks, visitors), where the boilerplate grows as the product. Write that program three ways in the note (hand `switch`, WP51 reference table, the proposed construct) and use it as the running example.

The proposal to evaluate: an interface may declare method signatures; a value of an explicitly opted-in dynamic interface type holds any class that `implements` it; a method call through it dispatches over the classes that can reach that place. Lower it as WP51 does, a per-place `switch` of direct calls, never a function pointer.

## Decisions the note must make, each with the alternatives and why they lost

1. **The spelling and its TypeScript reading.** TypeScript has no `dyn`, and the construct must run under Node unchanged or name its `--emit-ts` translation (A/B/C class, `docs/wp33-round-trip.md` §2). The opt-in must be explicit at the use site so no existing interface-typed program changes meaning or IR: candidates include a type-only marker from a `nish:` module (`Dyn<Shape>`), or a rule keyed on the interface declaring methods. Decide; show what each costs a reader and the checker.
2. **Static and dynamic stay separate.** `<T extends Shape>` with a method-bearing interface should monomorphise exactly as it does for a class constraint today (zero dispatch). Only the opt-in type dispatches. Say so in the rule and prove it with IR.
3. **Representation.** Objects have no header and must not gain one: a header on every object is a memory regression for every program. So the value is a fat reference, `{ i32 tag, ptr }` or equivalent. State its size, alignment and padding in a field, an array element and a `Map` value; compare against the hand program's `kind: i32` field plus object reference, and against a discriminated union `A | B` whose variants carry their own tag. Check its interaction with compressed references (WP48), `| null` (null encoding), `===` (object identity, not tag-and-pointer equality unless they coincide), and `Map` keys.
4. **The set and the dispatcher.** Per-place sets as in WP51 §2.3, with one dispatcher per (place set, method). A set of one is a direct call with no `switch` and must produce IR identical to calling the method on the concrete class. Say what a `dyn` value's conversion from a concrete class records, and how a set is known in time for ranges, attributes and region rules (WP51 §2.4).
5. **The escape proof.** Converting a stack-provable object into a dynamic value is a flow into that place. The escape-join refusal applies per method: a call whose set mixes members that keep `this` or an argument with members that do not is refused, naming the store that widened it. `this` counts as an argument.
6. **Boundaries.** Refuse the type in any host-visible signature (as NL2733 does for references), in FFI, and wherever a `Result` arm would hold it unless a place exists. Decide threads: what makes a dynamic value sendable to `spawn` and `parallelMap`.
7. **Diagnostics.** New codes in `src/codes.ts`'s bands, each with its exact wording; a wide-set `performance` warning past eight members, as NL9017.

## Non-regression: the invariants, and what proves each

State each as a numbered invariant in §1 and name the test or measurement that holds it. A stage cannot land until its invariant's check exists.

- **I1. Zero cost unused.** A program that does not use the construct compiles to byte-identical IR and sidecars. Proof: `node tests/nish-cmp.js` over the whole corpus with zero `DECLARED` entries, in every implementation stage. Any IR move is a bug, not a declaration.
- **I2. Never slower than the hand program.** No program using the construct is slower than the same program with an `i32` tag per place and a hand `switch` over every class stored into the same declaration or element type. Proof: the dispatch spike below, plus a corpus case whose IR is diffed against the hand version.
- **I3. The escape proof survives.** Where every member of a set keeps the object local, it stays an `alloca` and LLVM deletes it. Proof: WP51-style cases A (all local), B (mixed: must be refused at compile time), C (the escaping member is in the program but not in the hot set: the hot call keeps the `alloca`), with `--explain-memory` goldens (`tests/cases/*.memory`) for A and C.
- **I4. No memory growth.** Peak RSS is flat at 1x, 10x and 100x the loop length, and valgrind reports 0 bytes lost, for every variant that compiles. Proof: the runner records peak RSS per run (`bench/rss.c` is already built by `tests/run.js`).
- **I5. No layout surprise.** A field or element of the dynamic type is no larger than the hand program's tag plus reference; padding reported by the existing layout warning is the same or better.
- **I6. Compiler cost.** Self-host build time and `build/nish` size do not move (under the rolling freeze `src/` cannot use the construct). On a dyn-heavy program, compile time and object size are measured against the hand version; dispatcher count is reported per set.
- **I7. Safety.** A tag cannot be forged: it is only made by converting a class that implements the interface, and the `default` arm is a member of the set, so a speed build without a check still cannot reach outside it. `--profile debug` checks the tag and panics outside the set.

## The spike: measure before deciding

Write the programs by hand in today's Nish plus hand-edited `.ll` where the construct does not exist yet (WP51 §12.3 shows the method). Each loop's input changes every iteration and its output folds into a printed checksum that must be identical across variants. Best of N (N ≥ 7), variants interleaved and rotated each round, on one machine, stated in the note. The noise band is the baseline timed against a byte-identical copy of itself in the same rounds; read every ratio against it, and say "not shown" inside it.

1. **Dispatch.** direct call; hand `switch` on a `kind` field; discriminated union `A | B` with a `switch`; WP51 reference table; the proposed lowering; a true vtable (function pointer loaded from a static table, hand-edited IR) as the rejected alternative. K = 1, 2, 4, 8, 13, 16. Streams: monomorphic, periodic mixed, aperiodic. Serial and array shapes. Show the `.ll` and the `objdump -d` of the hot loop for K = 4 and K = 13.
2. **Escape.** Cases A, B, C above, with time and peak RSS at three loop lengths.
3. **Layout.** `sizeof` of a struct holding one and two dynamic fields, and an array of 1M dynamic values, against the hand program.
4. **The registry.** The 13 × N program in all three forms: time per hook call, binary size, compile time.

If the measurements show the tag-and-switch lowering loses to the vtable anywhere beyond the band, say where, and whether a per-place choice between the two would be worth it. If the construct cannot meet I1 to I5, the recommendation is to decline, and the note says so.

## What to write

- `docs/wp54-dyn-dispatch.md`: sections mirroring WP51 (decision, rule, lowering with the exact IR for every snippet, measurements, escape proof, semantics including Node/`--emit-ts`, `-g`/DWARF and the C ABI, what leaned on "interfaces describe layout only" and "every method call names one symbol" as a table found by grepping `src/`, `std/`, `docs/`, `.claude/` and `CLAUDE.md`, not measured, recommendation, stages, risks, open questions, appendix with every program and the runner).
- Stages, one PR each, each landing green alone: (1) interface method signatures plus static use through `<T extends I>`, with zero IR movement; (2) the dynamic type in locals, parameters and returns, calls, per-place sets, the escape-join refusal and the debug tag check; (3) fields, arrays, `Map` values and `| null`; (4) `--emit-ts`, `std/` adoption if any, and the guide page. Each stage names its tests: a golden `.ll`, an `llvm-as` pass, a native round trip with expected stdout, at least one negative per refusal, its `docs/LANGUAGE.md` rule, cookbook entry and `docs/guide/` page, plus the invariant checks above.
- `docs/roadmap/wp54-dyn-dispatch.md` in the format of `docs/roadmap/wp51-function-references.md`, its row in `docs/roadmap/index.md`, and the README's "Not in the language yet" sentence pointing at it. Grep every place that says dynamic dispatch has no work package and update it in the same PR.

## Done means

- `npm run check` and `npm run lint` pass, run bare and read by exit status.
- The PR is docs-only: no `src/` change, so nish-cmp, goldens and the `wasi`/`performance` runs are not required; say that in the PR body. If anything under `src/`, `std/` or `tests/` changes, the full definition of done in `CLAUDE.md` applies.
- Every figure in the note was measured in this session, with its band, and the appendix holds what reproduces it.
- Commit as `docs(checker): design and measure dynamic dispatch over interfaces (WP54)`, with a body that states the recommendation and the headline figures, then open the PR, watch CI and fix what is red. Do not merge until no human holds an open thread.
