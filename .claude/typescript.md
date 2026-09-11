# Writing TypeScript

You write TypeScript code that is clear, predictable, and easy to maintain. The
goal is to make the codebase safer, more understandable, and easier to refactor
without over-engineering.

Two kinds of TypeScript live in this repo, and the rules differ because the
compiler that runs them differs:

- **Nish programs** — `examples/`, `tests/cases/`, `tests/link/`,
  `tests/layout/`, `tests/differential/corpus/`, `docs/cookbook/`, `bench/*.ts`,
  and every snippet in `docs/` and `README.md`. These are compiled by
  `nish`, and the language reference (`docs/LANGUAGE.md`) is the style
  guide: a construct the compiler refuses is not a style choice, it is a
  compile error. **The first of the two house rules below now holds here too**:
  the language has arrow functions (`docs/wp22-arrow-functions.md`), so an Nish
  program declares a function as a `const` bound to an arrow, exactly as `src/`
  does. The second still cannot. The language has `type` aliases now, but an
  alias only renames a type that already exists, so an Nish *struct* is a
  `class` or an `interface` and "`type`, never `interface`" has nothing to say
  about it.
- **The compiler's own source** — `src/`, plus the JavaScript in `tests/`,
  `bench/` and `docs/`. This runs under Node through `tsc`, so the full
  language is available; the rule here is to write it *as if* Nish were
  the target wherever that costs nothing, so that the code reads like the
  language it compiles and the dynamic corners are the ones a reader can
  point at.

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

## Writing the compiler (`src/`)

The full language is available, and the `typescript` compiler API it walks is
thoroughly dynamic. The rule is to keep the dynamic parts at that boundary and
write the rest the way Nish would have it:

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
  `runtime/nish.mjs`, `bench/`). The floor is the version where Node
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
- **Nish programs now follow the arrow rule too**, since the language gained
  arrows: `examples/`, `docs/cookbook/` and every snippet in `docs/` and
  `README.md` are arrows already. `examples/`, `docs/cookbook/`, `bench/*.ts`
  and `self/` are still exempt from the plugin in `biome.json`, and that
  exemption is what lets the `function` declarations still in `self/`, `bench/`
  and `tests/cases/` sit there until their file is opened
  (`docs/wp22-arrow-functions.md` §8) — but new code in them is an arrow like
  everywhere else. The `type`-over-`interface` rule still does not reach them,
  for the reason at the top of this file.

`satisfies` is welcome in `src/` wherever it helps — a dispatch table checked
against its key type while keeping its literal value types is the obvious case.
It is only an Nish program that cannot use it.

## Naming Conventions

- **camelCase for values, PascalCase for types** — TypeScript's own
  convention, with no repo dialect on top of it. Functions, locals,
  parameters, class fields and object properties are camelCase
  (`checkExpression`, `emitCall`, `declareVariables`); classes and `type`
  aliases are PascalCase (`CheckContext`, `StaticType`, `FunctionSig`);
  a module-level constant that is a frozen table or a fixed scalar is
  CONSTANT_CASE (`RUNTIME_FUNCTIONS`, `TYPED_ARRAY_ALIASES`, `LANGUAGE`).
  An acronym keeps its own case rather than being title-cased: `IRBlock`,
  `IRFunction`, `compileToIR`, not `IrBlock` or `compileToIr`. File names
  are the one place that is not camelCase, and Biome enforces it
  (`useFilenamingConvention`): kebab-case or snake_case, so `emit/strings.ts`
  and `interop_abi.ts` are both fine and `emitStrings.ts` is not.
- **Three kinds of name are exempt, because the spelling is the meaning.**
  A table key that names a JavaScript global or builtin keeps that global's
  exact spelling, since the key *is* the identifier being matched —
  `Function`, `Proxy`, `Reflect`, `Symbol` in the validator's
  `FORBIDDEN_VALUE_IDENTIFIERS`, `Int32Array` in `TYPED_ARRAY_ALIASES`,
  `parseInt` and `Number` in the builtin checkers. A name that crosses an ABI keeps the
  ABI's spelling: `nish_*` runtime symbols, WASI's `fd_write` and
  `args_get` in `web/wasi.mjs`, `x86_64Layout` in `codegen/target.ts`. And a
  benchmark ported from another language keeps the source program's
  constants, so `bench/nbody.ts` has `SOLAR_MASS` and `PI` as locals.
- **This one is prose, not lint, and that is measured.** Biome's
  `useNamingConvention` was tried over the whole repo: with `strictCase` on
  it flags 82 places, and with it off (the setting that tolerates `IRBlock`)
  still 70 — every single one of them in the three exempt classes above,
  and none of them a name anyone would want changed. A rule whose entire
  output is false positives is worse than no rule, so the convention lives
  here and the reviewer is what enforces it.
- Be descriptive.
- Use suffixes appropriately: `check*` for checker handlers, `emit*` for
  emitters, `collect*Facts` for attribute fact collectors, `is*` for
  predicates, `*Sig` / `*Info` for the side-table records they name.
- Basic blocks are named `kind.role` (`if.then`, `loop.cond`, `arr.oob`) so
  an IR diff reads as prose. Runtime symbols are `nish_*` on both sides of
  the ABI.
- In Nish programs, name the function after what it computes and the
  test case after the rule it proves (`cf_while_break`, `reject_null_field_access`).
