---
name: WP57 — module-scoped names
overview: Two modules of one program may each keep a private function or generic template of one name. A private symbol is qualified by its module path only when its bare symbol would clash, so no program that compiles today changes its IR. Exported names (S2) and classes and interfaces (S3) are decided or sized separately.
stages:
  - id: s1-private-symbols
    title: "feat(checker): two modules may each keep a private function or generic of one name"
    goal: A private function or generic template whose bare symbol would clash is spelled <package prefix><module qualifier>$.<name>; the clash checks run over the qualified symbols; exported clashes, --no-strict-exports clashes and residual qualified collisions stay refused with NL3024/NL3025/NL3010/NL3026/NL3027; no existing program's IR, golden or nish-cmp output moves; every doc in design note §4e states the new rule.
    verification: node tests/run.js link && node tests/run.js wordings && node tests/run.js duplicate && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/self/goldens.js --update && git diff --exit-code tests/self/goldens/checked && npm run check && npm run lint && node scripts/gen-reference.mjs --check, each summary read for a nonzero case count and its skip line
    todos:
      - id: qualifier
        content: Add moduleSymbolQualifier beside packageSymbolPrefix in src/packages.ts — path from the package root without .ts, every char outside [A-Za-z0-9_] as _, a leading digit given _ (§4a)
        status: pending
      - id: qualify-clashing
        content: Add Checker.qualifyClashing(qualifier, names) beside qualifySymbols in src/checker.ts, so a symbol is still spelled only in the checker (§4b)
        status: pending
      - id: compilation-step
        content: Add Compilation.qualifyClashingSymbols after every module loads and before bindImports — group defined non-foreign free functions and function templates by symbol, qualify every private party, keep exported parties bare, qualify a private non-entry main, skip owners (methods, constructors, generic methods) and skip entirely under --no-strict-exports (§4b)
        status: pending
      - id: instantiation-prefix
        content: In src/generics.ts, read an instantiation's prefix off the template itself instead of its home program, so lib_util$.identity$i32 and lifted arrows lib_util$.work$arrow0 follow (§4b)
        status: pending
      - id: clash-checks
        content: rejectSymbolClashes keys on the final symbol, the template loop reads the qualified template symbol, a residual qualified collision is reported by NL3026/NL3027 naming both files; codes keep their numbers (gen-diagnostic-codes keeps them if a message is reworded) (§4c)
        status: pending
      - id: link-tests
        content: Flip tests/link/duplicate_internal positive (expected.code 42, expected.ir with @helper$.add and @main$.add); add module_private_helpers, module_private_generic, module_private_mixed, module_private_spawn (positive, expected.ir) and module_private_no_strict (negative NL3026); duplicate_export stays NL3024 (§4d)
        status: pending
      - id: wording-fixtures
        content: Give tests/wordings/nl3026_function_clash and nl3027_package_function_clash a .args of --no-strict-exports; rewrite nl3010_generic_redeclared so both templates are exported; update tests/nish/cli.ts's duplicate_internal NL3026 check and tests/run.js's clash-code check to the new behaviour (§4d)
        status: pending
      - id: docs
        content: Move every doc in §4e — LANGUAGE.md (export/import, Calling C, spawn paragraph), ARCHITECTURE.md (--strict-exports bullet), wp5-modules.md (Linkage), AI.md, docs/guide/language/modules.md with an example, the source comments in generics.ts/packages.ts/compilation.ts/attributes.ts and duplicate_internal/main.ts; regenerate docs/reference with node scripts/gen-reference.mjs
        status: pending
      - id: roadmap
        content: Tick S1 on docs/roadmap/wp57-module-scoped-names.md, move Next on, update Done count and its docs/roadmap/index.md row, the design note's status line and its docs/README.md row
        status: pending
      - id: no-ir-moves
        content: Run node tests/self/goldens.js --update and NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js and confirm no diff (§5a — a diff is a bug in S1, never a DECLARED entry)
        status: pending
  - id: s2s3-docs
    title: "docs(roadmap): settle WP57 S2 as keep refusing and split S3 into stages"
    goal: The design note and roadmap page record S2's decision as option A (an exported name stays unique across the root package, NL3024/NL3025/NL3010 stay), and S3 is split into sized, independently shippable sub-stages, each with its gate, owning files and release note, written against main after S1.
    verification: node docs/check-links.mjs && npm run lint && node scripts/gen-reference.mjs --check
    todos:
      - id: s2-decision
        content: Rewrite design note §6 to record option A as decided (why, what stays refused, what would reopen it — B with export { f } from), tick S2 on docs/roadmap/wp57-module-scoped-names.md as decided, remove its Waiting-on-a-decision entry, update Done count and its docs/roadmap/index.md row
        status: pending
      - id: s3-inventory
        content: Re-check §7's inventory against main after S1 (typeName( callers, struct lookups by name, %struct. spellers, interop-dts/napi class reach), recording the commit it is anchored at
        status: pending
      - id: s3-split
        content: Split S3 in §7/§8 into sub-stages (for example type-table identity, emitters' %struct spelling, member symbols, clash checks, class rename on import), each one PR, with its gate, the files it reaches, its dependency order and release note; exported clashing classes stay refused under S2's option A
        status: pending
      - id: s3-roadmap
        content: Replace S3's single box on the roadmap page with the sub-stage boxes and set Next to the first of them; update docs/README.md's row for the note
        status: pending
---

# WP57 — module-scoped names

## Context

Requirements: WP57 (`docs/roadmap/wp57-module-scoped-names.md`), design note
`docs/wp57-module-scoped-names.md`. Today a private function's name must be
unique across the whole program (NL3026) or package (NL3027) because the
emitted LLVM symbol is global and the attribute facts are keyed by it. Name
lookup is already per module.

The roadmap's **Next** is S1. S2 is an *(open question)* (AGENTS.md: ask before
starting). S3 is "large; to be split" once S1 and S2 land, and its exported
half depends on S2's answer.

