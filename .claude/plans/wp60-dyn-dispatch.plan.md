---
name: WP60 — dynamic dispatch over interfaces, designed and measured (docs only)
overview: Design and measure dynamic dispatch over interfaces lowered as a closed-world per-place tag-and-switch (never a vtable, never an object header), reusing WP51's per-place sets, dispatchers, escape-join refusal and debug tag check. One PR writes the design note with every figure measured in-session, the roadmap page and its pointers, and changes nothing under src/, std/ or tests/. The brief asked for WP54, but WP54 is taken by open PR 1528 and WP59 by open PR 1577, so this is WP60.
stages:
  - id: s0-design-and-measure
    title: docs(checker) — design and measure dynamic dispatch over interfaces (WP60)
    goal: docs/wp60-dyn-dispatch.md makes the seven decisions with their losing alternatives, states invariants I1 to I7 each with its check, holds the dispatch, escape, layout and registry measurements with their noise band and an appendix that reproduces them, and the roadmap page, index row and every no-dynamic-dispatch pointer are updated in the same PR.
    verification: npm run check && npm run lint && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && test -z "$(git diff --name-only origin/main... -- src std tests runtime)"
    todos:
      - id: read-and-anchor
        content: Read the brief's reading list in order and record file and function anchors in src/ for every WP51 mechanism reused (src/fnref-places.ts first, nodeCallees dispatchers, NL2736, NL9017, NL2733, the debug-profile tag check) and for the interface rules being relaxed — see Reading and anchors
        status: pending
      - id: spike-dispatch
        content: Build and run the dispatch spike — six variants, K in 1 2 4 8 13 16, three streams, serial and array shapes, best of at least 7 interleaved and rotated, noise band from a byte-identical baseline copy, identical checksums, .ll and objdump of the hot loop at K 4 and 13 — see Spike
        status: pending
      - id: spike-escape-layout-registry
        content: Build and run the escape cases A B C (time, peak RSS at three loop lengths, valgrind), the layout sizeof checks (one and two dyn fields, 1M-element array, Map value, null encoding, WP48 compressed refs) and the 13-by-N registry in three forms (time per hook call, binary size, compile time) — see Spike
        status: pending
      - id: design-note
        content: Write docs/wp60-dyn-dispatch.md in WP51's section structure with exact IR for every snippet, the seven decisions, I1 to I7, the leaned-on table from grepping src std docs .claude CLAUDE.md, recommendation, four stages with named tests, risks, open questions and the appendix — see Design note
        status: pending
      - id: roadmap-and-pointers
        content: Write docs/roadmap/wp60-dyn-dispatch.md in WP51's roadmap format, add its row to docs/roadmap/index.md, its route in scalar.config.json and rows in docs/README.md and docs/MASTER_PLAN.md if WP57 shows they take one, and repoint every sentence that says dynamic dispatch has no work package (README.md Project status, docs/wp25-inheritance.md, docs/roadmap/wp25-inheritance.md, and what the grep finds) — see Roadmap and pointers
        status: pending
      - id: open-pr
        content: Commit with the brief's subject using WP60, a body stating the recommendation and headline figures and a Measured trailer with the band, open the PR saying it is docs-only so nish-cmp, goldens, wasi and performance runs are not required — see Shipping
        status: pending
---

# WP60 — dynamic dispatch over interfaces (design and measurement, docs only)

## Context

Today an interface describes layout only (`Interface ... cannot declare methods`), every method call names one symbol, and the workaround for a registry of ~13 implementations × N hooks is an enum tag plus a central `switch`, or a WP51 function-reference table with an explicit context. The brief (verbatim in the tracking issue) proposes method signatures on interfaces, an explicit opt-in dynamic interface type, and dispatch lowered as WP51 lowers references: a per-place `switch` of direct calls, never a function pointer, never an object header.

**Number.** The brief says WP54. Open PR #1528 holds WP54 (async on wasm) and open PR #1577 holds WP59, so this is **WP60**. The note says so in its first paragraph, and every file name, heading and the commit subject use WP60.

