# Writing TypeScript

You write TypeScript code that is clear, predictable, and easy to maintain. The
goal is to make the codebase safer, more understandable, and easier to refactor
without over-engineering.

Two kinds of code live in this repo, and the rules differ because what runs
them differs:

- **Nish programs** — the compiler itself (`self/`), `std/`, `tests/nish/`,
  `examples/`, `tests/cases/`, `tests/link/`, `tests/layout/`,
  `tests/differential/corpus/`, `docs/cookbook/`, `bench/*.ts`, and every
  snippet in `docs/` and `README.md`. These are compiled by `nish`, and the
  language reference (`docs/LANGUAGE.md`) is the style guide: a construct the
  compiler refuses is not a style choice, it is a compile error. A function is
  a `const` bound to an arrow (`docs/wp22-arrow-functions.md`), and a struct is
  a `class` or an `interface`, because a `type` alias only renames a type that
  already exists.
- **The JavaScript tooling** — `tests/**/*.js`, `scripts/`, `bin/`,
  `bench/*.mjs`, `web/` and `docs/*.mjs`. This runs under Node, so the full
  language is available; the rule here is to write it *as if* Nish were the
  target wherever that costs nothing, so that the code reads like the language
  it tests and the dynamic corners are the ones a reader can point at.

The compiler was once in the second group: until WP19 R6 a TypeScript
implementation in `src/` ran under Node beside `self/`. It is deleted, and the
compiler is an Nish program like any other — held, on top of the rules below,
to the smaller subset `.claude/selfhost.md` calls Nish-0.

## Principles

- Type safety over flexibility.
- Clarity over cleverness.
- One value, one layout: a type should describe one fixed shape, and a
  function should take and return exactly what its signature says.
- Explicit over inferred at every boundary; inference is for locals.

## Writing Nish programs

Everything the validator and checker refuse is listed in `docs/LANGUAGE.md`
("Forbidden constructs", "Rejected by the checker") with the exact message and
the `reject_*` case that pins it.

Those two lists mean different things, and it matters when you read a
rejection. **Phase 0, the validator, is what Nish can never compile** —
`any`, `eval`, prototypes, `try`, dynamic property access. **The checker's
`Unsupported ... in Phase 1` fallback is what nobody has implemented yet**,
and the validator's own header says a later work package makes those compile
without touching Phase 0. Arrow functions and `type` aliases were both in that
second bucket and have both come out of it; `satisfies` is still in it. Phase 0
lets all three through and only rejects generic type parameters on them, so
which list a rejection comes from tells you whether to expect it to change.
What *is* a design decision is the `Function` type, forbidden in Phase 0 as "no
dynamic function values": a function passed as a value needs a function
pointer and an indirect call, and the whole-program pass cannot prove purity,
termination or escape facts through an unknown callee. That is what keeps a
function from being a value whichever way it is spelled.

**The paradigm is data-oriented and procedural**, and it is a deliberate
"neither" rather than a compromise: pure OOP puts a pointer chase between the
CPU and the data, pure FP puts an allocation between them, and this compiler
cannot afford either. So flat structs in contiguous memory, top-level
functions that LLVM inlines, explicit mutation, and functional idioms only
where they remove runtime work. The reasoning and the enforcement table are in
[docs/wp15-performance.md](../docs/wp15-performance.md) §1a; the practical
consequence for an Nish program is that a loop over an array of structs is
the fast shape and a chain of small objects linked by pointers is not.

The shape of the language, as a style guide:

- **Declarations.** A module holds only function, `class`, `interface`, `type`
  and `import` declarations at the top level, plus module `const`s. No
  top-level `let`, no `enum`, no `namespace`. **A function is an arrow bound to
  a module-level `const`** — `const add = (a: i32, b: i32): i32 => a + b`, with
  a concise body where it has one `return`. The `function` keyword still
  compiles and is the legacy spelling, so convert one when you open its file
  and write new code as an arrow. No function expressions, nested functions,
  generics, overloads, optional / default / rest / destructured parameters, and
  a function is never a value. Every parameter and every return type is
  annotated. `export const main = (): number => ...` is the entry and its
  return value is the exit code.
- **Types.** `number`, `i32`, `i64`, `f64`, `boolean`, `string`, `void`, `T[]`
  / `Array<T>`, the typed-array aliases, class and interface names, and
  `T | null` for a class, interface, array or string. Nothing else: no `any`,
  `unknown`, `undefined`, `bigint`, `symbol`, no unions beyond `T | null`, no
  function types, no `as` or `satisfies` (there is no cast; convert with
  `toI32` / `toI64` / `toF64`). `number` is `i32` unless `--number-mode f64`.
