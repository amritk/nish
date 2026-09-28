---
name: WP34 N1 — exported enums and type aliases
overview: Let an enum and a type alias be exported and imported, so a protocol's frame types, error codes and stream states can cross module boundaries. The parser already reads both forms. The work is resolving every module's enums and aliases before any module's signatures, then binding them through imports, and lifting the two refusals, NL2288 and NL2276.
stages:
  - id: export-enum
    title: "feat(checker): export an enum and import it into another module"
    goal: An exported enum is importable and usable in the importer as a field type, a parameter or return type, a local, a Map key, a switch discriminant, and as the value Kind.Member, with its distinctness, its folding and its no-symbol lowering unchanged. The type-declaration pre-pass this needs covers aliases too, but exporting an alias stays refused until export-alias.
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded) && node tests/run.js enum && node tests/run.js link && node tests/diagnostic-coverage.js --require-coverage && node docs/check-links.mjs
    todos:
      - id: ee-prepass
        content: Declare every module's enums and aliases, and bind the enum and alias names each module imports, before any module's pass 1 signatures run, in src/compilation.ts and src/checker.ts — see Stage 1 → The load order
      - id: ee-lift
        content: Remove the NL2288 refusal in declareEnum, and record exported enums on the program so that bindImport can find them — see Stage 1 → Binding
      - id: ee-bind
        content: Bind an imported enum in bindImport (an import rename included), with the not-exported, not-a-value, clash and duplicate-import errors — see Stage 1 → Binding
      - id: ee-tests
        content: Add tests/link/enum_export_* programs (field, parameter, return, Map key, switch, members, rename, cycle, diamond) and the negative cases, and retire reject_enum_export and nl2288 — see Stage 1 → Tests
      - id: ee-docs
        content: Rewrite the Enums export bullet in docs/LANGUAGE.md and docs/AI.md, list NL2288 as retired in tests/wordings/unreachable.txt, and mark the enum half of N1 in docs/wp34-hosting-cs.md — see Stage 1 → Docs
  - id: export-alias
    title: "feat(checker): export a type alias and import it into another module"
    goal: An exported type alias is importable and resolves in the importer to the type it names, whether a class (imported or local to the exporter), an array or a T-or-null, including through a chain of aliases across modules, with cross-module cycles reported. It emits nothing, as a local alias emits nothing.
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded) && node tests/run.js alias && node tests/run.js link && node tests/diagnostic-coverage.js --require-coverage && node docs/check-links.mjs
    todos:
      - id: ea-lift
        content: Remove the NL2276 refusal in declareAlias, and resolve an exported alias's right-hand side in its own module's scope — see Stage 2 → Resolution
      - id: ea-bind
        content: Bind an imported alias in bindImport so that a use in type position resolves to the aliased type, with the same errors as an imported enum — see Stage 2 → Resolution
      - id: ea-cycle
        content: Report an alias cycle that crosses modules with the existing wording, and follow alias-of-imported-alias chains — see Stage 2 → Resolution
      - id: ea-tests
        content: Add tests/link/alias_export_* programs (class, imported class, array, nullable, Result, chain, rename, cycle) with an IR-identity pair, the negative cases, and retire reject_type_alias_export — see Stage 2 → Tests
      - id: ea-docs
        content: Rewrite the Type aliases export bullet in docs/LANGUAGE.md and docs/AI.md, list NL2276 as retired in unreachable.txt, and mark N1 done in docs/wp34-hosting-cs.md — see Stage 2 → Docs
---

## Context

[docs/wp34-hosting-cs.md](../../docs/wp34-hosting-cs.md) §4 N1 asks for enums and aliases that cross module boundaries. Its acceptance is as follows. An exported enum is used in a second module as a field type, a parameter type, a `switch` discriminant and a `Map` key. An exported alias is used the same way for a class, an array and a `T | null`. The refusals that stay keep their negative tests (no string enum, no `const enum`, no default export).