The hard requirement: no program gets slower or larger because this exists, and a program that adopts it is never slower or larger than the same program written by hand. Every such claim is a measurement or a test.

## Reading and anchors

The reading list is the brief's, in its order: `CLAUDE.md`, `.claude/orientation.md`, `.claude/architecture.md`, `docs/ARCHITECTURE.md` → "How to add a construct"; [`docs/wp51-function-references.md`](../../docs/wp51-function-references.md) in full (the template, §1–§12); `docs/LANGUAGE.md` → Function references, Classes, Discriminated unions, the `<T extends Shape>` rule (`tests/cases/gen_constraint`, `gen_constraint_method`), the value-representation table, Memory model; `docs/wp25-inheritance.md` §2 and its "Dynamic dispatch" bullet, `docs/wp28-compatibility-mode.md` §7.4 and C7, `docs/wp6-memory.md`, `docs/wp46-long-running-memory.md`, `docs/wp48-compressed-references.md`; `.claude/testing.md` → "The performance gate" and "A `Measured:` trailer"; `tests/nish-cmp.js`'s header.

For each WP51 mechanism, the note says where it lives in `src/` (file and function) and whether WP60 **extends** it or adds something **new**.

## Spike

Hand-written programs in today's Nish, plus hand-edited `.ll` where the construct does not exist yet (WP51 §12.3's method). Each loop's input changes every iteration, its output folds into a printed checksum that must be identical across variants. Best of N ≥ 7, variants interleaved and rotated each round, one machine (named in the note: CPU, cores, LLVM version, `nproc`). Noise band = the baseline timed against a byte-identical copy of itself in the same rounds; every ratio is read against it, and a ratio inside it is written "not shown".

1. **Dispatch.** direct call · hand `switch` on a `kind` field · discriminated union `A | B` + `switch` · WP51 reference table · proposed lowering (hand-edited IR) · true vtable (function pointer from a static table, hand-edited IR, the rejected alternative). K = 1, 2, 4, 8, 13, 16. Streams: monomorphic, periodic mixed, aperiodic. Serial and array shapes. `.ll` and `objdump -d` of the hot loop at K = 4 and K = 13.
2. **Escape.** Cases A (all local), B (mixed: must be refused), C (escaping member present but not in the hot set: hot call keeps its `alloca`), with time and peak RSS (`bench/rss.c`, built by `tests/run.js`) at 1×, 10×, 100× loop length, and valgrind 0 bytes lost for every variant that compiles.
3. **Layout.** `sizeof` of a struct with one and two dynamic fields, an array of 1M dynamic values, a `Map` value, against the hand program's `kind: i32` + reference and against `A | B`; interaction with WP48 compressed references, `| null`, `===` and `Map` keys.
4. **Registry.** 13 × N in three forms (hand `switch`, WP51 table, proposed construct): time per hook call, binary size, compile time, dispatcher count per set.

If tag-and-switch loses to the vtable anywhere beyond the band, the note says where and whether a per-place choice would be worth it. If I1–I5 cannot be met, the recommendation is to decline and the note says so.

Spike sources and the runner live **only in the note's appendix** (as in WP51 §12), and scratch builds go under `$TMPDIR`, so the PR stays docs-only.

## Design note

`docs/wp60-dyn-dispatch.md`, mirroring WP51: §1 decision (with invariants I1–I7, each naming its test or measurement, from the brief), §2 rule and lowering with exact IR for every snippet, §3 measurements, §4 escape proof (A/B/C, safeguards), §5 semantics (Node and `--emit-ts` A/B/C class per `docs/wp33-round-trip.md` §2, `-g`/DWARF, the C ABI), §6 what leaned on "interfaces describe layout only" and "every method call names one symbol" (table found by grepping `src/`, `std/`, `docs/`, `.claude/`, `CLAUDE.md`), §7 not measured, §8 recommendation, §9 stages, §10 risks, §11 open, §12 appendix (every program and the runner).

