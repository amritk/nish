---
name: Module-level constant arrays
overview: Accept a top-level const annotated readonly T[] (T numeric) whose initialiser is an array literal of constants, and lower it to a private constant data global plus a constant array header, so a lookup table costs one load and no start-up code. Implements amritk/nish#1628.
stages:
  - id: const-array
    title: "feat(checker): add module-level constant arrays of numeric literals"
    goal: A module may declare a read-only numeric lookup table at top level, lowered to constant globals, with the full construct checklist.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js const && node tests/run.js storage && node tests/run.js emit-ts && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/self/goldens.js && node scripts/gen-reference.mjs --check && bash docs/cookbook/regen.sh --check && node docs/check-links.mjs
    todos:
      - id: rule
        content: Write the rule and hand-checked IR first, then the docs/LANGUAGE.md Module constants rule — see Rule and lowering
      - id: checker
        content: Accept the declaration in the module-constant pass of src/checker.ts and fold each element with the existing constant folder — see Checker
      - id: emit
        content: Emit the two constant globals by reusing the module-storage lowering in src/emit-arrays.ts and src/compilation.ts — see Emitter
      - id: soundness
        content: Prove no write path reaches the constant global (readonly typing, interop, wasm-host export, escape and attributes) — see Soundness
      - id: bounds
        content: Make the prover discharge a u8 index into a 256-entry table, or record why not — see Bounds check
      - id: emit-ts
        content: Give the construct its --emit-ts reading and a tests/emit-ts fixture — see TypeScript reading
      - id: tests
        content: Add golden cases, negative cases, differential registration and regenerated goldens — see Tests
      - id: docs
        content: Add the IR_COOKBOOK entry and update docs/guide/language/arrays-and-strings.md — see Docs
      - id: measure
        content: Measure a char-class table against the if-chain it replaces and write the Measured trailer — see Measurement
---

## Context

[`src/checker.ts`](../../src/checker.ts) (the module-constant pass, around line 940) refuses every module constant whose type is not `i32`/`i64`/`f64`/`boolean`/`string`, with `` Module constant `X` must be a number, boolean, or string, not u8[]; there is no top-level code to build anything else `` (pinned by `tests/cases/reject_const_array`). A large Nish program, a C++ formatter, writes character-class `switch` chains or builds tables in a constructor and passes them through every call because of this.