The parser already reads `export enum` and `export type`. The checker refuses them in two places. `declareEnum` in [src/checker.ts](../../src/checker.ts) (~line 383) is NL2288, and `declareAlias` (~line 335) is NL2276. [docs/LANGUAGE.md](../../docs/LANGUAGE.md) §Enums and §Type aliases give the reason, which is also the real work. Pass 1 collects a module's signatures as the module is loaded, and pass 1b binds imports afterwards. So an imported name in a type position resolves provisionally as a class, and an enum or alias has no layout to stand in for one. Removing the check is not enough. Enums and aliases have to be known, across modules, before signatures.

## Approach

- **A type-declaration pre-pass, after every module is parsed and before any signature.** Load in [src/compilation.ts](../../src/compilation.ts) currently parses and runs pass 1 per module. It becomes three steps. First, parse the whole import graph, which already terminates on cycles. Second, for every module, declare its enums and aliases, then bind each import whose target declares an exported enum or alias of that name. Third, pass 1 signatures, as today. An enum needs nothing but literals, so it is complete once declared. An alias's right-hand side is still resolved by need (Stage 2), and in its own module's scope.
- **An imported enum is the exporter's enum**, the same `EnumInfo` and the same type id, and not a copy. `Kind` from `a.ts`, and `Kind` declared again in `b.ts`, stay two distinct types. The importer's local name (with `as` renames) maps to the exporter's type.
- **Nothing is emitted, and no existing golden moves.** Enums and aliases lower to what they name, so an importer's IR contains no symbol, table or struct for either. Every `.ll` golden that exists today must stay byte-identical.
- **Only the export refusals retire.** String enums (Phase 0), `const enum`, `declare enum`, generic aliases, local aliases, default exports and `export { … }` lists keep their refusals and tests. NL2288 and NL2276 keep their registry entries and numbers, as retired codes do.
- **The interop sidecars are unchanged.** An enum still does not cross to C or JavaScript, and the existing sidecar refusal still applies to an exported function whose signature names one.
- **Two stages in sequence.** The pre-pass is the hard part, and both kinds need it. Enums come first because they resolve without a scope. Aliases then add scoped, by-need resolution across modules, and cycles.

## Stage 1 — export-enum

**Owns:** `src/checker.ts`, `src/compilation.ts`, `src/program.ts`, `src/symbols.ts`, `src/annotations.ts`, `src/types.ts`, `tests/link/enum_export_*/**`, `tests/cases/reject_enum_export.*` (delete), `tests/cases/reject_enum_import_*`, `tests/wordings/nl2288_*` (delete), `tests/wordings/unreachable.txt`, `docs/LANGUAGE.md`, `docs/AI.md`, `docs/wp34-hosting-cs.md`, `docs/IR_COOKBOOK.md`

**The load order.** Split load so that no module's pass 1 runs before every module's enums and aliases are declared and their imports are bound. Keep the existing guarantees: each file is parsed once and keyed by identity, cycles terminate, and errors are reported in the order the report uses today. State in the PR body what moved and why. Time `scripts/bootstrap.sh --verify` before and after, and put both numbers in the body (the compiler builds itself through this path).

**Binding.** `bindImport` gains an enum branch beside class, template and constant, and it is bound in the pre-pass rather than in pass 1b. The errors mirror the existing ones:

- the enum is declared but not exported, which reads `` `Kind` is declared in `./a` but not exported (add `export`) ``;
- the imported name is used as a function;
- a local declaration clashes with an imported enum, which reads `` `Kind` is already declared in this module ``;
- the same local name is imported twice, which reads `` already imported from ``.

`Kind.Member` in the importer folds to the exporter's integer, exactly as it does locally.

**Tests.** These are link programs under `tests/link/`, each with `expected.out` (and `expected.ir` where the IR is the claim):

- `enum_export_uses`: field type, parameter type, return type, local, `Map<Kind, V>` key, `switch` with member labels, and members compared with `===`;
- `enum_export_rename`: `import { Kind as K }`;
- `enum_export_cycle`: two modules that import each other's enums;
- `enum_export_diamond`: one enum reached by two paths, which must be one type;
- `enum_export_ir`: the importer's IR has only `i32`, and is byte-identical to the same program with the enum declared locally.

