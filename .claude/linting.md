# Linting

A rule a tool can check is checked by a tool, not by a reviewer. This file says
which rules those are and where each is enforced.

`npm run lint` runs the file-name check and `biome check .`, with the
formatter on. `npm run lint:dead` runs knip. CI's `lint` job runs both, plus
shellcheck, and every rule is an `error`: a finding fails the pull request.
`npm run lint:fix` applies every safe fix and formats, and
`npm run format` only formats.

## What checks what

| Tool | Reads | Config |
| --- | --- | --- |
| Biome (lint and format) | `src/`, `std/`, `bin/`, `tests/**/*.js`, `tests/self/**/*.ts`, `examples/`, `docs/cookbook/`, `docs/*.mjs`, `bench/`, `web/`, `scripts/`, `.claude/hooks/` | `biome.json` |
| `scripts/check-filenames.mjs` | every path `git ls-files` prints | the constants at its top |
| tsc (`npm run check`) | `src/`, `std/`, `tests/nish/` | `tsconfig.json` |
| knip (`npm run lint:dead`) | the same files as Biome, from the entry points in its config | `knip.json` |
| shellcheck (`-S warning`) | `scripts/*.sh`, `docs/cookbook/regen.sh`, `install.sh`, `.github/*.sh`, `.claude/hooks/*.sh` | the CI step |

An agent's edits are formatted as they are made: the `PostToolUse` hook in
`.claude/settings.json` runs `.claude/hooks/format-edited.mjs`, which runs
`biome check --write` on the file an Edit or a Write touched.

The test fixtures (`tests/cases`, `tests/link`, `tests/wordings`,
`tests/differential/corpus`) are not linted and are exempt from the file-name
rule. A `reject_*` case exists to contain what the rules forbid, and a case's
snake_case name is an identifier that `docs/LANGUAGE.md`, the registers and the
goldens cite.

## Naming

- **Files and directories are kebab-case**: `emit-arrays.ts`, `runtime-os.c`,
  `lexer-oracle.js`. Every part between dots counts, so `no-attribution.test.mjs`
  and `nish.d.ts` pass. Biome's `useFilenamingConvention` checks the files Biome
  reads, and `scripts/check-filenames.mjs` checks everything else: C, shell,
  Markdown, and directories. Only three kinds of name are exempt. An ALL-CAPS
  document (`README.md`, `LICENSE`, `CHANGELOG.md`, `docs/LANGUAGE.md`) keeps
  its capitals, the fixture trees above keep their names, and a `node_modules`
  directory keeps the name package resolution looks for.
