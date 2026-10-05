# WP0: Phase 0 validator

**Status: landed** before the first release (merged as `wp0/validator`,
9069ef3). The validator is now `src/validator.ts`; the table of what it
refuses, with each message and the case that pins it, is
[LANGUAGE.md: Forbidden constructs](LANGUAGE.md#forbidden-constructs-phase-0-validator),
which is normative. This note keeps the reasoning.

## What shipped

Phase 0 runs on the raw syntax tree straight after parsing and before the
checker, and reports the first construct Nish can never compile
(`file:line:col: error: <message>`). Every rule is decided from syntax alone:
no types, no scopes, no symbol resolution. The walk is one pre-order traversal
dispatched on the node kind; in stage0 it measured about 2 ms on a
1,000-line file, and `tests/run.js` asserted under 50 ms until that check went
with stage0's tests (#145). Nearly every rule has a
`tests/cases/reject_<construct>.ts` with the message fragment in its `.err`;
the LANGUAGE.md table names the case, and marks the three rows that have none
(`Function(...)`, and `Function` or `Proxy` as a value).

**Defence in depth, not the only guard.** The checker still rejects what it
does not understand, but it only looks where it has to. The validator sees
every node, so `any` buried in a type argument, `delete` in an unreachable
branch or `with` in a function nobody calls all fail regardless of later
phases. Constructs that are merely *not supported yet* are not its business
and pass through to the checker.

## Why each construct is forbidden

Every row of the LANGUAGE.md table breaks one of four guarantees from
`docs/MASTER_PLAN.md`:

- **Layout**: every value has one fixed, known memory layout. This rules out
  `any`, `unknown`, `undefined`, unions other than `T | null`, `var` (hoisting
  with an implicit `undefined`), non-numeric enum members, computed property
  names, object spread and `delete`.
- **No dynamic dispatch**: no prototype chain and no runtime property lookup,
  so field access is always a `getelementptr`. This rules out `with`, `in`,
  `instanceof`, `typeof`, `==`/`!=` (which coerce across types), `Proxy`,
  `Reflect`, `globalThis`, `namespace`, `__proto__`, `.prototype`, the
  shape-mutating `Object.*` calls, and string-keyed element access.
- **No runtime**: no interpreter, GC, event loop, unwinder or regex engine in
  the C runtime. This rules out `eval`, `Function`, generators, `async`/`await`,
  `try`/`catch`, `debugger`, regex and `bigint` literals, `Symbol` and dynamic
  `import()`.
- **Fixed arity**: calls are direct with a known signature, so `arguments`
  has nothing to be.

Two rows have reasons of their own: labeled statements keep control flow
structured so the emitter's block naming stays simple, and comma expressions
go for readability and because they close the indirect-eval idiom `(0, eval)`.

"Numeric-shaped" index keys (identifiers, numeric literals, parentheses, unary
`+`/`-`, arithmetic over those, calls, property and element access) are
accepted syntactically so that array indexing was not blocked; the checker
then requires a numeric type.

## What changed since

- Generic type parameters were refused outright ("no monomorphisation yet")
  until [wp18-generics.md](wp18-generics.md); Phase 0 now refuses them only on
  a type alias and a constructor.
- `throw` joined the table when WP16 removed it
  ([wp16-results.md](wp16-results.md)), and the `try`/`catch` message now
  points at `Result<T, E>`.
- Optional chaining `?.` and nullish coalescing `??`, first left to the
  checker, are now Phase 0 rows, as are `for...in`, `import.meta`, import
  attributes and `import defer`.

What still depends on types or scopes stays the checker's
([LANGUAGE.md: Rejected by the checker](LANGUAGE.md#rejected-by-the-checker)):
`this` outside a method, properties not declared on a class, `never` in a
value position, and array and call spread.

## Biome

Biome (`biome.json`) is a formatter and style linter for the compiler's own
source, `tests/**/*.js`, and the Nish programs a reader learns from
(`examples/`, `docs/cookbook/`, `bench/**/*.ts`). It never influences
compilation; `npm run lint` and `npm run format` drive it, and every rule is
an error. [`.claude/linting.md`](../.claude/linting.md) has the full rule set.

The reasoning that rule set rests on:

- **Rules that mirror the language**, so the compiler's source and the
  examples read like Nish: `noVar`, `noExplicitAny`, `noEnum`, `noNamespace`,
  `noVoid`, `noParameterAssign` (parameters are immutable in Nish),
  `useExplicitLengthCheck` (there is no truthiness) and
  `useConsistentArrayType` (`T[]`). `useOptionalChain` and
  `useExponentiationOperator` are turned *off* because they push code towards
  `?.` and `**`, which Nish rejects.
- **House style** (kebab-case file names, `type` over `interface`, a function
  as an arrow bound to a `const`) is a second group, listed in linting.md;
  `biome-plugins/no-function-declaration.grit` exists because Biome has no
  built-in rule against function declarations.
- **Nish program directories** keep the arrow half (the language has arrows,
  [wp22-arrow-functions.md](wp22-arrow-functions.md)) but not the `type` half,
  because a struct is an `interface`; the unused-variable and numeric-literal
  rules are off there too, since those files are compiler inputs and the
  n-body constants are the benchmark's own digits.
- **Test fixtures** (`tests/cases`, `tests/link`,
  `tests/differential/corpus`) are not linted at all: a `reject_*` case
  exists to contain what the rules forbid.