- **Objects.** A `class` is a struct: annotated fields, literal initializers,
  one constructor, methods. An `interface` is a struct with fields only, and
  an object literal sets every field exactly once and takes its type from
  context. `class C implements I` means identical fields in the same order.
  No `prototype`, no spread, no computed keys, no string-keyed access, no
  `Object.assign`, no inheritance.
- **Expressions.** `===` / `!==` only. Conditions are `boolean` (there is no
  truthiness), `&&` / `||` take booleans, both ternary arms have one type,
  and no operator converts: `"a" + 1` is an error, `` `a${n}` `` is the
  way. Narrow a nullable with `if (p !== null)`, never `?.` or `??`. No
  `typeof`, `instanceof`, `in`, `delete`, `void`, comma expressions,
  regex literals.
- **Control flow.** `if`/`else`, `while`, `do`, `for`, `for (const x of a)`,
  `break`/`continue`, `return`, `throw` (aborts; there is no `try`). A
  non-`void` function returns on every path and code after a terminator is
  an error. `let` is normal here: a loop counter or an accumulator is a
  `let`, and `const` is for what does not change.
- **Memory.** There is no GC. Locals that do not escape are stack slots,
  temporaries die with the function's arena scope, and `Arena.*` is for
  explicit control. Write the program so the allocation pattern is visible:
  hoist an array out of a loop when it is reused, and do not build a
  string one character at a time inside a hot loop expecting a rope.

When a snippet is meant to *fail*, say which rule it breaks in a one-line
comment at the top and put the expected fragment in the `.err` file; a
`reject_*` case that also fails for a second, accidental reason is a weaker
test than it looks.

## Writing the compiler (`self/`)

`self/` is an Nish program, so everything in the section above holds, and it is
written in Nish-0 on top of that (`.claude/selfhost.md`): no closures, no `Map`,
no `try`, one `Node` class, side tables as arrays indexed by `Node.id`. What the
compiler adds as house rules:

- **The checker records, the emitter reads.** The checker writes the side
  tables in `self/program.ts`; the emitter reads them, never re-derives a type,
  and never reports a user-facing error (an unexpected node there is an
  internal error, exit 70).
- **Dispatch by a central `switch` on the node kind, not by `if` chains**
  across constructs. A new construct is a new case in each layer, mirrored.
- **A module owns a construct family**, and the family's checker and emitter
  halves are named for each other (`arrays.ts` / `emit_arrays.ts`).
- **The rolling freeze.** `self/` is built by the last release, so it may only
  use what that release compiles, however much the tree it sits in can.

## Writing the tooling (JavaScript)

- **`===` / `!==` only**, and a boolean condition where the value could be
  `0` or `""`: `if (list.length > 0)`, not `if (list.length)`. Biome enforces
  the `.length` half (`useExplicitLengthCheck`) and `noDoubleEquals`; the rest
  is on you, because the language has no truthiness and the source should read
  the same way.
- **Nullable means `null`**, checked with `!== null`. Prefer that over `?.` and
  `??` when the null case is a real branch with its own meaning; keep `?.` /
  `??` for optional lookups where spelling the branch out would only add
  lines. Do not introduce `undefined` as a value when `null` will do.
- **Prefer `const`;** `let` is for a genuine reassignment (a loop counter, an
  accumulator, a cursor).
- **Arrow functions bound to a `const`, never a `function` declaration.**
  Biome has no built-in rule for this, so it is a plugin,
  `biome-plugins/no-function-declaration.grit`. A `const` is not hoisted, so a
  table of handlers has to sit *below* the handlers it names. Class methods
  stay methods, because an arrow property would rebind `this`.
- **Classes only where there is state with an invariant.** Everything else is
  plain functions over plain objects, and a class must not become a home for
  unrelated helpers.
- **`Map` / `Set` for lookups, not a mutable object used as a dictionary.** An
  object literal is for a table that is written once.
- **Node built-ins carry the `node:` prefix** (`node:fs`, `node:path`,
  `node:child_process`).
- **ES modules, Node 22.18+, no bundler.** The whole repository is one module
  system: `tests/` and `scripts/` are ESM, `__dirname` is
  `import.meta.dirname`, and the `.mjs` files exist only where a name wants to
  say "this is loaded by something else" (`runtime/shim.mjs`,
  `runtime/nish.mjs`, `bench/`).