- **Values are camelCase and types are PascalCase.** Biome's `useNamingConvention`
  enforces it with these allowances. Each one is there because a strict rule
  flagged real code that nobody would want renamed:
  - `strictCase: false`, so an acronym keeps its case (`IRBlock`,
    `fieldLLVMType`).
  - A `const` may be CONSTANT_CASE (`T_ERROR`, a benchmark's `SOLAR_MASS`).
  - An object-literal key may be CONSTANT_CASE, because environment variables
    are spelled that way (`{ NISH_BOOTSTRAP: seed }`).
  - `web/wasi.mjs` and `.claude/hooks/` also allow snake_case keys, because
    the keys are someone else's ABI: WASI's import names (`fd_write`,
    `args_get`) and Claude Code's hook payload (`tool_name`, `tool_input`).
  A `nish_*` runtime symbol is only a string in the JavaScript, so it never
  reaches the rule.

## The rule set

Biome's `recommended` preset is on in full. On top of it:

**Mirrors of the language** (`docs/wp0-validator.md` gives the reasoning): `noVar`, `noExplicitAny`, `noEnum`, `noNamespace`, `noVoid`,
`noParameterAssign`, `useExplicitLengthCheck`, `useConsistentArrayType`
(`T[]`). `useOptionalChain` and `useExponentiationOperator` are off because
they push code towards `?.` and `**`, which Nish refuses.

**House style**:

- `useArrowFunction`, `useShorthandFunctionType`, `useConsistentArrowReturn`.
- The `no-function-declaration` plugin: an arrow bound to a `const`, never a
  `function` declaration. It covers every file Biome reads except
  `docs/cookbook/fn-add-function.ts`, which exists to show that spelling.
- `useBlockStatements`: always put braces on `if`/`else`/loop bodies. A
  one-line body that grows a second statement then cannot silently fall out
  of the branch.
- `noShadow`: a local that hides an outer name is how a helper ends up
  reading the wrong `out` or `file`.
- `noNestedTernary`: two levels of `?:` read better as an `if`.
- `noUnusedTemplateLiteral`, `noUnusedImports`, `noEmptyBlockStatements` (an
  empty block says why in a comment), `useAwait`, `noYodaExpression`,
  `useNumberNamespace`, `noExportedImports`, `useConst`, `noUselessElse`,
  `useShorthandAssign`, `noUselessStringConcat`, and `useNamingConvention`
  (see Naming).
- `useConsistentTypeDefinitions` and `useConsistentMethodSignatures`: `type`
  over `interface`, and a function member written as a property. Off in Nish
  programs, where a struct is an `interface`.
- The formatter: two-space indent, 110 columns, double quotes, and a
  semicolon only where JavaScript's insertion rule needs one.

**Guards**:

- `noTsIgnore`: a type error you mean to keep gets `@ts-expect-error` and a
  reason, which fails once the error is gone. `@ts-ignore` stays silent
  forever.
- `noExportsInTest`: a test file exports nothing, so no module can come to
  depend on one.
- `noGlobalDirnameFilename`: `import.meta.dirname`, never `__dirname`
  (`typescript.md`).
- `noBarrelFile` and `noReExportAll`: no module exists only to re-export
  another. An import names the module that owns the symbol.
- `useGuardForIn`.
- `noRestrictedImports`, for `src/` and `std/`: both ship, so neither may
  import from `tests/`, `scripts/`, `bench/` or `examples/`.

- `noForEach`, `noUselessUndefinedInitialization`, `useCollapsedElseIf`,
  `useSingleVarDeclarator`, `useThrowNewError`, `useThrowOnlyError`,
  `noDefaultExport` (named exports only), `noCommonJs` (ESM only),
  `useNodejsImportProtocol` (`node:fs`), `noEvolvingTypes`, `useErrorMessage`,
  `noUnusedPrivateClassMembers`.

`tsconfig.json` (`npm run check`) adds `noImplicitReturns`,
`noFallthroughCasesInSwitch`, `allowUnreachableCode: false`, `noUnusedLocals`
and `noUnusedParameters` to `strict`. Biome's unused-variable rules are off for
Nish programs, so tsc is what catches an unused local in `src/`. A parameter a
signature needs but a body does not read, such as a `std/` function that is a
builtin natively and a stub under Node, is spelled with a leading `_`.

**Dead code** (knip, `knip.json`): no unused file, dependency or export. An
export no other module imports matters in `src/`: the compiler keeps an
exported function external, and an internal one can be inlined or dropped.
Unexporting the 139 of those this found shrank the compiler by 880 bytes, and
the self-compile time did not move measurably. A name kept for a reader rather
than an importer, such as `RULE_COUNT`, which `scripts/gen-diagnostic-codes.mjs`
checks, carries `@public` in its doc comment.

**Off for Nish programs** (`src/`, `std/`, `examples/`, `docs/cookbook/`,
`bench/*.ts`, `tests/self/*.ts`). Following these rules there would give code
that the compiler refuses or compiles worse:

- `useShorthandAssign`: `+=` never concatenates in Nish
  (`reject_cf_compound_string`), and it needs both sides to have exactly the
  same numeric type. The Nish sources hold about 600 `x = x + ...`
  assignments, and the autofix would break the string ones.
- `useForOf`: an index loop can be the shape the bounds prover needs.
- `useNumberNamespace`: `parseInt` is the language's builtin.
- `useParseIntRadix`: the builtin `parseInt` is base 10 only and takes one
  argument, so the radix the rule asks for is a compile error.
- The unused-variable and numeric-literal rules: these files are compiler
  inputs, and the n-body constants are the benchmark's own digits.

### Considered and left off

These were measured over the tree. Each one flags a shape this repository
depends on, so it would stay noise however long the cleanup ran:

| Rule | Hits | Why not |
| --- | --- | --- |
| `noUndeclaredVariables` | 719 | The Nish builtins (`i32`, `toI32`, `Arena`) are ambient, declared in `runtime/nish.d.ts`. |
| `useImportExtensions` | 477 | Nish imports are extensionless. |
| `noProcessGlobal`, `noConsole` | 676 | The tooling is a CLI. |
| `noBitwiseOperators` | 348 | This is a compiler. |
| `noExcessiveCognitiveComplexity`, `noExcessiveLinesPerFunction` | 296 | The central `switch` per layer is the architecture (`orientation.md`, rule 2). |
| `noImportCycles` | 108 | The checker and emitter families recurse into each other by design. |
| `noNegationElse`, `useSimplifiedLogicExpression` | 111 | Taste. They reorder branches and De Morgan guard conditions, which makes a guard harder to read, not easier. |
| `noSubstr`, `useAtIndex` | 78 | They suggest methods that are not in the language's string and array surface. |
| `useForOf` | 7 | Six of the seven hits were argument parsers that consume a flag's value with `argv[++i]`, which a `for...of` cannot do. The seventh was rewritten. |
| `organizeImports` (assist) | 61 files | The reorder changes the order declarations reach the IR in: 36 of `src/`'s 69 modules came out different. The compiler's own IR stays byte-identical under a style change, so imports keep the order they are written in. |
| `noInferrableTypes` | 8 | In Nish, `const n: i32 = 0` is not redundant. The annotation picks the width. |
| tsc `noUncheckedIndexedAccess` | 2,574 | An out-of-range index in Nish panics instead of answering `undefined`, so `T` is the honest element type. |

To propose one of these, measure it again and put the number in the pull
request.

## Adding or changing a rule

- A new rule lands as an `error`, together with the fixes that make the tree
  clean for it. Never add one that turns `main` red.
- A rule never goes back to `warn`, or off, to get a pull request through. Fix
  the code.
- A suppression (`biome-ignore`, `shellcheck disable`) names its rule and says
  why, on the line above the code it covers.
- If a rule is wrong for Nish programs, turn it off in the Nish-program override
  and say here which construct its fix would produce.

## `git blame`

`.git-blame-ignore-revs` lists the commits that changed style and nothing else:
the Biome autofixes and the format pass. `git blame` skips them when
`git config blame.ignoreRevsFile .git-blame-ignore-revs` is set, and GitHub
reads the file on its own.