[Module storage](../../docs/LANGUAGE.md#module-storage) already shows how to give a module an array with no top-level code. A top-level `new Array<T>(n)` becomes two globals: `<sym>.data`, a zero-filled `[N x T]`, and `<sym>`, a `%struct.nish_array { len, cap, data }` header over it. Every read is then the array indexing that already exists. A constant table is the same shape with known contents and no writes.

## Stage const-array

**Owns:** `src/**`, `tests/**`, `docs/**`, `bench/**`, `scalar.config.json`. One stage, one PR. It touches nothing under `std/`, `runtime/`, `.github/` or `.claude/`.

## Rule and lowering

```ts
const IDENT: readonly u8[] = [0, 0, 1, 1, 2]
export const classOf = (c: u8): u8 => IDENT[c]
```

```llvm
@nish_const_0_IDENT.data = private unnamed_addr constant [5 x i8] c"\00\00\01\01\02", align 16
@nish_const_0_IDENT = internal constant %struct.nish_array { i64 5, i64 5, i8* getelementptr ([5 x i8], [5 x i8]* @nish_const_0_IDENT.data, i32 0, i32 0) }, align 8
```

Decisions. The worker may revise a detail with a reason given in the PR body, but not the shape:

- **The annotation must be `readonly T[]`** (or `ReadonlyArray<T>`). With a plain `T[]`, the diagnostic says to write `readonly T[]`. This keeps the TypeScript reading identical (class A): under TS the same source is a readonly array too.
- **`T` is any fixed-width numeric type**, at least `u8`, `i32`, `i64` and `f64`. Strings, booleans, records and nested arrays stay refused, with the existing diagnostic reworded to name what is accepted.
- **Every element is a constant expression** under the existing initialiser rule (literals, other constants, folded arithmetic, `wrappingAdd`/`Sub`/`Mul`). Each element has the element type's width, and range and overflow follow the same folding rules as a scalar constant. An empty literal is refused.
- **Uses lower to a load of the header global**, so indexing, `.length`, `for … of`, and passing it to a `readonly T[]` parameter all reuse existing paths. The symbol naming follows `Compilation.nameStorage` under its own prefix (`nish_const_` or the storage prefix; pick one and document it).
- **Export.** A non-exported table has a `private` data global and an `internal` header. If an exported table is allowed, it follows module storage's export rule (`@<sym> = external constant` in the importer). Otherwise it is refused with a diagnostic. The PR says which and why.

## Checker

In the module-constant pass, before the type gate, recognise an annotation that resolves to a readonly array of a numeric element type paired with an `ArrayLiteral` initialiser. Fold each element with the folder scalar constants use, record the folded values on the `ConstInfo` (or a sibling record the emitter reads; the checker records, the emitter reads), and register the name so that uses resolve to the table. New diagnostics take the next free numbers in `src/codes.ts` (`node scripts/gen-diagnostic-codes.mjs --check`).

## Emitter

Reuse the module-storage path in [`src/emit-arrays.ts`](../../src/emit-arrays.ts) (around line 2137) and the symbol naming in [`src/compilation.ts`](../../src/compilation.ts) (around line 3552). The data global becomes `constant` with the folded initialiser instead of `zeroinitializer`. The header becomes `constant`. Use the existing numeric constant encoding (`numericConstant`, `src/emit-ops.ts`) for each element, and emit `u8` tables as a `c"…"` string.

## Soundness

A store into a `constant` global is undefined behaviour, so the PR shows each of these is refused or unreachable, with a negative test where one is reachable from source:

- index assignment, `push`/`pop`/`length` writes and every mutating builtin on the table (readonly typing should already refuse these, so pin it);
- passing or assigning the table where a mutable `T[]` is expected, including generic instantiation, an interface field, and a closure capture;
- the interop surfaces (C header, wasm `.d.ts`, N-API, `--profile wasm-host` exports): either the table never appears there, or it appears as `const`;
- `src/attributes.ts` and `src/escape.ts` do not mark anything that would let LLVM assume the header is writable or fresh.

## Bounds check

Indexing a table whose length `N` is a compile-time constant with an index whose type range is below `N` (a `u8` into a 256-entry table) should need no bounds check. If the prover in `src/` already knows module storage's length, extend it to tables. If not, add the fact so the golden shows one load and no branch. If that would grow the stage past one PR, keep the check, say so in the PR body, and add a line to amritk/nish#1633. A new index in `src/` that the prover cannot discharge is an NL9007 warning, and `node tests/run.js performance` fails on it.

## TypeScript reading

Class A: `const X: readonly u8[] = [...]` means the same under Node. Add a `tests/emit-ts/` fixture so `node tests/run.js emit-ts` runs it both ways, and check that `--emit-ts` writes it as a readonly array. Under the rolling freeze, `src/` may not use the new construct itself.

## Tests

Mirror `tests/cases/const_basic` and `tests/cases/storage_module`:

| case | pins |
| --- | --- |
| `const_array_u8` | 256-entry char-class table, golden `.ll` (constant globals, the load, no bounds branch if achieved), `.out` |
| `const_array_numeric` | `i32`, `i64`, `f64` tables, elements folded from other constants, `.length`, `for … of`, passed to a `readonly T[]` parameter |
| `reject_const_array` | updated: the reworded diagnostic for a non-numeric element type |
| `reject_const_array_mutable` | `T[]` annotation, which names `readonly T[]` |
| `reject_const_array_write` | `TAB[0] = 1` and `TAB.push(1)` |
| `reject_const_array_element` | a non-constant element, an out-of-range element (`256` in `u8`), an empty literal |
| `reject_const_array_alias` | the table passed where `T[]` is wanted |

Register the new positive cases with `node tests/differential/goldens.js --update` and regenerate `tests/self/goldens/checked/` with `node tests/self/goldens.js --update`. Every golden passes `llvm-as` (the `const` section does this). Show the exact IR for each test snippet in the PR body.

## Docs

- `docs/LANGUAGE.md` → Module constants: the new rule, the diagnostics, and the rewritten type bullet.
- `docs/IR_COOKBOOK.md`: an entry next to "Module storage: two globals a page can find", then `bash docs/cookbook/regen.sh --check`.
- `docs/guide/language/arrays-and-strings.md`: a "Lookup tables" section showing the shape a program writes and the diagnostic it gets for `T[]`. Use the existing page; no new route is needed.
- `node scripts/gen-reference.mjs` if LANGUAGE.md changes move `docs/reference/`.

## Measurement

Use a `bench/` program, or a `tests/run.js performance` entry if that is how the repo measures codegen, that classifies every byte of a buffer of several MB, once through a 256-entry `readonly u8[]` table and once through the equivalent `if`/`switch` chain. Measure interleaved on the same machine, with a byte-identical copy of the baseline for the noise band (`.claude/testing.md` → "A `Measured:` trailer"). The commit carries `Measured:` with both figures and the band.

## Out of scope

String, boolean, record or nested-array tables; mutable module-level arrays initialised from a literal; any change to module storage's own rule; the other items in amritk/nish#1633.

## Verification

The stage's `verification` command, plus CI's eight `test` shards, `bootstrap`, `nish-cmp` and `lint` green on the PR head.