## S1 — private functions and generic templates

The whole of design note §4, one PR. It cannot be split: the docs move in the
same PR as the rule (CLAUDE.md "The user guide moves with the language"), and
the tests, the clash checks and the rename are one change.

**Owns:**
`src/compilation.ts`, `src/checker.ts`, `src/generics.ts`, `src/packages.ts`,
`src/codes.ts`, `src/attributes.ts`,
`tests/link/duplicate_internal/**`, `tests/link/duplicate_export/**`,
`tests/link/module_private_*/**`,
`tests/wordings/nl3010_*`, `tests/wordings/nl3026_*`, `tests/wordings/nl3027_*`,
`tests/wordings/wordings_generic.ts`, `tests/wordings/nl3_clash/**`,
`tests/nish/cli.ts`, `tests/run.js`,
`docs/LANGUAGE.md`, `docs/ARCHITECTURE.md`, `docs/wp5-modules.md`, `docs/AI.md`,
`docs/guide/language/modules.md`, `docs/wp57-module-scoped-names.md`,
`docs/roadmap/wp57-module-scoped-names.md`, `docs/roadmap/index.md`,
`docs/README.md`

Generated (regenerate, never hand-edit): `docs/reference/**`,
`tests/self/goldens/checked/**`, `tests/differential/goldens*`,
`tests/shard-costs.json`.

Not owned on purpose: `AGENTS.md` (CODEOWNERS; its NL3024–NL3027 line stays
true because the codes stay). If S1 finds it must change, that is an
escalation, not a widening.

Release note (the squash subject): `feat(checker): two modules may each keep a
private function or generic of one name`. Minor bump, not breaking.

## S2 and S3 — docs only

Settled at sign-off: S2 takes option A (keep refusing), recorded, nothing
built. S3 is split into sized sub-stages, nothing built. Both edit the design
note and the roadmap page, so they are one docs stage. It starts after S1
merges, because S1 edits those same pages and the S3 split is sized against
the code S1 leaves.

**Owns:** `docs/wp57-module-scoped-names.md`,
`docs/roadmap/wp57-module-scoped-names.md`, `docs/roadmap/index.md`,
`docs/README.md`

**Depends on:** s1-private-symbols (start and merge).

## Verification

The stage's `verification` line, plus CI's nine `test` shards, `lint`,
`bootstrap`, `nish-cmp` and `ci-gate` green on the PR head.
