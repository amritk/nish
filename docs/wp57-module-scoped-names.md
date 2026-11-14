# WP57: Module-scoped names

**Status: proposed, design only.** Nothing here is built, and the rule it
would change still holds:
[LANGUAGE.md](LANGUAGE.md#export-and-import) says a function name is unique
across the whole program, and where this note and LANGUAGE.md disagree,
LANGUAGE.md wins. The stages are in §8 and on
[the roadmap page](roadmap/wp57-module-scoped-names.md). S2 waits on a
decision (§6). The plan that tracks the stages is
[`.claude/plans/wp57-module-scoped-names.plan.md`](../.claude/plans/wp57-module-scoped-names.plan.md).

Every claim about today's compiler is anchored at commit `0bf1ddbb`, on
`main`. Read [wp5-modules.md](wp5-modules.md) first: whole-program compilation
is why a name is global. Then read [wp21-packages.md](wp21-packages.md) §9: it
gave every package its own symbol scope and left the root package's empty, and
that is the gap this note is about.

## 1. The problem

Two files of one program cannot each keep a private `helper`. A private
function's name has to be unique across the whole program, exported or not
(`tests/link/duplicate_internal`, NL3026). Inside a dependency, the name has to
be unique across that package (NL3027). WP21 S1 made symbols package-scoped,
but the root package's prefix is empty (wp21-packages.md §9). So inside one
package, the compiler included, every name is global.

At 139k lines in `src/` (128 files) that is tolerable. Everything is prefixed
by hand: `emitJsonCall`, `emitClassType`, `tsEmitStorage`. At 300k lines, with
a dozen emitters (`src/` already has 25 `emit*.ts` files) that each want a
private `emitModel` or `escapeString`, the hand prefixing becomes the naming
scheme. The same holds for any user program that grows past a few dozen
modules.

The rule does not come from name lookup. It comes from the emitted symbol
(§2). So the fix is to change the symbol and leave the language's scoping as
it is.

## 2. What exists today

**Name lookup is already per module.** `Checker.nameTaken`
(`src/checker.ts`) asks only the module's own tables (aliases, enums, structs,
templates, signatures, constants), and a second declaration is refused as
`` `x` is already declared in this module ``. A call is bound to a
`FunctionSig` object, not to a string. Nothing a user writes is ambiguous when
two modules share a name.

**The emitted symbol is global, and the facts are keyed by it.**
`FunctionSig.name` is the LLVM symbol. `analyzeFunctions` (`src/attributes.ts`)
gathers each function's purity, `willreturn`, escape and pointer facts, then
propagates them over the cross-module call graph into a `FactsTable` "keyed by
LLVM symbol, so a caller in one module sees exactly what the exporter proved".
Two functions with one symbol would each be emitted with the other's
attributes. That is a silent miscompile, not a link error. So
`Compilation.rejectSymbolClashes` (`src/compilation.ts`) refuses the program,
whatever `--strict-exports` says:

| Code | Refuses |
| --- | --- |
| NL3026 | two functions of the root package, not both exported |
| NL3027 | the same, inside a dependency package |
| NL3024 | two exported functions of the root package |
| NL3025 | the same, inside a dependency package |
| NL3010 | two generic templates of one package and name: an instantiation is named after its template |

**`Checker.qualifySymbols` already renames.** At the end of pass 1 it prefixes
every function, method and constructor a module defines with
`program.symbolPrefix`. A `declare function` and an instantiation are left
alone. The prefix comes from `packageSymbolPrefix` (`src/packages.ts`): empty
for the root package, `pkg_a.` for a dependency. Since it is the one line that
spells a defined function's symbol, it is where a module qualifier's spelling
belongs. It cannot make the decision, though. It runs once per module, during
load, and whether a name clashes is a whole-program fact (§4b).

