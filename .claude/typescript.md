# Writing TypeScript

You write TypeScript code that is clear, predictable, and easy to maintain. The
goal is to make the codebase safer, more understandable, and easier to refactor
without over-engineering.

Two kinds of TypeScript live in this repo, and the rules differ because the
compiler that runs them differs:

- **StaticTS programs** — `examples/`, `tests/cases/`, `tests/link/`,
  `tests/layout/`, `tests/differential/corpus/`, `docs/cookbook/`, `bench/*.ts`,
  and every snippet in `docs/` and `README.md`. These are compiled by
  `statictsc`, and the language reference (`docs/LANGUAGE.md`) is the style
  guide: a construct the validator rejects is not a style choice, it is a
  compile error.
- **The compiler's own source** — `src/`, plus the JavaScript in `tests/`,
  `bench/` and `docs/`. This runs under Node through `tsc`, so the full
  language is available; the rule here is to write it *as if* StaticTS were
  the target wherever that costs nothing, so that the code reads like the
  language it compiles and the dynamic corners are the ones a reader can
  point at.

## Principles

- Type safety over flexibility.
- Clarity over cleverness.
- One value, one layout: a type should describe one fixed shape, and a
  function should take and return exactly what its signature says.
- Explicit over inferred at every boundary; inference is for locals.

## Writing StaticTS programs

Everything the validator and checker refuse is listed in `docs/LANGUAGE.md`
("Forbidden constructs", "Rejected by the checker") with the exact message and
the `reject_*` case that pins it. The shape of the language, as a style guide:

- **Declarations.** A module holds only `function`, `class`, `interface` and
  `import` at the top level. No `type` aliases, no top-level `let`/`const`,
  no `enum`, no `namespace`. `function` declarations only: no arrow
  functions, function expressions, nested functions, generics, overloads,
  optional / default / rest / destructured parameters. Every parameter and
  every return type is annotated. `export function main(): number` is the
  entry and its return value is the exit code.
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

## Writing the compiler (`src/`)

The full language is available, and the `typescript` compiler API it walks is
thoroughly dynamic. The rule is to keep the dynamic parts at that boundary and
write the rest the way StaticTS would have it:

- **Explicit return types** on every exported function, and on any function
  whose return type is not obvious from a one-line body. Annotate the
  parameters of every function; infer only locals.
- **No `any`.** There is none in `src/` today and `noExplicitAny` is an
  error in `biome.json`; the `typescript` API is walked through `ts.Node` and
  the `ts.is*` guards, never through `any`. `unknown` is acceptable only at an
  input boundary (a parsed flag, a caught error) and is narrowed at once.
- **Casts are boundary work.** `node as ts.CallExpression` after a
  `ts.isCallExpression` guard, or inside a handler the dispatch table already
  selected by `SyntaxKind`, is the accepted pattern: the table is the proof.
  A cast anywhere else is a claim the compiler cannot verify, so prefer a
  type guard, and when a cast is unavoidable write the reason next to it.
- **`===` / `!==` only**, and a boolean condition where the value could be
  `0` or `""`: `if (list.length > 0)`, not `if (list.length)`. Biome enforces
  the `.length` half (`useExplicitLengthCheck`) and `noDoubleEquals`; the rest
  is on you, because the language has no truthiness and the source should read
  the same way.
- **Nullable means `T | null`**, checked with `!== null`. Prefer that over
  `?.` and `??` when the null case is a real branch with its own meaning; keep
  `?.` / `??` for optional lookups (`runtime?.effect ?? "write"` in
  `attributes.ts`) where spelling the branch out would only add lines. Do not introduce
  `undefined` as a value in a new type when `null` will do.
- **Prefer `const`;** `let` is for a genuine reassignment (a loop counter, an
  accumulator, a cursor walking up `node.parent`).
- **`interface` for struct-like records** the side tables store
  (`StructInfo`, `FunctionSig`, `LocalVar`): fixed fields, one shape, exactly
  the thing a StaticTS interface is. **`type` for unions and aliases**
  (`StaticType`, `Validator`, `StatementChecker`). Discriminated unions are
  fine in `src/` because the emitter switches on the tag; give the tag a
  string literal type and make every switch exhaustive.
