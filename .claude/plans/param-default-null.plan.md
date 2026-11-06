---
name: null as the default of a nullable parameter
overview: Let a parameter whose declared type is a union with `null` take `null` as its default, filled in at the call site like every other default, so an options argument can be left out (`fetch(url)` is `fetch(url, null)`) without bringing `undefined` into the language.
stages:
  - id: null-default
    title: "feat(checker): allow null as the default of a nullable parameter"
    goal: Accept `x: T | null = null` on functions, methods and constructors, in one module and across modules, with a call that omits the argument passing a typed null pointer and every existing program's IR unchanged
    verification: npm run check && npm run lint && node tests/run.js param_default && node tests/run.js reject_param && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance
    status: pending
    todos:
      - id: decision-d7
        content: Add D7 to docs/wp49-async-server.md §9, and update §2's handler sketch and §8 if the fetch signature they show changes
        status: pending
      - id: checker-null-default
        content: In collectParamForm (src/declarations.ts) accept a `null` literal default when the declared type is a union with `null`; keep refusing it on a non-nullable type, on a type parameter, and every other non-constant default; widen the message and its src/codes.ts entry
        status: pending
      - id: emit-null-default
        content: Make the emitter that fills `sig.defaults` at a call pass a typed null pointer for an omitted nullable argument, for calls to functions, methods and constructors, local and imported
        status: pending
      - id: tests-positive
        content: tests/cases/param_default_null.{ts,ll,out} covering a class, an array and a `string | null` parameter called with and without the argument, including a method and a constructor; register with node tests/differential/goldens.js --update
        status: pending
      - id: tests-link
        content: A cross-module case in tests/link/param_modules (or a new link test) calling an imported function with a null default with and without the argument
        status: pending
      - id: tests-negative
        content: reject_param_default_null_not_nullable (`x: Point = null`), reject_param_default_object (`x: Point | null = new Point()`), reject_param_default_null_generic, each with its .err
        status: pending
      - id: goldens
        content: Regenerate tests/self/goldens/checked/ with node tests/self/goldens.js --update and read the diff
        status: pending
      - id: docs
        content: docs/LANGUAGE.md rule, docs/guide/language/functions.md, docs/AI.md optional-parameter rows, a docs/IR_COOKBOOK.md entry; node scripts/gen-diagnostic-codes.mjs --check (regenerate if a message changed)
        status: pending
      - id: no-cost-proof
        content: Diff the .ll of every existing tests/cases program against main's and state "0 of N differ" in the PR body; paste the exact IR of each new .ts test in the PR body
        status: pending
---

# null as the default of a nullable parameter

Source: the handoff "`null` as the default of a nullable parameter" (one PR,
from `main` at `89dad841` or later). Read `CLAUDE.md`,
`.claude/orientation.md`, `.claude/selfhost.md` and `docs/ARCHITECTURE.md` →
"How to add a construct" first.

## Why

An API takes an optional options object the way Node's does:

```ts
export const fetch = async (url: string, init: FetchInit | null = null): Promise<Response | null> => { ... }

fetch(url)        // compiled as fetch(url, null)
fetch(url, init)
```

This is for async `fetch` (WP49 stage 5) and every other options argument
(`fetchSync`, `serve`). Optional parameters (`x?: T`) stay refused: they would
bring `undefined` into the body. Defaults are filled in at the call site and
cost nothing.

## Stage 1: null-default

**Owns:** `src/**`, `tests/cases/param_default_null.*`, `tests/cases/reject_param_default_null_*`, `tests/cases/reject_param_default_object.*`, `tests/link/param_modules/**`, `tests/link/param_default_null*/**`, `tests/self/goldens/**`, `tests/differential/**`, `docs/**`

### The rule

`docs/LANGUAGE.md` → "Default and rest parameters" gains one case:

- **`null` is a default for a parameter whose declared type is a union with
  `null`** (`T | null`, for any `T` a parameter may have: a class, an
  interface, an array, `string`, ...).
- Filled in at the call site like every other default. The callee is compiled
  as if the argument were always passed, so a call that passes every argument
  compiles to the same IR as before.
- Still refused: `null` on a parameter whose type does not include `null`; any
  other non-constant default (`= new FetchInit()`, `= {}`, `= []`), which
  would allocate per call; `null` on a type parameter
  (`reject_param_default_generic` holds).

### Where to look

| What | Where |
| --- | --- |
| The default check and the message to widen | `src/declarations.ts` `collectParamForm` (`sig.defaults`, the `notLiteral` message) |
| The diagnostic text registry | `src/codes.ts:184` |
| Filling defaults at a call | follow `sig.defaults` / `FunctionSig.defaultAt` (`src/program.ts:190`) into the emitter |
| Existing positive case | `tests/cases/param_default.{ts,ll,out}`, `tests/link/param_modules` |
| Existing negatives | `tests/cases/reject_param_default_*` (mirror `_parameter_type` and `_expression`) |

### Constraints

- **Rolling freeze:** `src/` must not *use* a `null` default until a release
  ships it. CI's `bootstrap` job checks this.
- Independent of the async lowering PR. Do not touch async code.
- Commit subject `feat(checker): allow null as the default of a nullable
  parameter`, body saying why (Node-shaped options arguments without
  `undefined`), with `Tests:` / `Refs:` trailers.
- The PR body states "0 of N differ" for the existing `tests/cases` `.ll`
  against `main`, and pastes the exact LLVM IR of each new `.ts` test.

## Acceptance criteria

1. A program declaring `f(p: Point | null = null)` compiles with `build/nish`, links, and prints the same stdout natively as under Node; `f()` behaves as `f(null)`.
2. The same holds for a class, an array and a `string | null` parameter, on a function, a method and a constructor, and for a call into another module.
3. `x: Point = null`, `x: Point | null = new Point()` and a `null` default on a type-parameter-typed parameter are each refused with a diagnostic naming the rule.
4. Every existing `tests/cases` program compiles to byte-identical `.ll` as on `main` (0 of N differ).
5. `docs/LANGUAGE.md`, `docs/guide/language/functions.md`, `docs/AI.md` and the cookbook describe the rule, and `docs/wp49-async-server.md` §9 records D7.
6. CI is green on the merged head, including the `bootstrap` job (no `src/` use of a `null` default).
