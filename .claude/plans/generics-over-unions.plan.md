---
name: Generics over discriminated unions (lift NL2533)
overview: Let a discriminated union be a generic's type argument — Box<Shape>, Stack<Shape>, Result<Shape, E>, Result<T, Shape>, and a generic call whose T binds to a union — so a fallible function returning an IR node needs no hand-written wrapper class. Generics are monomorphised and every union is one %union.tagged* pointer, so the feature must add no runtime or compile-time cost; the run proves that with measurements, and shows the gain over the wrapper-class idiom it replaces.
stages:
  - id: s1-generics-over-unions
    title: "feat(checker): let a discriminated union be a generic's type argument"
    goal: Every generic class, interface, function, method and Result over a discriminated union compiles and runs natively with correct output, variants convert to the union arm at every generic payload site, the out-of-scope refusals keep their codes, NL2533 is retired by the codes.ts rules, docs move with it, and no corpus program, compile time or memory figure gets worse.
    verification: npm run check && npm run lint && node tests/run.js union && node tests/run.js generic && node tests/run.js result && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js && node scripts/gen-reference.mjs --check
    todos:
      - id: audit
        content: Run the ten-item audit from the brief (checker/narrowing, constraints, ===, typed JSON, nish:secret, interop header/N-API/dts, ranges/escape/arena/TBAA under -O2, emit-ts, wasm and -g, std/ generics such as Map getOrInsert/reserve), each settled by a test that either passes or pins a clear refusal — see S1 audit
        status: pending
      - id: gates
        content: Remove the three NL2533 gates (src/annotations.ts Result resolver, src/generics.ts instance and call gates) and the dead helpers unionArgumentMessage, holdsAnyUnion, unionCheckedArguments; retire NL2533 in src/codes.ts and tests/wordings per the append-only rule — see S1 implementation
        status: pending
      - id: conversion
        content: Make Ok(...)/Err(...) in src/result.ts and every other generic payload site (constructor/method param of type T, array literal under T[], ?? and ternary arms) convert a variant or narrower union to the expected union by reusing the checker's existing return/argument conversion — no second conversion — see S1 implementation
        status: pending
      - id: tests
        content: Add positive tests/cases union_generic_class, union_generic_call, union_result and the Map helpers (golden .ll, llvm-as, native .out), registered with node tests/differential/goldens.js --update; convert or delete the seven reject_union_* cases the brief names; keep reject_union_map_key, reject_union_set, reject_union_generic_variant; add negatives for what the audit still refuses and for NL2534 through a generic field — see S1 tests
        status: pending
      - id: perf-proof
        content: Measure no regression and the gain, interleaved base vs head with a byte-identical-base noise band — nish-cmp shows no IR drift, compiler self-compile time and peak RSS stay inside the band, and a Result<Shape, E> program vs the same program with a hand-written wrapper class shows equal-or-fewer allocations, peak RSS and time; record it as a Measured trailer and in docs/BENCHMARKS.md — see S1 performance and memory
        status: pending
      - id: docs
        content: Update docs/LANGUAGE.md "Discriminated unions", docs/guide/language/unions.md and errors.md (a Result<Shape, E> example), docs/AI.md refused-by-design list, docs/IR_COOKBOOK.md, add docs/roadmap/wp54-generics-over-unions.md (confirm the number is free) with its index row ticked, regenerate docs/reference and tests/self/goldens/checked, and fix every NL2533 pointer — see S1 docs
        status: pending
---

# Generics over discriminated unions

The requirements are the brief at the top of the tracking issue. In short:
today NL2533 refuses `Box<Shape>`, `Result<Shape, E>` and every generic whose
type parameter binds to a union. The motivating program is bane, whose IR is
almost all discriminated unions: every fallible function returning an IR node
needs a hand-written wrapper class. After this change
`(): Result<Schema, ParseError>` just works.

The user added a requirement on top of the brief: **no performance or memory
regressions, only gains.**

## Why one stage

The brief asks for one PR: the gates, the conversion fix, the tests, and the
docs whose `nish:err NL2533` blocks become working examples. The guide's code
blocks are compiled by the test suite, so the docs can't land apart from the
code. Splitting the conversion fix from the gate removal would only make the
second half wait on the first. That's a chain, so it stays one stage.