- **The arrow rule is mid-migration.** The harness predates it and still holds
  `function` declarations, so the rule is `warn` rather than `error`:
  `npm run lint` stays green, and the warning count is the size of what is
  left. New code follows the rule, and a file opened for another reason is
  converted while you are in it. To see only real errors while that backlog
  stands, run `npm run lint -- --diagnostic-level=error`. There is no automatic
  fix, because moving a declaration to a `const` can reorder a file.

## What differs from the sibling repos

The `.claude/` rules in `mjst`, `mini` and `agent-ummo` say "always arrow
functions", "always `type` over `interface`", "one function per file", "no
classes" and "use `satisfies` instead of `as`". The first holds here and is
linted. What still differs:

- **Classes stay** where there is state with an invariant, as above. A repo of
  pure functions is the sibling ideal; an SSA builder and a scope chain are not
  that.
- **`interface` stays** in an Nish program, because an Nish struct is a `class`
  or an `interface` and a `type` alias only renames a type that exists.
- **A module owns a construct family, not one function.** `self/structs.ts`
  holds the class and interface rules because they share the switch they are
  reached through and the side tables they write. Splitting them one per file
  would scatter a family across a directory.

## Naming Conventions

- **camelCase for values, PascalCase for types** — TypeScript's own
  convention, with no repo dialect on top of it. Functions, locals,
  parameters, class fields and object properties are camelCase
  (`checkExpression`, `emitCall`); classes, interfaces and `type` aliases are
  PascalCase (`CheckContext`, `FunctionSig`); a module-level constant that is
  a frozen table or a fixed scalar is CONSTANT_CASE (`T_ERROR`,
  `EFFECT_WRITE`, `LANGUAGE`). An acronym keeps its own case rather than being
  title-cased: `IRBlock`, `IRFunction`, not `IrBlock` or `IrFunction`. An object key
  that names an environment variable is CONSTANT_CASE too (`NISH_BOOTSTRAP`).
- **File and directory names are kebab-case**: `emit-arrays.ts`, not
  `emit_arrays.ts` or `emitArrays.ts`. Biome's `useFilenamingConvention` checks
  the files Biome reads, and `scripts/check-filenames.mjs` checks the rest of
  the tree. ALL-CAPS documents (`README.md`, `docs/LANGUAGE.md`) and the test
  fixture trees are exempt ([`linting.md`](./linting.md)). Some files still
  have snake_case names; they are renamed in the cleanup pass, so a new file is
  kebab-case even when its neighbours are not.
- **Three kinds of name are exempt, because the spelling is the meaning.**
  A name that is a JavaScript global or builtin keeps that global's exact
  spelling, since the name *is* the identifier being matched — `Proxy` and
  `Reflect` as the validator refuses them, `Int32Array`, `parseInt` and
  `Number` as the language's builtins. A name that crosses an ABI keeps the
  ABI's spelling: `nish_*` runtime symbols, WASI's `fd_write` and `args_get` in
  `web/wasi.mjs`. And a benchmark ported from another language keeps the
  source program's constants, so `bench/nbody.ts` has `SOLAR_MASS` and `PI` as
  locals. It keeps the source's licence notice too, at the top of the file,
  and is listed in `THIRD_PARTY_NOTICES.md` ([`licensing.md`](./licensing.md)).
- **Biome enforces this**, through `useNamingConvention` with three
  allowances: `strictCase` off for the acronyms, CONSTANT_CASE or snake_case
  for a `const`, CONSTANT_CASE for an object key, and snake_case keys where
  the keys are someone else's ABI (`web/wasi.mjs`, the hook payloads in
  `.claude/hooks/`). Those
  allowances exist because the strict rule flagged 86 names, almost all of
  them in the exempt classes above. With the allowances it flags 5, and those
  are names that really should change. [`linting.md`](./linting.md) has the details.
- Be descriptive.
- Use suffixes appropriately: `check*` for checker handlers, `emit*` for
  emitters, `collect*Facts` for attribute fact collectors, `is*` for
  predicates, `*Sig` / `*Info` for the side-table records they name.
- Basic blocks are named `kind.role` (`if.then`, `loop.cond`, `arr.oob`) so
  an IR diff reads as prose. Runtime symbols are `nish_*` on both sides of
  the ABI.
- In Nish programs, name the function after what it computes and the
  test case after the rule it proves (`cf_while_break`, `reject_null_field_access`).
