# Linting

A rule a tool can check is checked by a tool, not by a reviewer. This file says
which rules those are and where each is enforced. It also has the runbook for
the one-time cleanup pass that turns them from warnings into errors.

`npm run lint` runs everything below. It is a CI gate (the `lint` job), so an
`error` fails the pull request and a `warn` does not.

## What checks what

| Tool | Reads | Config |
| --- | --- | --- |
| Biome | `self/`, `std/`, `bin/`, `tests/**/*.js`, `tests/self/**/*.ts`, `examples/`, `docs/cookbook/`, `docs/*.mjs`, `bench/`, `web/`, `scripts/`, `.claude/hooks/` | `biome.json` |
| `scripts/check-filenames.mjs` | every path `git ls-files` prints | the constants at its top |
| shellcheck | `scripts/*.sh`, `docs/cookbook/regen.sh`, `install.sh` | not wired in yet (step 6 of the cleanup) |

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
  Markdown, and directories. Only two kinds of name are exempt. An ALL-CAPS
  document (`README.md`, `LICENSE`, `CHANGELOG.md`, `docs/LANGUAGE.md`) keeps
  its capitals, and the fixture trees above keep their names.
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

**Mirrors of the language** (errors today, and `docs/wp0-validator.md` gives the
reasoning): `noVar`, `noExplicitAny`, `noEnum`, `noNamespace`, `noVoid`,
`noParameterAssign`, `useExplicitLengthCheck`, `useConsistentArrayType`
(`T[]`). `useOptionalChain` and `useExponentiationOperator` are off because
they push code towards `?.` and `**`, which Nish refuses.

**House style that is already clean** (errors): `useArrowFunction`,
`useShorthandFunctionType`, `useConsistentArrowReturn`.

**Guards that are errors from the start** (no hits when they were added):

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
- `noRestrictedImports`, for `self/` and `std/`: both ship, so neither may
  import from `tests/`, `scripts/`, `bench/` or `examples/`.

`tsconfig.json` (`npm run check`) adds `noImplicitReturns`,
`noFallthroughCasesInSwitch` and `allowUnreachableCode: false` to `strict`.
All three were clean when they were added.

**House style with a backlog** (warn, and error after the cleanup):

| Rule | Why | Found on 2026-09-26 |
| --- | --- | --- |
| `useBlockStatements` | Always put braces on `if`/`else`/loop bodies. A one-line body that grows a second statement then cannot silently fall out of the branch. | 894 |
| `useFilenamingConvention` (kebab only) | See Naming. | 144 |
| the `no-function-declaration` plugin | An arrow bound to a `const`, never a `function` declaration. | 142 |
| `noUnusedTemplateLiteral` | A template with no `${}` is a plain string. | 51 |
| `noShadow` | A local that hides an outer name is how a helper ends up reading the wrong `out` or `file`. | 42 |
| `noUnusedImports` | | 20 |
| `noNestedTernary` | Two levels of `?:` read better as an `if`. | 12 |
| `useNamingConvention` | See Naming. | 5 |
| `useForOf` | An index loop that only reads `a[i]` is a `for...of`. Tooling only. | 7 |
| `noEmptyBlockStatements`, `useAwait`, `noYodaExpression`, `useNumberNamespace`, `noExportedImports`, `useConst`, `noUselessElse`, `useShorthandAssign`, `noUselessStringConcat` | Small ones, five or fewer hits each. | 21 |
| `useConsistentTypeDefinitions`, `useConsistentMethodSignatures` | `type` over `interface`, and a function member written as a property. Off in Nish programs, where a struct is an `interface`. Every `.ts` file Biome reads today is a Nish program, so they have nothing to flag yet. | 0 |

**Guards with no hits today** (warn, flipped with the rest): `noForEach`,
`noUselessUndefinedInitialization`, `useCollapsedElseIf`, `useSingleVarDeclarator`, `useThrowNewError`,
`useThrowOnlyError`, `noDefaultExport` (named exports only), `noCommonJs` (ESM
only), `useNodejsImportProtocol` (`node:fs`), `noEvolvingTypes`,
`useErrorMessage`, `noUnusedPrivateClassMembers`.

**Off for Nish programs** (`self/`, `std/`, `examples/`, `docs/cookbook/`,
`bench/*.ts`, `tests/self/*.ts`). Following these rules there would give code
that the compiler refuses or compiles worse:

- `useShorthandAssign`: `+=` never concatenates in Nish
  (`reject_cf_compound_string`), and it needs both sides to have exactly the
  same numeric type. The Nish sources hold about 600 `x = x + ...`
  assignments, and the autofix would break the string ones.
- `useForOf`: an index loop can be the shape the bounds prover needs.
- `useNumberNamespace`: `parseInt` is the language's builtin.
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
| `noInferrableTypes` | 8 | In Nish, `const n: i32 = 0` is not redundant. The annotation picks the width. |
| tsc `noUncheckedIndexedAccess` | 2,574 | An out-of-range index in Nish panics instead of answering `undefined`, so `T` is the honest element type. |

To propose one of these, measure it again and put the number in the pull
request.

## Adding or changing a rule

- A new rule lands as `warn` with its count in the table above, or as `error`
  if the tree is already clean. Never add an `error` that turns `main` red.
- A rule that is `error` never goes back to `warn` to get a pull request
  through. Fix the code.