**Renaming only when needed has precedent.** `spellCSymbolsApart`
(`src/generics.ts`) runs once pass 3 has drained. It gives a private function
whose name C reserves the spelling `abs$`, and a generic one's instantiations
`labs$i32` ([LANGUAGE.md "Calling C"](LANGUAGE.md#calling-c),
`tests/link/ffi_package_declare_apart`). Every other function keeps its name.
A program that never needed the rename emits what it always did.

**Generic templates have their own clash check.** In `rejectSymbolClashes`, a
template is keyed by `symbolPrefix + template.sourceName`, because
`instanceSymbol` (`src/generics.ts`) names every instantiation
`<template symbol>$<mangled type arguments>`. A function template's
instantiations are minted only once bodies are checked, from pass 2 on
(`src/generics.ts`, the comment above `checkConstraints` in the
function-instantiation path), and each reads its prefix off the template's
home program. An instantiation of an *exported* template is exported itself
(`sig.exported = template.exported`), so it is on the C surface.

**Class and interface names are program-wide for a deeper reason.**
`%struct.<name>` is a module-level LLVM type, and the type table identifies a
struct by its name (`TypeTable.names`, `src/types.ts`). So two packages that
declare `Node` would share one layout. `declaredStructs` and
`rejectInstantiatedStructClashes` (`src/compilation.ts`) refuse that (NL3028
for a declared class or interface, NL3013 for a generic class's instantiation),
`rejectCollectionsClash` refuses a module's own `Map` or `Set` beside the global
one for the same reason (NL3030), and a class cannot be renamed on import because "the type name is part
of the ABI" (`src/checker.ts`, `tests/link/class_import_rename`).
wp21-packages.md §9c left this deliberately.

**The C surface is the root package's exports.** `externalFunctions`
(`src/interop-abi.ts`) builds what `--emit-header`, `--emit-dts` and
`--emit-napi` describe. It takes every root-package function that
`privateAbi` (`src/emit-result.ts`) does not hide: the exported ones, plus every other one under
`--no-strict-exports`. A dependency's exports are already prefixed
(`@pkg_a.scale` in `tests/link/two_packages/expected.ir`) and stay off the
surface. So "exported functions keep their bare symbols" is true of the root
package only, and that is the case S2 is about.

**`--emit-ts` needs nothing.** `outputPathOf` (`src/emit-ts.ts`) writes one
ES module per source module. The composer (`src/emit-ts-edits.ts`) edits the
source text and reads only `sourceName`, never `sig.name`. Two modules that
each keep a private `helper` already come out as two files, each with its own
`helper` in its own module scope. Today `rejectSymbolClashes` stops them
first.

**Who sees a symbol.** A changed symbol is visible in these places, and in no
others the inventory found:

- Debug info. `DISubprogram`'s `name:` is `sig.sourceName` and its
  `linkageName:` is the symbol (`src/debug.ts`). A debugger's backtrace shows
  the source name. A profiler such as `perf` reads the ELF symbol table, so it
  shows the symbol.
- A `spawn` task's thread. The arrow is lifted as
  `` `${enclosing.name}$arrow${n}` `` (`src/generics.ts`), so it inherits the
  enclosing function's symbol. LANGUAGE.md says this "is the name a debugger
  or a profiler shows for the task's thread".
- `--json` reports. The panic-site report emits `name` (the source name) and
  `symbol` (`src/panics.ts`). The capability report emits both too
  (`src/capability-report.ts`).
- `nish run`'s rebuild cache keys on each module's IR (`src/run-cache.ts`).
  The symbol enters it only as IR text, so a rename is just a changed module.

**The rolling freeze.** `src/` is built by the last release
([CLAUDE.md](../CLAUDE.md), `build/seed/`). `src/` cannot rely on a new rule
until the release that ships it becomes the seed. CI's `bootstrap` job checks
that.

## 3. The decision this note proposes

**Qualify a symbol with its module only when the bare symbol would clash.**
Today no program that compiles has a clash, because every clash is refused. So
the rename reaches no program that compiles today: no golden `.ll` moves, no
`tests/self/goldens/checked/` file moves, and no nish-cmp corpus program's IR
moves. The proof is by construction, not by measurement, and S1's runs confirm
it (§5a).

Three kinds of name need three different answers:

| Name | Stage | Why separate |
| --- | --- | --- |
| A private function or generic template | S1 | Its symbol is the compiler's own business: `internal`, on no host's surface |
| An exported function, or exported template, of the root package | S2 | Its symbol is the C ABI. Changing it is the maintainer's call |
| A class or interface | S3 | Its name is a *type's* identity, not only a symbol's |

## 4. S1: private functions and generic templates

### 4a. The spelling

A clashing symbol becomes
`<package prefix><module qualifier>$.<name>`. The module qualifier is the
module's path from its package root (the entry's directory for the root
package), without `.ts`, with every character outside `[A-Za-z0-9_]` written
as `_`, and a leading digit given a `_`, by the same rules as
`packageSymbolPrefix`. A private `helper` in `lib/util.ts` becomes
`@lib_util$.helper`. In a dependency it becomes `@pkg_a.lib_util$.helper`.

- The emitter writes symbols unquoted (`@${sig.name}`), so the spelling stays
  within LLVM's bare-name characters, `[A-Za-z0-9_.$]`. A `/` would need
  quoting everywhere.
- `$.` follows the existing conventions. A `$` is what C cannot spell and no
  declared name holds (`spellCSymbolsApart`'s comment), and a `.` is already
  how a package and a method's owner are joined. `spellCSymbolsApart` skips any
  name that holds either, so a qualified name is never given a second `$`.
- Instantiations and lifted arrows follow without new code:
  `lib_util$.identity$i32`, `lib_util$.work$arrow0`.
- **The mangling is not injective**: `lib/util.ts` and `lib_util.ts` give one
  qualifier. That is harmless for the reason wp21-packages.md §9c gives for
  `@scope/hash`. The clash check runs over the *qualified* symbols (§4c), so a
  residual collision is refused by name, never miscompiled.

### 4b. The decision, and where it runs

A new step, `Compilation.qualifyClashingSymbols`, runs once every module has
loaded (pass 1 and `qualifySymbols` included) and before `bindImports`. At
that point each program's `functions` and `templateList` hold only what the
module declares. Pass 1b appends imported signatures later. The step groups
every defined, non-foreign free function's symbol and every function
template's symbol by spelling. A method or constructor (`sig.owner !== null`)
is left out: its symbol is `Owner.method`, scoped by its class's name, which
is S3's, and `--emit-header` gives it an asm label of that spelling. So is a
generic method's template, keyed `Owner.method` in `templateList`
(`src/generics.ts`). For each spelling held by more than one definition:

- every **private** party is qualified, both of two private ones included, so
  which module keeps the bare name never depends on load order;
- an **exported** party keeps its bare symbol;
- a private function named `main` in a module other than the entry is
  qualified rather than refused (today the message says it "collides with the
  entry wrapper `@main`"). An *exported* `main` outside the entry stays
  refused as today, since an exported party keeps its bare symbol and the
  wrapper owns `@main`.

Two constraints decide where the step goes:

- **Before any function instantiation exists.** Function instantiations are
  minted from pass 2 on (§2), so a template qualified here passes its spelling
  to every instantiation. The prefix an instantiation reads moves from the
  template's home program to the template itself (`src/generics.ts`, the
  `symbolPrefix` read in the instantiation path). Class-template members are
  minted in pass 1, but they are S3's.
- **The rename itself stays in `src/checker.ts`.** `qualifySymbols` grows a
  sibling, `qualifyClashing(qualifier, names)`. That way a symbol is still
  spelled only in the checker, and `Compilation` only decides.

`--no-strict-exports` is the exception. There, every function of the root
package is external and on the C surface (`privateAbi`), so a private function
is a C symbol like an exported one. S1 leaves clashes in that mode refused,
with NL3026 and NL3027 as today.

### 4c. Clash checks run over the qualified symbols

`rejectSymbolClashes` keeps its shape and keys on the final symbol. The
template loop reads the template's qualified symbol instead of
`symbolPrefix + sourceName`. What it still refuses:

- two exported functions of one package and name (NL3024, NL3025: S2's
  question);
- two exported templates of one package and name (NL3010: their
  instantiations are exported, so this is S2's question too);
- any clash under `--no-strict-exports` (NL3026, NL3027);
- a residual collision of two qualified symbols (§4a), reported by NL3026 or
  NL3027 with both files named.

The codes keep their numbers. `src/codes.ts` keys a code on its message's
longest literal run, so if S1 rewords a message to name
`--no-strict-exports`, `node scripts/gen-diagnostic-codes.mjs` must keep the
number, and `tests/wordings/` keeps a case per code.

### 4d. Tests

| Test | Change |
| --- | --- |
| `tests/link/duplicate_internal` | **Turns positive**: `expected.code` (`main` returns `add(twice(20), 2)` = 42; `add` is `+` in both, so this pins only that it compiles) and `expected.ir` with `@helper$.add` and `@main$.add` |
| `tests/link/duplicate_export` | **Stays negative**: two exported `f` are NL3024 until S2 |
| `tests/link/module_private_helpers` (new) | Modelled on `two_packages`. Three modules, each with a private `helper` that computes something different (`n + 1`, `n - 1`, `n - 42`) and an export that calls it. The exit code is 7 only if each call reached its own. `expected.ir` pins the three qualified `define internal` lines |
| `tests/link/module_private_generic` (new) | Two modules, each with a private `identity<T>` returning differently, so the exit code proves `a$.identity$i32` and `b$.identity$i32` are two |
| `tests/link/module_private_mixed` (new) | A private `helper` beside another module's exported `helper`: the export keeps `@helper` and the private one is qualified |
| `tests/link/module_private_no_strict` (new, negative) | `--no-strict-exports` with two private `helper`s: still NL3026 |
| `tests/link/module_private_spawn` (new) | A task spawned from a qualified function. Its lifted arrow is `@m$.work$arrow0` in `expected.ir` |
| `tests/wordings/nl3026_function_clash`, `nl3027_package_function_clash` | Become accepted under the default flags. Each gains a `.args` of `--no-strict-exports` so it still pins its code |
| `tests/wordings/nl3010_generic_redeclared` | Its private `identity` meets `wordings_generic.ts`'s exported one, which S1 accepts. It is rewritten so both are exported |

Then `node tests/run.js link`, `wasi` and `performance` (it changes `src/`),
`node tests/self/goldens.js --update` (no diff expected), and nish-cmp (no
diff expected, so no `DECLARED` entry).

### 4e. What must move with it, in the same PR

- **LANGUAGE.md**, "`export` and `import`": the bullet "A function name is
  unique across the whole program" becomes the S1 rule. Also "Calling C",
  beside `abs$`, gains the qualified spelling, and the `spawn` paragraph that
  names `main$arrow0` "the name a debugger or a profiler shows" says a
  qualified function's task shows the qualified name.
- **docs/ARCHITECTURE.md**, the `--strict-exports` bullet: the clause "a
  function *symbol* is unique across the program in either mode" now holds of
  the *qualified* symbol, and `--no-strict-exports` keeps the old rule.
- **docs/wp5-modules.md**, "Linkage": the bolded rule gets a "since WP57 S1"
  paragraph. The history above it stays.
- **docs/AI.md**: the bullet "A function name is unique across the whole
  program" is the rule card's, and `npm test` compiles its examples.
- **docs/guide/language/modules.md**: "Two files of your program cannot each
  have a private `helper`" becomes what it can now do, with an example.
- **docs/reference/**, regenerated: the language pages and the NL3010, NL3026
  and NL3027 diagnostic pages move with LANGUAGE.md and `tests/wordings/`.
- Source comments that state the old rule: `exposeTo` in `src/generics.ts`
  ("A function's symbol is already unique across the program"), the header of
  `src/packages.ts`, `clashMessage` in `src/compilation.ts`, and the comment
  in `tests/link/duplicate_internal/main.ts`.

### 4f. Cost

| | |
| --- | --- |
| Files touched in `src/` | `compilation.ts` (the new step, the template key in `rejectSymbolClashes`, `clashMessage`), `checker.ts` (`qualifyClashing`), `generics.ts` (the instantiation's prefix read off the template), `packages.ts` (`moduleSymbolQualifier`, beside `packageSymbolPrefix`), `codes.ts` if a message is reworded. About 150 lines with comments |
| Tests | 1 flipped positive, 5 new link tests, 3 wording fixtures changed |
| IR | No program that compiles today moves (§3). The new tests' `expected.ir` are the only new IR |
| Seen by a user | A program that was refused now compiles. `perf` and the `--json` reports show `m$.helper` for a function that clashed |
| Release note | `feat(checker): two modules may each keep a private function or generic of one name`, a minor bump. Not breaking: every program that compiled still compiles to the same IR |

## 5. The compiler benefits one release later

`src/` is built by the seed, so S1 lands without `src/` using it (the rolling
freeze, §2). Once the release that ships S1 is the seed, a module of `src/`
may keep a private `escapeString` or `emitModel` beside another's, and the
hand prefixes can go module by module. Each such rename moves `src/`'s IR and
so the goldens. It is a refactor PR of its own, not part of S1, and not
required by it.

### 5a. Why no IR moves

`rejectSymbolClashes` runs before any body is checked and refuses every
clash. So every program on `main`, the nish-cmp corpus, `src/` and every
golden has no two definitions with one symbol, and §4b renames only symbols
that have two. S1 confirms this by running nish-cmp and the goldens update
with no diff. A diff there is a bug in S1, not a declared change.

## 6. S2: exported names that clash inside one package *(open question)*

Two modules of the root package that each export `f` are NL3024 today. Inside
a package, `import { f } from "./a"` already says which `f` is meant, so the
refusal protects only the C surface. Every root-package export is on that
surface (§2), and C has one namespace. The options:

| Option | What it does | Costs |
| --- | --- | --- |
| **A. Keep refusing** | No change. An export's name is the C ABI and is unique across the program | Nothing to build. Users rename exports by hand, which is what the problem statement objects to, but only for exports |
| **B. Only the entry's exports are the C surface** | `externalFunctions` takes the entry module's exports alone, the way it already takes no dependency's. Every other module's export is "importable" only, and S1's rule applies to it | `src/interop-abi.ts` and the sidecar tests that export from a non-entry module (`range_export_header`, `_dts`, `_napi`, `_napi_async` and their kind; S2 counts them). It is **breaking**: a C driver that calls a non-entry module's export loses it from the header, and under default flags the symbol is no longer guaranteed bare. It needs a way to put a function back, and that is `export { f } from`, which the language does not have (wp21-packages.md §10d) |
| **C. Qualify on clash in a closed-world build only** | Under `--link`, native, no sidecar and no `declare function` (ARCHITECTURE.md's closed-world rule), `export` already means only "importable", so S1's rule applies to exports there. An open build keeps NL3024 | The rule depends on build mode: a program that links may then fail with `--emit-header`. Small in `src/` (`compilation.ts`, reading `hostVisible` in `src/visibility.ts`). One new pair of link tests |
| **D. Qualify on clash, with a chosen C name** | Both exports are kept, and the header names each with a mangled C name and an asm label, as it does for `Point.shifted` | A host's C name for a function changes when an unrelated module adds a clashing export, which is an ABI break nobody asked for. It needs a mangling for C, `.d.ts` and N-API, and docs for all three. The largest of the four |

The note's lean is A until a program needs more, then B together with
`export { f } from`. That keeps the C surface a list someone wrote rather than
an accident of which names clash. Exported generic templates (NL3010 between
two exports) go with whichever option is chosen, because their instantiations
are exported.

## 7. S3: module-scoped class and interface names

A class name is a type's identity, so S3 is not a rename. Type identity
becomes (module, name). Qualifying only on clash still keeps every existing
program's IR, but every place that reaches a struct *by name* has to take a
module too. What the inventory found:

| Where | What changes |
| --- | --- |
| The type table: `TypeTable.names` / `displays`, `typeName` (`src/types.ts`) | A struct's key becomes (module, name). `typeName` stays the source name for diagnostics |
| The per-module struct registry: `CheckedProgram.struct`, `addStruct`, `addStructTemplate`, `addStructInstance` (`src/program.ts`), registered from `src/structs.ts` | Lookups that cross a module boundary take the owning module |
| Cross-module layouts: `registerForeignLayouts` (`src/generics.ts`, four callers) | Registers under the qualified identity |
| `%struct.<name>`: 21 files of `src/` spell it. The emitters are `emit.ts`, `emit-classes.ts` (definition, opaque), `emit-arrays.ts`, `emit-json.ts`, `emit-parallel.ts`, `emit-result.ts`, `emit-root.ts`, `emit-secret.ts`, `emit-shm-window.ts` and `emit-strings.ts`. The others are `attributes.ts`, `checker.ts`, `compilation.ts`, `debug.ts`, `generics.ts`, `interop-header.ts`, `program.ts`, `result.ts`, `runtime.ts`, `structs.ts` and `types.ts` | Each spells, or matches on, the qualified struct name |
| `Owner.method` and constructor symbols (`src/structs.ts`, one site for declared classes and one for template members) | The owner's qualified name, so S1's rule follows for members |
| The clash checks (`src/compilation.ts`): `declaredStructs` and `rejectInstantiatedStructClashes` (NL3028), `reportTemplateClash` (NL3013), `rejectCollectionsClash` (NL3030, a module's own `Map` or `Set` beside the global one), and the member clashes NL3022 and NL3023, which those preempt (`tests/wordings/unreachable.txt`) | Rewritten over qualified names. Most of their refusals go |
| `--emit-header` (`src/interop-header.ts`, `cStructName(info.name)`) | C has one struct namespace, so an exported class that clashes needs S2's answer. A private one is not on the header |
| `--emit-dts` and N-API (`src/interop-dts.ts`, `src/interop-napi.ts`) | The inventory found no struct naming there by `info.name`. S3 must confirm how a class reaches a `.d.ts` or an N-API wrapper before sizing it |
| Typed JSON (`src/json-typed.ts`, `jsonRouteCallees`, `src/emit-json.ts`) | Messages name the type, and the decoder's reach set must key on the qualified identity |
| Renaming a class on import (`src/checker.ts`, `tests/link/class_import_rename`) | Becomes possible once the name is no longer the ABI. This is a language change in its own right: LANGUAGE.md, AI.md and the guide's "cannot be renamed on import" |

**Size.** In `src/`, 37 files call `typeName(` and 26 look a struct up by name
(`.struct(`, `structs.get(`). The sets overlap, so S3 reaches on the order of
40 of `src/`'s 128 files, the 21 that spell `%struct.` among them.
That is several times S1, with the interop surface on top, and its class half
depends on S2's decision. It should be split into its own stages once S1 and S2
have landed, and it is not one PR. Release note when it ships: `feat(checker):
two modules may each keep a private class or interface of one name`, plus
whatever S2's option costs for exported classes.

## 8. Stages

| | Stage | Status |
| ---: | --- | --- |
| S1 | Private functions and generic templates qualified by their module when they would clash (§4) | Proposed |
| S2 | Exported names that clash inside one package and are not on the C surface (§6) | *(open question)* |
| S3 | Module-scoped class and interface names, type identity (module, name) (§7) | Proposed, large; to be split |

**S1's gate:** `tests/link/duplicate_internal` passes as a positive test,
`duplicate_export` still fails with NL3024, the five new link tests pass, the
wording fixtures pin NL3010, NL3026 and NL3027, nish-cmp and
`tests/self/goldens.js --update` show no diff, and `node tests/run.js wasi` and
`performance` pass. Every doc in §4e says the new rule.

**S2's gate** depends on the option. For B or C: `duplicate_export` turns
positive under the builds the option allows and stays NL3024 under the ones it
does not, and every sidecar test still describes exactly the surface it did,
or a declared, release-noted change.

**S3's gate:** two modules each declaring a private `class Node` with
different fields compile, link, and read each field at its own offset (an exit
code that only comes out right if so), and `--emit-header`, `--emit-dts` and
`--emit-napi` are unchanged for every program that compiles today.

## 9. Not planned

- **Versions in a symbol's identity.** Reading a version means reading a
  manifest, which wp21-packages.md §6 refused, and two copies of one package
  are not supported (wp21-packages.md §9c).
- **Always qualifying every symbol.** It would move every golden `.ll`, every
  nish-cmp program, the `--emit-header` asm labels and every profile a user
  has taken, to buy nothing for a program with no clash. That is the trade
  wp21-packages.md §9 made for packages, for the same reason.
