---
name: Issue sweep 2 — the design calls left open by issue-sweep
overview: 'Act on the owner''s decisions for the three issues the first sweep (#184) left open: refuse two same-named classes or interfaces inside one package (#193), let NL9010 advise a reorder of the fields a class adds after its interface prefix (#108), and keep one diagnostic per class declaration (#185, closed with no code). Also close the six stale feature-run tracking issues whose PRs are all merged.'
stages:
  - id: struct-name-clash
    title: "fix(checker): refuse two same-named classes or interfaces in one package"
    goal: 'Two modules of one package that each declare a class or interface of the same name are refused at the declaration with a stable code, so their layouts can no longer merge into one type id (#193)'
    verification: 'npm run check && npm test (undegraded) && node scripts/gen-diagnostic-codes.mjs --check && npm run test:cli'
    todos:
      - id: snc-refuse
        content: Extend declaredStructs (self/compilation.ts ~804) to refuse a same-named struct declared in a second module of the same package, not only in a second package — see Struct name clash
        status: pending
      - id: snc-code
        content: Give the new wording its own code in the next free slot of its band in self/codes.ts, and add it to AGENTS.md and tests/nish/cli.ts where the code table lives — see Struct name clash
        status: pending
      - id: snc-tests
        content: Add both #193 reproducers (class with fields only; private interface passed across modules) as tests/link negatives, and a wordings case for the new code; re-baseline the existing same-name link tests this rule now refuses first — see Tests
        status: pending
      - id: snc-docs
        content: State the rule in docs/LANGUAGE.md beside the generic "instantiation's name is program-wide" rule — see Struct name clash
        status: pending
  - id: nl9010-suffix
    title: "feat(checker): NL9010 advises reordering the fields a class adds after its interface prefix"
    goal: 'A class that implements an interface gets NL9010 when reordering only the fields after the interface prefix would shrink it, and the message names an order that keeps the prefix intact (#108)'
    verification: 'npm run check && npm test (undegraded) — with std/ still at zero performance warnings'
    todos:
      - id: nl-prefix
        content: In reportWastefulPadding (self/structs.ts ~186), for a class with implementsNames, keep the longest implemented interface's fields as a fixed prefix and apply widestFirst to the rest only; warn when layoutSize of prefix + reordered suffix is smaller — see NL9010 suffix
        status: pending
      - id: nl-comment
        content: Rewrite the "two shapes are deliberately silent" JSDoc above reportWastefulPadding so the implements case describes the prefix rule — see NL9010 suffix
        status: pending
      - id: nl-tests
        content: 'Add a perf_padding_suffix case (the #108 counterexample, 40 → 32) and a quiet case (suffix already optimal; waste only inside the prefix) — see Tests'
        status: pending
      - id: nl-docs
        content: Update docs/wp15-performance.md (the NL9010 silence entries) and the NL9010 rule text in docs/LANGUAGE.md — see NL9010 suffix
        status: pending
---

## Context

Main is at c767e90, after issue-sweep (#184) closed with 7/7 merged. Four issues were still open, and the owner decided them on 2026-09-24:

| # | decision | where it goes |
|---|---|---|
| #193 | **Refuse the clash** (option 2). A refusal can be lifted later without breaking anyone; declaration identity (option 1) stays possible later | struct-name-clash |
| #108 | **Implement** the suffix-reorder warning | nl9010-suffix |
| #185 | **Keep one diagnostic per declaration.** The `self/structs.ts` comment already states the rule without stage0, so no code changes | the lead closes it with the decision |
| #170, #153, #144, #100, #97, #89 | every tracked PR is merged | the lead closes them as completed |

## Struct name clash

`declaredStructs` already refuses a same-named struct across **packages** (`ownerPackages[seen] !== unit.packageName`), and `rejectInstantiatedStructClashes` refuses same-package generic templates with "a class or interface name must be unique across the program". The non-generic, same-package case is the gap: a class with fields only produces no symbol, so `rejectSymbolClashes` sees nothing. The fix drops the package condition for the refusal and picks the wording:

- **Same package:** a new wording in the style of the generic one. It names both modules, as in `` Class `Base` is also declared in lib.ts; a class or interface name must be unique across the program ``. It needs its own code: the next free slot in its band, and no number is ever reused.
- **Across packages:** the wording and code stay exactly as they are.

The refusal applies to exported and private declarations alike, because interning by name ignores export. Report it once per name per module, at the later declaration in load order, as the cross-package rule does.

**Consequences to handle, not avoid:** several existing `tests/link` programs declare two same-named structs in one package on purpose. They are `iface_same_name_class`, `generic_constraint_same_name*`, `class_clash_constructor` and `class_clash_method`, and possibly others; find them all with a grep. The new rule may now refuse them first.
- Re-baseline each moved `expected.err` with the tooling, never by hand. Keep the test's intent in its header comment, and say in the PR body which tests moved.
- An older code (NL3022, NL2185 on those paths) may become unreachable **for that shape**. That is acceptable: codes are never reused. If a code becomes wholly unreachable, the PR body says so.
- `iface_same_name_imported` has only one `Shape` and must still link and print `3.5`.

## NL9010 suffix

`reportWastefulPadding` returns early for any class with `implementsNames`. Every implemented interface's fields must be a prefix of the class's fields (`checkImplements`), so the longest implemented interface fixes the first *k* fields and the rest belong to the author. The new rule:
- lay out `prefix ++ widestFirst(suffix)` with `layoutSize`;
- warn when that is smaller than `info.size`;
- name the whole resulting order in the message, with a clause saying the first *k* fields stay where the interface puts them.

A class with no `implements` keeps today's behaviour byte for byte. A generic instantiation stays silent. The implemented interfaces' field lists must be available where this runs. If they are not yet collected in pass 1b, collect them on demand, or move the check to where they are, and keep `DiagnosticSink.reportPerformance`'s ordering intact.

New warnings change the compiler's output against the released seed. Any `tests/nish-cmp.js` DECLARED entry this adds must quote **this PR's title** in its `changelog:` string, never an intermediate commit's subject (the #190 → #194 lesson). `std/` must stay at zero performance warnings.

## Tests

- Every new `tests/cases` program is registered in `tests/differential/goldens/unfrozen.txt` via `node tests/differential/goldens.js --update`.
- These are regenerated by their tools, never hand-merged: `tests/cases/*.ll`, `tests/self/goldens/**`, `tests/nish-cmp.js` DECLARED entries, `tests/perf-baseline.json`, `unfrozen.txt`.
- Shared-append files: each stage adds only its own lines. They are `tests/run.js`, `docs/LANGUAGE.md` and `docs/IR_COOKBOOK.md`. The second PR to merge takes main in and regenerates.
- Show the exact LLVM IR for each new `tests/cases` program in the PR body (CLAUDE.md).

## Owns

- **struct-name-clash:** `self/compilation.ts`, `self/codes.ts`, `AGENTS.md`, `tests/nish/cli.ts`, `tests/link/**`, `tests/wordings/**`, `docs/wp21-packages.md` + shared-append + regenerated.
- **nl9010-suffix:** `self/structs.ts`, `tests/cases/perf_padding*`, `docs/wp15-performance.md` + shared-append + regenerated.

The two are disjoint apart from the shared-append and regenerated files. Neither depends on the other, so both run at once and either may merge first.
