# Writing TypeScript

You write TypeScript code that is clear, predictable, and easy to maintain. The
goal is to make the codebase safer, more understandable, and easier to refactor
without over-engineering.

Two kinds of TypeScript live in this repo, and the rules differ because the
compiler that runs them differs:

- **AmritScript programs** — `examples/`, `tests/cases/`, `tests/link/`,
  `tests/layout/`, `tests/differential/corpus/`, `docs/cookbook/`, `bench/*.ts`,
  and every snippet in `docs/` and `README.md`. These are compiled by
  `amritc`, and the language reference (`docs/LANGUAGE.md`) is the style
  guide: a construct the compiler refuses is not a style choice, it is a
  compile error. **The two house rules below cannot apply here** — the
  language has no arrow functions and no `type` aliases, so an AmritScript
  program declares functions with `function` and structs with `interface`.
- **The compiler's own source** — `src/`, plus the JavaScript in `tests/`,
  `bench/` and `docs/`. This runs under Node through `tsc`, so the full
  language is available; the rule here is to write it *as if* AmritScript were
  the target wherever that costs nothing, so that the code reads like the
  language it compiles and the dynamic corners are the ones a reader can
  point at.

## Principles

- Type safety over flexibility.
- Clarity over cleverness.
- One value, one layout: a type should describe one fixed shape, and a
  function should take and return exactly what its signature says.
- Explicit over inferred at every boundary; inference is for locals.

## Writing AmritScript programs

Everything the validator and checker refuse is listed in `docs/LANGUAGE.md`
("Forbidden constructs", "Rejected by the checker") with the exact message and
the `reject_*` case that pins it.

Those two lists mean different things, and it matters when you read a
rejection. **Phase 0, the validator, is what AmritScript can never compile** —
`any`, `eval`, prototypes, `try`, dynamic property access. **The checker's
`Unsupported ... in Phase 1` fallback is what nobody has implemented yet**,
and the validator's own header says a later work package makes those compile
without touching Phase 0. Arrow functions, `type` aliases and `satisfies` are
all in the second bucket: Phase 0 lets them through and only rejects generic
type parameters on them. So "you must write `function` here" is a statement
about today's checker, not a design decision that could never change. What
*is* a design decision is the `Function` type, forbidden in Phase 0 as "no
dynamic function values": a function passed as a value needs a function
pointer and an indirect call, and the whole-program pass cannot prove purity,
termination or escape facts through an unknown callee.

**The paradigm is data-oriented and procedural**, and it is a deliberate
"neither" rather than a compromise: pure OOP puts a pointer chase between the
CPU and the data, pure FP puts an allocation between them, and this compiler
cannot afford either. So flat structs in contiguous memory, top-level
functions that LLVM inlines, explicit mutation, and functional idioms only
where they remove runtime work. The reasoning and the enforcement table are in
[docs/wp15-performance.md](../docs/wp15-performance.md) §1a; the practical
consequence for an AmritScript program is that a loop over an array of structs is
the fast shape and a chain of small objects linked by pointers is not.

The shape of the language, as a style guide:

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
write the rest the way AmritScript would have it:

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
- **`type`, never `interface`.** Every declaration is a `type` alias: the
  struct-like records the side tables store (`StructInfo`, `FunctionSig`,
  `LocalVar`) as much as the unions and signatures (`StaticType`, `Validator`,
  `StatementChecker`). `useConsistentTypeDefinitions` enforces it. Write
  members that hold a function as properties, not method shorthand
  (`emit: (ctx: EmitContext) => string`, not `emit(ctx: EmitContext): string`);
  `useConsistentMethodSignatures` enforces that, and it also buys stricter
  parameter checking, because method shorthand is checked bivariantly.
  Discriminated unions are fine here since the emitter switches on the tag;
  give the tag a string literal type and make every switch exhaustive.
- **Arrow functions bound to a `const`, never a `function` declaration.**
  `const checkCall = (ctx: CheckContext, node: ts.CallExpression): StaticType => { ... };`
  Biome has no built-in rule for this, so it is a plugin,
  `biome-plugins/no-function-declaration.grit`. Two things to respect when you
  convert a file: a `const` is not hoisted, so a dispatch table has to sit
  *below* the handlers it names, and `tsc` reports a use before declaration
  when it does not. Class methods stay methods, because an arrow property
  would rebind `this` and move the function off the prototype.
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
- **ES modules, Node 22.18+, no bundler.** `tsconfig.json` emits ES modules
  into `dist/` under `module: Node16`, so **every relative import carries its
  `.js` extension** — `./diagnostics.js`, `../types.js`, `./checker/index.js` —
  because that is what Node resolves at runtime and `tsc` refuses the
  extensionless form here (TS2835). The whole repository is one module system
  now: `tests/` and `scripts/` are ESM too, `__dirname` is
  `import.meta.dirname`, and the `.mjs` files exist only where a name wants to
  say "this is loaded by something else" (`runtime/shim.mjs`,
  `runtime/amritscript.mjs`, `bench/`). The floor is the version where Node
  strips types without a flag, which is what makes
  `node --experimental-strip-types prog.ts` a real thing to point people at.
- **The two house rules are mid-migration.** The compiler source predates
  them and still holds a few hundred `function` declarations and a few dozen
  `interface`s, and so does the JavaScript test harness. Both rules are
  therefore `warn` rather than `error`: `npm run lint` stays green, and the
  warning count is the size of what is left. New code follows the rule, and a
  file opened for another reason is converted while you are in it. To see only
  real errors while that backlog stands, run
  `npm run lint -- --diagnostic-level=error`. The `interface` half is
  mechanical — `npx biome check --write --unsafe` rewrites every one of them —
  but read the diff before keeping it, and do not mix that sweep into a commit
  about something else. The arrow half has no automatic fix, because moving a
  declaration to a `const` can reorder a file.

## What differs from the sibling repos

The `.claude/` rules in `mjst`, `mini` and `agent-ummo` say "always arrow
functions", "always `type` over `interface`", "one function per file", "no
classes" and "use `satisfies` instead of `as`". The first two now hold for the
compiler's own source, and are linted. Three things still differ:

- **Classes stay** where there is state with an invariant, as above. A repo of
  pure functions is the sibling ideal; an SSA builder and a scope chain are not
  that, and `instanceof CompileError` is how the CLI separates a user error
  from an internal one.
- **A module owns a construct family, not one function.** `checker/classes.ts`
  holds every class-related handler because they share the dispatch table they
  register into and the side tables they write. Splitting them one per file
  would scatter a table across a directory.
- **AmritScript programs cannot follow the first two at all.** The language has
  neither arrow functions nor `type` aliases, so `examples/`, `docs/cookbook/`
  and `bench/*.ts` are exempt in `biome.json`, and the plugin does not run on
  them.

`satisfies` is welcome in `src/` wherever it helps — a dispatch table checked
against its key type while keeping its literal value types is the obvious case.
It is only an AmritScript program that cannot use it.

## Naming Conventions

- Be descriptive.
- Use suffixes appropriately: `check*` for checker handlers, `emit*` for
  emitters, `collect*Facts` for attribute fact collectors, `is*` for
  predicates, `*Sig` / `*Info` for the side-table records they name.
- Basic blocks are named `kind.role` (`if.then`, `loop.cond`, `arr.oob`) so
  an IR diff reads as prose. Runtime symbols are `amrit_*` on both sides of
  the ABI.
- In AmritScript programs, name the function after what it computes and the
  test case after the rule it proves (`cf_while_break`, `reject_null_field_access`).
