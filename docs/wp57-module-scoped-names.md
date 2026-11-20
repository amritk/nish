# WP57: Module-scoped names

**Status: S1 built (#1812); S2 decided, keep refusing (§6); S3 split into
five stages, none built (§7, §8).** Two modules may each keep a private
function or generic template of one name: a clashing one's symbol is
qualified by its module path (§4), as
[LANGUAGE.md](LANGUAGE.md#export-and-import) states. Exported names stay
unique across their package, by decision (§6). Class and interface names are
still unique across the program until S3d. Where this note and LANGUAGE.md
disagree, LANGUAGE.md wins. The stages are in §8 and on
[the roadmap page](roadmap/wp57-module-scoped-names.md).

§1 to §5 were written against commit `0bf1ddbb`, on `main`, and §4 is
corrected to what S1 merged as (`936ba0b1`). §6 to §8 are anchored at
`936ba0b1`, `main` after S1. Read [wp5-modules.md](wp5-modules.md) first:
whole-program compilation is why a name is global. Then read
[wp21-packages.md](wp21-packages.md) §9: it gave every package its own symbol
scope and left the root package's empty, and that is the gap this note is
about.

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

## 3. The decision

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
| An exported function, or exported template, of the root package | S2 | Its symbol is the C ABI. Decided: it stays unique across its package (§6) |
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
The path is taken relative to that root, so a module outside it keeps its
`..` steps, each `.` and `/` written as `_`: `nish app/main.ts` importing
`../shared/u.ts` gives `@___shared_u$.helper` however the entry is named
(`app/main.ts`, `main.ts` from inside `app/`, or an absolute path), and no
machine's directory reaches a symbol.

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
module declares. Pass 1b appends imported signatures later. As built, the
step asks one predicate, `qualifiesClashing` (`src/generics.ts`), of every
defined, non-foreign free function: is it private, under `--strict-exports`,
and does another free function or function template of its package (or, for
a `main` outside the entry, the entry wrapper) take the same bare symbol? It
counts the parties by source name in each peer module's own tables, so
renaming one function never changes the answer for the next. A method or constructor (`sig.owner !== null`)
is left out: its symbol is `Owner.method`, scoped by its class's name, which
is S3's, and `--emit-header` gives it an asm label of that spelling. So is a
generic method's template, keyed `Owner.method` in `templateList`
(`src/generics.ts`). For each name held by more than one definition:

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
  to every instantiation. As built, a template is not renamed here at all:
  `templateSymbol` (`src/generics.ts`) asks the same predicate whenever pass 2
  or 3 mints an instantiation, and builds the base from it. Class-template
  members are minted in pass 1, but they are S3's.
- **The rename of a function stays in `src/checker.ts`.** `qualifySymbols`
  has a sibling, `qualifyClashing(peers, modulePath, entryPath)`, which spells
  `<prefix><qualifier>$.<name>` with `moduleSymbolQualifier`
  (`src/packages.ts`). `Compilation.qualifyClashingSymbols` only runs it for
  each module.

`--no-strict-exports` is the exception. There, every function of the root
package is external and on the C surface (`privateAbi`), so a private function
is a C symbol like an exported one. S1 leaves clashes in that mode refused,
with NL3026 and NL3027 as today.

### 4c. Clash checks run over the qualified symbols

`rejectSymbolClashes` keeps its shape and keys on the final symbol. The
template loop reads the template's qualified symbol instead of
`symbolPrefix + sourceName`. What it still refuses:

- two exported functions of one package and name (NL3024, NL3025:
  S2, kept by decision, §6);
- two exported templates of one package and name (NL3010: their
  instantiations are exported, so S2 keeps this too);
- any clash under `--no-strict-exports` (NL3026, NL3027);
- a residual collision of two qualified symbols (§4a), reported by NL3026 or
  NL3027 with both files named.

The codes keep their numbers. `src/codes.ts` keys a code on its message's
longest literal run, so if S1 rewords a message to name
`--no-strict-exports`, `node scripts/gen-diagnostic-codes.mjs` must keep the
number, and `tests/wordings/` keeps a case per code.

### 4d. Tests

What S1 merged (#1812): one test flipped positive, seven new link programs
and one shared module directory, and three wording fixtures changed.

| Test | Change |
| --- | --- |
| `tests/link/duplicate_internal` | **Turned positive**: `expected.code` 42 (`main` returns `add(twice(20), 2)`; `add` is `+` in both, so this pins only that it compiles) and `expected.ir` with `@helper$.add` and `@main$.add` |
| `tests/link/duplicate_export` | **Stays negative**: two exported `f` are NL3024 (§6) |
| `tests/link/module_private_helpers` (new) | Modelled on `two_packages`. Three modules, each with a private `step` that computes something different (`n + 1`, `n - 1`, `n - 42`), two of them behind an export that calls it. The exit code is 7 only if each call reached its own. `expected.ir` pins `@up$.step`, `@down$.step` and `@main$.step` |
| `tests/link/module_private_generic` (new) | Two modules, each with a private `identity<T>` returning differently, so the exit code, 9, proves `a$.identity$i32` and `b$.identity$i32` are two |
| `tests/link/module_private_mixed` (new) | A private `helper` beside another module's exported `helper`: the export keeps `@helper` and the private one is `@main$.helper` |
| `tests/link/module_private_no_strict` (new, negative) | `--no-strict-exports` with two private `helper`s: still NL3026 |
| `tests/link/module_private_spawn` (new) | A task spawned from a qualified function. Its lifted arrow is `@m$.work$arrow0` in `expected.ir` |
| `tests/link/module_private_residual` (new, negative) | `lib/util.ts` and `lib_util.ts` each keep a private `helper`. Both qualify to `lib_util$.helper`, and the clash check over the qualified symbols refuses it (§4a) |
| `tests/link/module_private_outside` (new) | The entry imports `../module_private_shared/u.ts`, outside its directory, so that module's private `helper` is `@___module_private_shared_u$.helper` |
| `tests/link/module_private_shared` (new, no `main.ts`) | The module `module_private_outside` imports. It is not a program of its own |
| `tests/wordings/nl3026_function_clash`, `nl3027_package_function_clash` | Accepted under the default flags now. Each gained a `.args` of `--no-strict-exports` so it still pins its code |
| `tests/wordings/nl3010_generic_redeclared` | Its private `identity` met `wordings_generic.ts`'s exported one, which S1 accepts. It was rewritten so both are exported |

S1 also ran `node tests/run.js link`, `wasi` and `performance` (it changes
`src/`) and `node tests/self/goldens.js --update`, which moved the checked
goldens of five of the six `src/` modules it edited (`codes.ts`'s did not
move) and nothing else. nish-cmp showed no diff
for any program the seed compiles. It declares the six new positive programs
above (`duplicate_internal` and five `module_private_*`), which the 0.42.0
seed refuses and only the candidate compiles, as `DECLARED` entries in
`tests/nish-cmp.js` under S1's release-note words.

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
| Files touched in `src/` | `compilation.ts` (`qualifyClashingSymbols`, the template key in `rejectSymbolClashes`, `clashMessage`), `checker.ts` (`qualifyClashing`), `generics.ts` (`qualifiesClashing`, `templateSymbol`, the instantiation's base read off the template), `packages.ts` (`moduleSymbolQualifier`, beside `packageSymbolPrefix`), `codes.ts` (the NL3026 and NL3027 keys, for their reworded messages) and `attributes.ts` (a comment). 264 lines added and 35 removed, comments included |
| Tests | 1 flipped positive, 7 new link programs and 1 shared module, 3 wording fixtures changed, 6 nish-cmp `DECLARED` entries |
| IR | No program that compiled before moves (§3). The new tests' `expected.ir` are the only new IR |
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

`rejectSymbolClashes` ran before any body was checked and refused every
clash. So every program on `main` before S1, the nish-cmp corpus, `src/` and
every golden had no two definitions with one symbol, and §4b renames only
symbols that have two. S1 confirmed this: nish-cmp showed no diff for any
program the seed compiles, and the goldens update moved only the modules S1
edited (§4d). The programs nish-cmp declares are new ones the seed refuses.

## 6. S2: exported names that clash inside one package *(decided: keep refusing)*

**Decided at WP57's sign-off: option A.** An exported name stays unique
across its package. Nothing is built for S2. What stays refused, with the codes
S1 left (§4c):

- two exported functions of the root package with one name (NL3024), and the
  same inside a dependency (NL3025);
- two exported generic templates of one package and name (NL3010): their
  instantiations are exported, so they are the same question;
- under S3, two exported classes or interfaces of one name (NL3028), and two
  that reach the C surface another way (§7, S3d).

A private party beside an exported one is already S1's case: the export keeps
its bare symbol and the private one is qualified (`module_private_mixed`).

**Why A.** Inside a package, `import { f } from "./a"` already says which `f`
is meant, so the refusal protects only the C surface. Every root-package
export is on that surface (§2), and C has one namespace. Of the options below,
A is the only one that keeps that surface exactly what it is today, and no
program has yet needed more. The cost is that two modules cannot both export
an `f`, so a user renames one export by hand. That is what §1 objects to, but
only for exports, which are few and are an interface someone chose.

The options that were weighed:

| Option | What it does | Costs |
| --- | --- | --- |
| **A. Keep refusing** | No change. An export's name is the C ABI and is unique across the program | Nothing to build. Users rename exports by hand, which is what the problem statement objects to, but only for exports |
| **B. Only the entry's exports are the C surface** | `externalFunctions` takes the entry module's exports alone, the way it already takes no dependency's. Every other module's export is "importable" only, and S1's rule applies to it | `src/interop-abi.ts` and the sidecar tests that export from a non-entry module (`range_export_header`, `_dts`, `_napi`, `_napi_async` and their kind; S2 counts them). It is **breaking**: a C driver that calls a non-entry module's export loses it from the header, and under default flags the symbol is no longer guaranteed bare. It needs a way to put a function back, and that is `export { f } from`, which the language does not have (wp21-packages.md §10d) |
| **C. Qualify on clash in a closed-world build only** | Under `--link`, native, no sidecar and no `declare function` (ARCHITECTURE.md's closed-world rule), `export` already means only "importable", so S1's rule applies to exports there. An open build keeps NL3024 | The rule depends on build mode: a program that links may then fail with `--emit-header`. Small in `src/` (`compilation.ts`, reading `hostVisible` in `src/visibility.ts`). One new pair of link tests |
| **D. Qualify on clash, with a chosen C name** | Both exports are kept, and the header names each with a mangled C name and an asm label, as it does for `Point.shifted` | A host's C name for a function changes when an unrelated module adds a clashing export, which is an ABI break nobody asked for. It needs a mangling for C, `.d.ts` and N-API, and docs for all three. The largest of the four |

**What would reopen it.** A program that needs two exported functions of
one name in one package. The way forward then is B together with
`export { f } from`, which the language does not have yet
(wp21-packages.md §10d): only the entry's exports are the C surface, a module
puts another module's function on it by re-exporting it, and S1's rule
applies to every export that is not on it. That keeps the C surface a list
someone wrote, not an accident of which names clash. It is breaking (B's row),
so it is a work package of its own with a release note that says so, and the
sidecar tests that export from a non-entry module are counted then. C was
rejected because a program that links would then fail with `--emit-header`,
and D because a host's C name would change when an unrelated module adds an
export.

## 7. S3: module-scoped class and interface names

A class name is a type's identity, so S3 is not a rename. A struct gets a
symbol, its spelling in the IR and in its members' symbols, separate from its
source name. A private class or interface that would clash gets a qualified
symbol, the way S1 qualifies a function, and every program with no clash keeps
its IR. Exported classes stay unique across their package (§6).

### 7a. Inventory

Re-checked against `936ba0b1`, `main` after S1. `src/` has 137 files.

| Where | What reaches a struct by name | What S3 changes |
| --- | --- | --- |
| The type table (`src/types.ts`) | `names[]` is a struct's identity and its spelling. `structOf(name)` interns under `K_STRUCT` and the name (17 sites in 9 files). `llvmType` spells `%struct.${names[type]}*` in one place. `displays[]`, set by `setDisplayName` (3 sites, in `types.ts` and `generics.ts`), is today only an instantiation's display. `typeName` and `nameOf` (82 sites in 31 files) read them | `names[]` holds the symbol. Every struct gets a display, its source name, so `typeName` keeps printing what the user wrote |
| The per-module registry (`CheckedProgram.struct`, `addStruct`, `addStructTemplate`, `addStructInstance` in `src/program.ts`, registered from `src/structs.ts`) | Keyed by source name inside a module. 71 `.struct(` lookups in 29 files, and one file with `structs.get(` | Unchanged inside a module. What crosses a module carries the struct, not its name |
| Cross-module layouts (`registerForeignLayouts`, `src/generics.ts`) | Four callers (lines 1074, 1117, 1370, 1990) register a foreign struct's layout under its name | Register under the symbol |
| `%struct.` | 21 files spell it: `attributes`, `checker`, `compilation`, `debug`, `emit`, `emit-arrays`, `emit-classes`, `emit-json`, `emit-parallel`, `emit-result`, `emit-root`, `emit-secret`, `emit-shm-window`, `emit-strings`, `generics`, `interop-header`, `program`, `result`, `runtime`, `structs` and `types` | Each spells the symbol, or matches a runtime struct whose name never changes |
| `info.name` | 169 sites in 29 files, some a spelling and some a message | A spelling reads the symbol, a message the source name |
| Member symbols | A method is `${owner.name}.${name}` (`src/structs.ts:926`), a constructor `${owner.name}.constructor` (`:1022`), a template's member through `collectMethodSignature` (`src/generics.ts:1535`). Each already has a separate display | Spelled from the owner's symbol, so S1's rule follows for members |
| The clash checks (`src/compilation.ts`) | `declaredStructs` and `rejectInstantiatedStructClashes` (NL3028), `reportTemplateClash` (NL3013), `rejectCollectionsClash` (NL3030, a module's own `Map` or `Set` beside the global one), and the member clashes NL3022 and NL3023, which those preempt (`tests/wordings/unreachable.txt`) | Run over symbols. A private pair stops clashing; an exported pair, or one on the C surface, stays refused |
| `--emit-header` (`src/interop-header.ts`, `src/interop-abi.ts`) | `cType` spells a class parameter `struct ${cStructName(nameOf(t))} *` (`interop-abi.ts:530`), and the header declares each struct with `cStructName(info.name)` (`interop-header.ts:139`, `:147`). A **private** class reaches the header too, through an exported function that takes or returns it: built with the seed, a non-exported `class P` returned by an exported `make` gave `struct P;`, `struct P {` and `struct P *make(int32_t x);` | C has one struct namespace, so a class that reaches the header keeps its bare name, and two such classes of one name stay refused, private or not |
| `--emit-dts` and N-API (`src/interop-dts.ts`, `src/interop-napi.ts`) | Neither reads `info.name`. A class reaches them only as text: `tsKeyword` gives a struct `nameOf(t)` (`interop-abi.ts:786`), which `tsSignatureLine` (`:743`) writes into a `.d.ts` comment and into N-API's "not bridged" list. N-API has no reader for a class, so a function that takes one is not bridged | These print the source name; no symbol reaches them |
| Typed JSON (`src/json-typed.ts`, `jsonRouteCallees`, `src/emit-json.ts`) | Messages name the type; the decoder's reach set is keyed by name | The reach set keys on the struct, messages keep the source name |
| Renaming a class on import (`src/checker.ts:1668`, `tests/link/class_import_rename`) | Refused: "the type name is part of the ABI" | Possible once the symbol, not the local name, is the ABI. A language change of its own |

**Size.** 40 files call `typeName(` (441 sites) and 29 look a struct up by
name; 50 files do one or the other, 56 counting those that spell `%struct.`.
The spellers (`info.name`, `nameOf(`, `%struct.`) are 44 files. That is over a
third of `src/` and several times S1 (§4f), so S3 is split into five stages,
one PR each (§7b). The first three move no IR: they separate the symbol from
the source name while the two are still equal everywhere, so each is proved by
an unchanged build. Only S3d changes what a program may do.

### 7b. Stages

**S3a: a struct's symbol in the type table.** `StructInfo` and the type table
carry a symbol beside the source name, set equal to it. Every struct gets a
display. The per-module registry and `registerForeignLayouts` pass the struct
across modules, not its name. Files: `types.ts`, `program.ts`, `structs.ts`,
`generics.ts`, and the `structOf(` callers. Depends on nothing. Release note:
`refactor(checker): give each struct a symbol separate from its source name`.

**S3b: spell structs by their symbol.** Every `%struct.` speller and
`llvmType` reads the symbol; every message, `tsKeyword` and the header's
`cStructName` read the source name. Files: the 44 spellers. Depends on S3a.
Release note: `refactor(codegen): spell a struct's IR type from its symbol`.

**S3c: member symbols from the owner's symbol.** The three member sites above
build `<owner symbol>.<name>`; displays keep the source name. Files:
`structs.ts`, `generics.ts`. Depends on S3a; after S3b, so one PR does not
move both. Release note: `refactor(codegen): spell a member's symbol from its
owner's symbol`.

**S3d: qualify a clashing private class or interface.** A private class or
interface whose source name clashes across same-prefix peers, under
`--strict-exports`, gets `<package prefix><module qualifier>$.<name>`, and its
instantiations `a$.Box$i32`. One predicate decides it, the way
`qualifiesClashing` does for functions, and a class reaches it as a party
whenever it is exported or appears in an exported function's signature, since
those are on the C surface. NL3028, NL3013, NL3030, NL3022 and NL3023 are
rewritten over symbols; an exported pair, a C-surface pair, a pair under
`--no-strict-exports` and a residual collision stay refused. Typed JSON's
reach set keys on the struct. Files: `compilation.ts`, `checker.ts`,
`generics.ts`, `structs.ts`, `json-typed.ts`. Depends on S3a to S3c. This is
the stage users see, so it lands with LANGUAGE.md, AI.md, ARCHITECTURE.md, the
guide and a `docs/reference/` regeneration. Release note: `feat(checker): two
modules may each keep a private class or interface of one name`.

**S3e: rename a class or interface on import.** The refusal at
`checker.ts:1668` goes and `class_import_rename` turns positive: the local
name is a binding, the symbol is unchanged. Files: `checker.ts`. Depends on
S3a; independent of S3b to S3d. A language change of its own, with
LANGUAGE.md, AI.md and the guide's "cannot be renamed on import". Release
note: `feat(checker): a class or interface may be renamed on import`.

## 8. Stages

| | Stage | Status |
| ---: | --- | --- |
| S1 | Private functions and generic templates qualified by their module when they would clash (§4) | Built (#1812) |
| S2 | Exported names that clash inside one package (§6) | Decided: keep refusing; nothing to build |
| S3a | A struct's symbol in the type table, equal to its source name (§7b) | Proposed |
| S3b | Structs spelled by their symbol in the IR (§7b) | Proposed |
| S3c | Member symbols spelled from their owner's symbol (§7b) | Proposed |
| S3d | A clashing private class or interface qualified by its module (§7b) | Proposed |
| S3e | A class or interface renamed on import (§7b) | Proposed |

Order: S3a, S3b, S3c, S3d. S3e needs only S3a.

**S1's gate**, met in #1812: §4d's tests, nish-cmp with no diff for programs
the seed compiles, and `node tests/run.js wasi` and `performance` passing.

**S2's gate:** none. `tests/link/duplicate_export` keeps failing with NL3024
and the wording fixture keeps pinning NL3010.

**S3a, S3b and S3c's gate:** no golden `.ll`, `expected.ir` or nish-cmp diff;
`tests/self/goldens.js --update` moves only the checked goldens of the modules
the stage edits; `--emit-header`, `--emit-dts` and `--emit-napi` output
unchanged for the sidecar tests; `node tests/run.js wasi` and `performance`
pass.

**S3d's gate:** two modules each declaring a private `class Node` with
different fields compile, link, and read each field at its own offset (an exit
code that only comes out right if so), with symbols `a$.Node` and `b$.Node`; a
private generic class gives `a$.Box$i32` beside `b$.Box$i32`; a private
interface pair compiles; an exported pair stays NL3028, as does a private pair
one of which reaches the header through an exported signature, and a pair
under `--no-strict-exports`; a residual collision is refused. Every program
that compiles today keeps its IR and its `--emit-header`, `--emit-dts` and
`--emit-napi` output.

**S3e's gate:** `tests/link/class_import_rename` passes as a positive test with
an exit code that proves the renamed class is the imported one, and a class
used under two local names in two modules is one type (one `%struct.`).

## 9. Not planned

- **Versions in a symbol's identity.** Reading a version means reading a
  manifest, which wp21-packages.md §6 refused, and two copies of one package
  are not supported (wp21-packages.md §9c).
- **Always qualifying every symbol.** It would move every golden `.ll`, every
  nish-cmp program, the `--emit-header` asm labels and every profile a user
  has taken, to buy nothing for a program with no clash. That is the trade
  wp21-packages.md §9 made for packages, for the same reason.
