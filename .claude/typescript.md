# Writing TypeScript

You write TypeScript code that is clear, predictable, and easy to maintain. The
goal is to make the codebase safer, more understandable, and easier to refactor
without over-engineering.

## Principles

- Type safety over flexibility.
- Clarity over cleverness.
- Type inference where it makes sense.

## General Guidelines

- Explicit return types for every exported function, and for any function
  whose return type is not obvious from a one-line body.
- Avoid `any`. Use `unknown` when the type is unclear, then narrow. The four
  `any`s in `src/` today are all at the `typescript` API boundary; do not add a
  fifth without the same excuse.
- Prefer primitive types over complex ones unless necessary.
- Prefer `const`; reach for `let` only when a binding is genuinely reassigned
  (a loop counter, an accumulator, a `while` cursor).
- Use `satisfies` instead of `as` wherever it type-checks. A cast is a claim
  the compiler cannot verify, so write the reason next to it when one is
  unavoidable.
- Follow the Single Responsibility Principle. A module owns one family of
  constructs (`src/checker/classes.ts`, `src/codegen/emit/arrays.ts`) and the
  small helpers that only it uses. Types and related data can live in the same
  file; a second unrelated export is the exception, not the rule.
- Dispatch by table, not by `if`/`switch` chains: statements and expressions are
  keyed by `ts.SyntaxKind` in the checker and emitter tables, and validator rules
  by the same key in `validators`. A new construct is a new entry, not a new
  branch in an existing handler.
- Keep the layers apart: the checker writes the side tables in
  `CheckedProgram` and the emitter reads them. The emitter never re-derives a
  type and never reports a user-facing error (an unexpected node there is an
  internal error, exit 70).
- Relative imports only (`./diagnostics`, `../types`). The only bare specifier
  in `src/` is `typescript`, and the runtime dependencies list stays at that one
  entry: the published package must install in seconds on a machine that only
  has Node.
- Node built-ins are imported with the `node:` prefix (`node:fs`,
  `node:path`, `node:child_process`).
- Use Node 18+ APIs only. There is no Bun, no ESM in `src/` (`tsconfig.json`
  emits CommonJS; `bench/` and `runtime/shim.mjs` are the ESM exceptions), and
  no bundler: `dist/` is what `tsc` wrote.

## What differs from the sibling repos

The `.claude/` rules in `mjst`, `mini` and `agent-ummo` say "always arrow
functions", "always `type` over `interface`", "one function per file" and "no
classes". This compiler predates those rules and does not follow them, and a
rule the codebase contradicts on every page is worse than no rule. Here:

- **`function` declarations are the norm** (a few hundred of them, one arrow
  export). Hoisting is what lets the dispatch tables at the top of a module
  reference handlers defined below them. Match the file you are in.
- **`interface` and `type` are both used.** An `interface` for an object shape
  the side tables record (`StructInfo`, `FunctionSig`, `LocalVar`), a `type`
  for unions, aliases and function signatures (`StaticType`, `Validator`,
  `StatementChecker`). Do not convert one to the other in passing.
- **Classes are allowed where there is state with an invariant** —
  `Compilation`, `IRModule` / `IRFunction` / `IRBlock`, `Scope`,
  `CompileError`, `DiagnosticSink`. A bag of pure functions over a plain object
  is still preferred for everything else, and a class must not become a home for
  unrelated helpers.
- **`import type` is not used** (`useImportType` is off in `biome.json` and
  `verbatimModuleSyntax` is not on). A plain `import` of a type-only name is
  erased by `tsc`; keep it that way rather than mixing the two forms.

Everything else above (explicit return types, no `any`, `satisfies` over `as`,
`const` first, single responsibility, `node:` imports) applies unchanged.

## Naming Conventions

- Be descriptive.
- Use suffixes appropriately: `check*` for checker handlers, `emit*` for
  emitters, `collect*Facts` for attribute fact collectors, `is*` for predicates,
  `*Sig` / `*Info` for the side-table records they name.
- Basic blocks are named `kind.role` (`if.then`, `loop.cond`, `arr.oob`) so an
  IR diff reads as prose. Runtime symbols are `sts_*` on both sides of the ABI.
