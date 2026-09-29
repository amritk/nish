---
name: WP33 R2 — the typed-array names refuse push and pop
overview: Refuse push and pop on a receiver whose type is spelled Int32Array, Float32Array, Float64Array or BigInt64Array, with a coded diagnostic from NL2415–NL2419 that names the rewrite to the T[] spelling. The rule is compile-time only, so every program that still compiles keeps byte-identical IR, and it moves the wp33 §3.3 typed-array row from class C to class A.
stages:
  - id: checker
    title: "feat(checker)!: refuse push and pop on the typed-array names"
    goal: A typed-array-spelled receiver refuses push and pop with a coded diagnostic, T[] keeps both, sameType and every existing .ll golden are unchanged
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded, the wasi skip only) && node docs/check-links.mjs
    todos:
      - id: spelling-fact
        content: Carry the typed-array spelling to the push/pop check (a flag on Local in src/symbols.ts, set in src/statements.ts and at parameter binding in src/checker.ts and src/generics.ts), without touching TypeTable identity — see The rule
        status: pending
      - id: refuse
        content: Refuse push and pop in checkArrayMethod in src/arrays.ts for a spelled receiver with a new NL2415 code registered in src/codes.ts — see The rule
        status: pending
      - id: tests
        content: Add tests/cases/reject_typed_push_* and reject_typed_pop_* per name, plus a positive twin showing f64[] push/pop and the T[] flow case unchanged — see Tests
        status: pending
      - id: docs
        content: Write the LANGUAGE.md rule, the IR_COOKBOOK.md entry, the wp33 §3.3 row (class A) and §9 R2 (built), the RUN_UNDER_NODE.md typed-array line and the AI.md typed-array row — see Docs
        status: pending
      - id: goldens
        content: Regenerate tests/self/goldens with node tests/self/goldens.js --update after npm run build, never by hand — see Verification
        status: pending
---

## Context

`Int32Array`, `Float32Array`, `Float64Array`, `BigInt64Array` resolve to the same `TypeTable` id as `i32[]`, `f32[]`, `f64[]`, `i64[]` ([src/annotations.ts](../../src/annotations.ts) `typedArrayElement`), so by the time [src/arrays.ts](../../src/arrays.ts) `checkArrayMethod` sees `t.push(v)` the spelling is gone. Today `push`/`pop` are accepted on all four, which is a `TypeError` in TypeScript ([docs/wp33-round-trip.md](../../docs/wp33-round-trip.md) §3.3, row "Float64Array and the other three typed-array names"). The owner decided Q4(b) on 2026-09-28: refuse `push`/`pop` on the four names. No `src/`, `std/`, `bench/` or `examples/` source calls `push`/`pop` on a typed-array-spelled binding today (grepped on `main` at 3b97223), so the bootstrap is unaffected.

## The rule

A call `r.push(v)` or `r.pop()` is refused when the receiver `r` is **spelled** with one of the four names. The spelling is a fact about the program text, never a type:

- an identifier whose binding (a `let`/`const`, a parameter) was declared with a typed-array annotation, or — unannotated — was initialised by `new Float64Array(n)` and friends (TypeScript infers `Float64Array` there, so that is the same spelling);
- anything else the worker can cover cheaply and the rule can state crisply (a field declared `Float64Array`, a call whose declared return type is one, `new Float64Array(n).push(...)` itself). Whatever is covered, LANGUAGE.md states exactly which receivers carry the spelling; nothing is covered silently.

A value that flows into a binding spelled `T[]` (`const a: f64[] = t`, or a `Float64Array` passed to a parameter `xs: f64[]`) **may** be pushed there: the refusal follows the spelling the program wrote, `sameType` still holds, and TypeScript itself refuses the assignment `number[] = Float64Array`, so no program `tsc` accepts reaches that push. LANGUAGE.md says so.

`sameType`, `TypeTable` ids, the side tables and the emitter do not change: a program that does not call `push`/`pop` on a spelled receiver compiles to byte-identical IR, and no `.ll` golden moves.

Diagnostic: the next free code in NL2415–NL2419 (NL2415 for the rule; one code covers both methods), with a message that names the rewrite, e.g. ``` `push` is not a method of `Float64Array`; declare the binding `f64[]` to grow it ```. The worker checks `src/codes.ts` on `main` again before each push.

## Tests

- `tests/cases/reject_typed_push_{i32,f32,f64,i64}` and `reject_typed_pop_{i32,f32,f64,i64}` (or one case per name covering both methods if the harness allows several diagnostics per case), each with its `.err`.
- A reject case for the unannotated `new Float64Array(n)` binding and for a parameter spelled `Float64Array`.
- A positive twin (e.g. `tests/cases/arr_typed_push_pop.ts`): `f64[]` push/pop unchanged, and a `Float64Array` value pushed through an `f64[]` binding, with a golden `.ll`, an `llvm-as` pass and a native round trip with expected stdout. The PR body shows its exact LLVM IR.
- No existing `.ll` golden moves; `tests/cases/arr_typed_views` still passes untouched.

## Docs

- `docs/LANGUAGE.md`: the typed-array row (line ~169) and the typed-array section (~4610) gain the rule, the receivers that carry the spelling, and why a value flowing into `T[]` may be pushed.
- `docs/IR_COOKBOOK.md`: the cookbook entry (the rule is compile-time only; the IR of the positive twin).
- `docs/wp33-round-trip.md`: §3.3's row moved to class A with the resolution, and §9 R2 marked built.
- `docs/RUN_UNDER_NODE.md` (~137): the typed-array bullet rewritten, since the divergence is closed.
- `docs/AI.md` typed-array row (~188): "no `push`/`pop`".

## Out of scope

`src/lexer.ts`, `src/parser.ts`, `src/validator.ts` (lane 1), `src/portability.ts` (lane 4; its comment already says R2 closes this), builtin tables and `runtime/` (lane 2), `std/crypto/**` (lane 3). Any other array method (`set`, `fill`, `indexOf`, `join`, `length`) is unchanged. No `CHANGELOG.md` edit: it is generated from the commit.

## Verification

`npm run check`, `npm run lint`, `npm run lint:dead`, `node docs/check-links.mjs`, and `npm test` with no `DEGRADED:` line and only the `wasi` skip. After a merge of `main`: `npm run build`, `node tests/self/goldens.js --update`, `npm run check`, `node tests/run.js self`, `node tests/run.js typed`.