The seven decisions, each with the alternatives and why they lost: (1) spelling and its TypeScript reading (e.g. `Dyn<Shape>` from a `nish:` module vs a rule keyed on the interface declaring methods); (2) static `<T extends I>` monomorphises with zero dispatch, proved with IR; (3) representation as a fat reference, size/alignment/padding in field, array element, `Map` value, vs hand `kind`+ref and `A | B`, plus WP48, `| null`, `===`, `Map` keys; (4) per-place sets and one dispatcher per (set, method), a set of one is IR-identical to the direct call, and when the set is known relative to ranges, attributes and region rules (WP51 §2.4); (5) escape-join refusal per method, `this` counts as an argument, naming the widening store; (6) boundaries: host-visible signatures, FFI, `Result` arms, `spawn` / `parallelMap` sendability; (7) diagnostics: new codes in `src/codes.ts`'s bands with exact wording, wide-set `performance` warning past eight members as NL9017.

The running example is the registry, written three ways.

Stages in §9, one PR each, each landing green alone: (1) interface method signatures plus static use through `<T extends I>` with zero IR movement; (2) the dynamic type in locals, parameters, returns, calls, per-place sets, escape-join refusal, debug tag check; (3) fields, arrays, `Map` values and `| null`; (4) `--emit-ts`, `std/` adoption if any, guide page. Each names its golden `.ll`, `llvm-as` pass, native round trip, negatives per refusal, `docs/LANGUAGE.md` rule, cookbook entry, guide page, and the invariant checks it must add before it lands.

## Roadmap and pointers

- `docs/roadmap/wp60-dyn-dispatch.md` in the format of [`docs/roadmap/wp51-function-references.md`](../../docs/roadmap/wp51-function-references.md): first box (designed and measured) ticked, four stage boxes unticked.
- Row in [`docs/roadmap/index.md`](../../docs/roadmap/index.md) under "In progress and proposed"; route in `scalar.config.json`; rows in `docs/README.md` and `docs/MASTER_PLAN.md` where WP57's PR added them.
- [`README.md`](../../README.md) "Project status" sentence ("There is no dynamic dispatch …") points at the roadmap page.
- Every other place that says dynamic dispatch has no work package, found by grep: at least `docs/wp25-inheritance.md` (the "Dynamic dispatch" bullet), `docs/roadmap/wp25-inheritance.md`, and whatever the grep turns up in `docs/` and `.claude/`. `docs/guide/` names no work package (`docs/README.md`).
- If `docs/LANGUAGE.md` is touched, regenerate `docs/reference/` with `node scripts/gen-reference.mjs`.

**Owns:** `docs/wp60-dyn-dispatch.md`, `docs/roadmap/wp60-dyn-dispatch.md`, `docs/roadmap/index.md`, `docs/roadmap/wp25-inheritance.md`, `docs/wp25-inheritance.md`, `docs/wp0-validator.md`, `docs/FAQ.md`, `docs/LANGUAGE.md`, `docs/reference/**`, `docs/README.md`, `docs/MASTER_PLAN.md`, `docs/ARCHITECTURE.md`, `README.md`, `scalar.config.json`

`.claude/` holds no no-dynamic-dispatch sentence (grepped at plan time) and is in CODEOWNERS, so it is not owned: a diff into it is out of scope.

## Shipping

Commit subject: `docs(checker): design and measure dynamic dispatch over interfaces (WP60)`. Body: the recommendation and the headline figures; `Measured:` trailer with the band (`.claude/testing.md`). PR body says the PR is docs-only (no `src/`, `std/`, `tests/` change), so nish-cmp, goldens and the `wasi`/`performance` runs are not required. Do not merge while a human holds an open thread.

## Out of scope

Any change under `src/`, `std/`, `tests/`, `runtime/`, `bench/`. Implementing any stage. The guide page (stage 4's). Inheritance (WP25).

## Verification

`npm run check`, `npm run lint`, `node docs/check-links.mjs`, `node scripts/gen-reference.mjs --check`, all read by exit status; and `git diff --name-only origin/main... -- src std tests runtime` is empty. No coverage command applies: the stage changes no code.