## S1 — generics over unions

**Owns:** `src/**`, `tests/cases/**`, `tests/wordings/**`, `tests/self/goldens/**`, `tests/differential/**`, `tests/nish-cmp.js`, `tests/run.js`, `docs/**`, `bench/**`, `scalar.config.json`, `std/**`

`std/**` is owned only for a doc or test change a `Map` helper needs. `std/`
should not need new code. `.claude/**`, `CLAUDE.md`, `AGENTS.md`,
`.github/**` and `package*.json` are code-owned and off limits. If an
NL2533 pointer turns up there, report it in the PR body and leave it.

### Audit

Before writing the conversion fix, settle each of the ten items in the brief
with a test (a passing case or a pinned refusal with a clear message). The
brief has the full list. Record each verdict in the PR body. Two things to
call out:

- **Constraints**: `<T extends HasKind>` bound to a union. Accept it if every
  variant satisfies the constraint and that is easy and sound. Otherwise
  refuse it with its own message and a negative test.
- **TBAA**: read the `-O2` IR of a program that writes through `b.value`
  narrowed to `Circle` and then reads it back through the union. A
  `%union.tagged*` instance field must not get a struct-path tag that wrongly
  aliases the variant's own fields.

### Implementation

1. Remove the gates and the dead helpers. NL2533 keeps its number, because
   codes are append-only. Retire it the way `src/codes.ts` and
   `tests/wordings/unreachable.txt` retire a code. Repurpose it only if the
   audit leaves a refusal that is genuinely "a union as this type argument".
2. Payload conversion reuses the checker's `return` / argument / `push`
   conversion. Test the variant forms explicitly:
   `new Box<Shape>(new Circle(2))`, `stack.push(new Circle(1))`, a variant in
   an array literal under `T[]`, `??` and ternary arms against `T = Shape`.
3. Rolling freeze: `src/` must not *use* the feature (CI's `bootstrap` job).

### Tests

Follow `.claude/testing.md`. The PR body shows the exact LLVM IR for every
TypeScript snippet the PR adds, and says, for each of the seven `reject_union_*`
cases the brief names, whether it was converted or deleted.

### Performance and memory

The requirement is **no regression anywhere, and a measured gain for the
pattern the feature replaces.** Measure base and head interleaved on the same
machine. Take the noise band from a byte-identical copy of the base
(`.claude/testing.md` → "A `Measured:` trailer").

1. **Corpus IR.** `node tests/nish-cmp.js` shows no IR drift. The feature only
   lifts a refusal, so no program that compiled before should emit different
   IR. Drift is a finding to explain or fix, never something to wave through
   with a `DECLARED` entry, unless it is a provable improvement. If so, declare
   it narrowly and justify it.
2. **Compiler cost.** `node tests/run.js performance` passes. The compiler's
   self-compile wall time and peak RSS stay inside the noise band. The gates
   being removed run on every generic instantiation, so this may come out a
   small gain.
3. **Runtime cost: zero.** The IR of a `Box<Shape>` instance must match a
   hand-written `ShapeBox` class field for field (one `%union.tagged*`). Show
   both in the PR body.
4. **The gain.** Write a `bench/` program that returns `Result<Shape, E>` from
   a hot fallible function. Compare it against the same program with today's
   idiom, `Result<ShapeWrapper, E>`, where `ShapeWrapper` is a class holding
   the union. Report allocations or bytes per call, peak RSS and wall time
   with their noise band. Record the figures in `docs/BENCHMARKS.md` and the
   commit's `Measured:` trailer. If the native form is not at least as good on
   every axis, that is a blocking finding to fix, not to report.

### Docs

Everything in the brief's Docs list, in this PR. Confirm WP54 is free (the
index skips from 53 to 55). If it is taken, use the next free number.

### Verification commands

Before pushing, run `npm run check` and `npm run lint` bare and read the exit
status. Run `node tests/run.js <filter>` for every touched section. Run
`WASI_SYSROOT=/usr node tests/run.js wasi` and read the skip line. Run
`node tests/run.js performance` and `node tests/nish-cmp.js`. The full suite
is CI's eight shards. Read each shard's skip count.