- If a rule is wrong for Nish programs, turn it off in the Nish-program override
  and say here which construct its fix would produce.

## The cleanup pass

Run this **once, when no other pull request is open**. It renames files and
touches almost every file in `self/`, so it conflicts with any open branch.
Delete this section when it is done.

1. **Rename files to kebab-case, and change nothing else.** Use `git mv` for
   every path `node scripts/check-filenames.mjs` names: 22 in `self/`, 111 in
   `docs/cookbook/` (with their `<!-- cookbook:begin <name> -->` markers in
   `docs/IR_COOKBOOK.md`), `tests/*.js`, `tests/self/`, `tests/ir/`,
   `tests/layout/`, `bench/`, and `runtime/runtime_{os,parallel,wasm}.c`. Then
   update every reference: imports, `tests/run.js`, `scripts/build.sh`,
   `package.json`, `.claude/*.md`, `docs/`, `CLAUDE.md`, `AGENTS.md`. Search
   with `git grep -n emit_arrays` for each old name. The seed compiles
   hyphenated module names, so `self/` builds with the renames (checked:
   `import { f } from "./emit-util"` compiles and links). The runtime `.c`
   files ship in the npm package. `--link` finds them itself, but anyone who
   links by hand is following the old names, so that commit is a
   `refactor(runtime)!` with a `BREAKING CHANGE:` trailer naming the new
   paths. When the step is done, the checker prints nothing.
2. **Apply the autofixes**: `npx biome lint --write .`, then
   `npx biome lint --write --unsafe --only=style/useBlockStatements .`. Read
   the diff of the second one before committing it.
3. **Fix the rest by hand**: `noShadow`, `useNamingConvention` and the rest of
   the small rules. Then fix the `function` declarations
   (`scripts/arrowify.mjs` rewrites them). Before that, add `std/`,
   `examples/*.ts`, `docs/cookbook/`, `bench/*.ts` and `tests/self/*.ts` to the
   plugin's override, so those files are converted in the same pass. After
   this step, `npm run lint -- --max-diagnostics=none` should report no
   warnings.
4. **Format everything once**: `npm run format`. On 2026-09-26, 73 files were
   not in Biome's style. `docs/IR_COOKBOOK.md` quotes each cookbook snippet's
   source, so run `docs/cookbook/regen.sh` after steps 1 to 4.
5. **Flip the switches** in one commit:
   - every `warn` above becomes `error`
   - the plugin's `severity = "warn"` becomes `"error"`, and its header
     comment stops describing the exemption
   - `--advisory` comes off `npm run lint`
   - `npm run lint` becomes `biome check .` with the formatter on, which makes
     formatting a gate
   - `assist.actions.source.organizeImports` goes on, after a check that the
     reorder leaves `self/`'s stage2 IR byte-identical
6. **Add the checks that need the cleaned tree**:
   - tsc `noUnusedLocals` and `noUnusedParameters` in `tsconfig.json`. There
     were 27 and 6 hits on 2026-09-26. Biome's unused-variable rules are off
     for Nish programs, so tsc is what catches them in `self/`.
   - knip, for unused files and exports (`npm run lint:dead`, and a CI step).
     On 2026-09-26 it found about 150 names exported from 42 `self/` modules
     that no other module imports. Before removing the `export`s, measure
     whether that moves the compiler's own IR: an unexported function can
     get internal linkage, which LLVM may inline or drop. Its "unused files"
     are the benchmark programs `bench/run.mjs` runs by name; list them in
     its `ignore`.
   - `npm run lint:fix` (`biome check --write .`).
   - A `PostToolUse` hook in `.claude/settings.json` that runs
     `biome check --write` on each file an agent edits. This is the
     same as a lefthook pre-commit step, with no new dependency.
     It waits for step 4, because before that it would reformat whole files
     that a change only touched.
7. **Drop the semicolons**, once the seed is a release that accepts code
   without them: set `javascript.formatter.semicolons` to `"asNeeded"` and
   run `npm run format`. On 2026-09-26 that was about 16,700 lines in `self/`,
   3,300 across `std/`, `examples/`, `docs/cookbook/` and `tests/nish/`, 1,700
   in `bench/`, and 6,700 in the tooling. The fixtures in `tests/cases/` keep
   theirs, because the formatter does not read them. Run the
   `docs/cookbook/regen.sh` and the stage2 IR check from step 5 again after
   it. If the release has not happened yet, leave this step for a second pass.
8. **Wire in shellcheck**: fix the 8 warnings `shellcheck -S warning` reports
   today, then add a CI step. Ubuntu runners ship shellcheck, and
   `pip install shellcheck-py` installs it locally.
9. **Verify** with `npm run check`, an undegraded `npm test` (which includes
   the self-host fixed point), `docs/cookbook/regen.sh --check` and
   `node docs/check-links.mjs`.
10. **Keep `git blame` useful.** Put the commit hashes from steps 2, 4 and 7 in a
   new `.git-blame-ignore-revs`. Land step 1 as its own commit, so that
   `git log --follow` sees pure renames.

When it is done, update this file: move the backlog rows to "errors", delete
the dates and counts, and delete this section. Then fix what
`.claude/node.md`, `.claude/typescript.md` and `docs/wp0-validator.md` say about
`warn` and about `--diagnostic-level=error`.