Negative cases:

- `enum_import_not_exported`;
- `enum_import_as_call`;
- `enum_import_clash`;
- `enum_import_distinct`: an imported `Kind`, and `a.ts`'s `Kind` against `b.ts`'s own `Kind`, stay incompatible;
- `enum_import_i32`: an imported `Kind` still does not convert to or from `i32`.

`reject_enum_string`, `reject_enum_const_enum` and `reject_export_default` stay exactly as they are. Delete `tests/cases/reject_enum_export.*` and `tests/wordings/nl2288_export_enum.*`, and list NL2288 as retired in `unreachable.txt` under its "Retired" block.

**Docs.** In LANGUAGE.md §Enums, the export bullet becomes the rule for how an exported enum is imported and what it is in the importer, with its tests named. In §Type aliases, keep the refusal but update the reason, because the load order no longer causes it. Mirror the change in the forbidden-construct table (~line 4785) and in AI.md's table (~line 140) and its "Neither can be exported" bullet (~line 999). In wp34 N1, mark the enum half done.

## Stage 2 — export-alias

**Owns:** the same `src/` files as Stage 1, plus `tests/link/alias_export_*/**`, `tests/cases/reject_type_alias_export.*` (delete), `tests/cases/reject_type_alias_import_*`, `tests/wordings/nl2276_*`, `tests/wordings/unreachable.txt`, `docs/LANGUAGE.md`, `docs/AI.md`, `docs/wp34-hosting-cs.md`

**Depends on:** `export-enum` (development and merge). Stage 2 is written on top of Stage 1's pre-pass.

**Resolution.** An exported alias's right-hand side resolves in the **exporter's** scope, so `export type Conn = Socket | null` works in `a.ts` even when `Socket` is a class that `a.ts` itself imported. The importer sees the resolved type, never the alias's name. `sameType` never sees an alias, as today. Chains across modules resolve by need. A cycle through two modules is `` Type alias `X` is defined in terms of itself `` at the first alias of the cycle in report order. The errors for an imported alias match an imported enum's, plus one for an imported alias used as a value.

**Tests.**

- `alias_export_class`: an alias of a class declared in the exporter.
- `alias_export_imported_class`: an alias of a class the exporter imported.
- `alias_export_array`, `alias_export_nullable` and `alias_export_result`.
- `alias_export_chain`: an alias of an imported alias.
- `alias_export_rename`.
- `alias_export_ir`: the importer's IR is byte-identical to the same program with the alias expanded.
- Negative cases: `alias_import_not_exported`, `alias_import_as_value`, `alias_import_clash`, and `alias_export_cycle` (the cross-module cycle).

`reject_type_alias_generic` and the local-alias refusal stay. Delete `tests/cases/reject_type_alias_export.*` and any `nl2276` pin, and list NL2276 as retired.

**Docs.** In LANGUAGE.md §Type aliases, the export bullet becomes the import rule. Update both tables in AI.md, and mark N1 done in wp34.

## Out of scope

- Re-export lists (`export { Kind } from "./a"`), `export *`, `import type`, and namespace imports. These keep their current refusals.
- Enums or aliases in the interop sidecars (`--emit-header`, `--emit-dts`, `--emit-napi`, wasm).
- String enums, `const enum`, `declare enum`, generic aliases, and aliases or enums inside a function body.
- Using an exported enum or alias anywhere in `src/` or `std/`. The rolling freeze forbids it until the next release.

## Cross-run note

The concurrent run `portability-warnings` ([#280](https://github.com/amritk/nish/issues/280)) also edits `src/checker.ts`, `src/compilation.ts`, `tests/wordings/unreachable.txt`, `docs/LANGUAGE.md` and `docs/AI.md`, in different sections. Whichever PR merges second takes `main` in and resolves the conflict, as the repo's merge rule requires.

## Verification

Each stage's `verification` line, plus: an undegraded `npm test` (read the skip count), no existing `.ll` golden in the diff, and `scripts/bootstrap.sh --verify` timed before and after, with both numbers in the PR body.