- **`function` declarations are the norm** (a few hundred of them, one arrow
  export). Hoisting is what lets a dispatch table at the top of a module
  reference handlers defined below it. Arrows are for callbacks
  (`.map`, `.filter`, `.sort`) and the small local closures inside a handler;
  a named, top-level arrow is not the style here.
- **Classes are allowed where there is state with an invariant** —
  `Compilation`, `IRModule` / `IRFunction` / `IRBlock`, `Scope`,
  `CompileError`, `DiagnosticSink`. Everything else is plain functions over
  plain objects, and a class must not become a home for unrelated helpers.
  Inheritance exists only in the error hierarchy (`CompileError extends
  Error`, `StaticSyntaxError extends CompileError`); nothing else extends
  anything, the same as the language, where `implements` is a layout check
  and there is no `extends` at all.
- **`Map` / `Set` / `WeakMap` for lookups, not `Record<string, T>` on a
  mutable object.** The side tables are `WeakMap`s keyed by AST node
  precisely so that no node is ever mutated; a new table follows that
  pattern. `Record` is for a literal table that is written once
  (`RUNTIME_FUNCTIONS`, the dispatch tables).
- **Dispatch by table, not by `if`/`switch` chains** across constructs: the
  validator, checker and emitter are each keyed by `ts.SyntaxKind`. A new
  construct is a new entry in each, mirrored across the layers. A `switch`
  inside one handler over the *tags of its own type* is fine.
- **The checker records, the emitter reads.** The checker writes the side
  tables in `CheckedProgram`; the emitter reads them, never re-derives a
  type, and never reports a user-facing error (an unexpected node there is
  an internal error, exit 70).
- **Relative imports only** (`./diagnostics`, `../types`). The only bare
  specifier in `src/` is `typescript`, and the runtime dependency list stays
  at that one entry.
- **Node built-ins carry the `node:` prefix** (`node:fs`, `node:path`,
  `node:child_process`), and only `src/index.ts`, `src/compilation.ts`,
  `src/parser.ts` and `src/version.ts` import `node:fs`; the checker and
  emitter are pure functions from AST to side tables to text (the
  `readFileSync` they know about is the builtin they compile, not a call).
- **`import type` is not used** (`useImportType` is off in `biome.json`,
  `verbatimModuleSyntax` is not on). A plain `import` of a type-only name is
  erased by `tsc`; keep it that way rather than mixing the two forms.
- **CommonJS, Node 18+, no bundler.** `tsconfig.json` emits CommonJS into
  `dist/`; `bench/` and `runtime/shim.mjs` are the ESM exceptions.

## What differs from the sibling repos

The `.claude/` rules in `mjst`, `mini` and `agent-ummo` say "always arrow
functions", "always `type` over `interface`", "one function per file", "no
classes" and "use `satisfies` instead of `as`". Those are rules for
JavaScript runtimes with a garbage collector and structural typing; here
the language being compiled has none of that, and the source follows the
language. Concretely: `function` declarations, `interface` for records,
classes for stateful builders, a module per construct family rather than
per function, and no `satisfies` (a StaticTS program cannot use it, and in
`src/` a `satisfies` on a dispatch table is the one place it would help;
prefer an explicit annotation there).

## Naming Conventions

- Be descriptive.
- Use suffixes appropriately: `check*` for checker handlers, `emit*` for
  emitters, `collect*Facts` for attribute fact collectors, `is*` for
  predicates, `*Sig` / `*Info` for the side-table records they name.
- Basic blocks are named `kind.role` (`if.then`, `loop.cond`, `arr.oob`) so
  an IR diff reads as prose. Runtime symbols are `sts_*` on both sides of
  the ABI.
- In StaticTS programs, name the function after what it computes and the
  test case after the rule it proves (`cf_while_break`, `reject_null_field_access`).
