---
name: WP22 C — rewrite the test corpus to arrow declarations
overview: Rewrite every top-level `function` definition in the test corpus (about 2,100 in about 1,100 files, which Biome does not read) to `const NAME = (...) => {...}` with the existing codemod, prove no compiled output changed, then add a suite check so new corpus files cannot reintroduce the old spelling. The last PR ticks WP22's corpus box.
stages:
  - id: cases-reject
    title: "test: rewrite the reject_* golden cases to arrow declarations"
    goal: Every tests/cases/reject_* program declares its functions as arrows, except the files where the keyword is the subject, with every diagnostic's code and message unchanged
    verification: node scripts/arrow-verify.mjs --applied --rev $(git merge-base HEAD origin/main) tests/cases && node tests/run.js reject_
    todos:
      - id: reject-codemod
        content: Run scripts/arrowify.mjs (block bodies, no --concise) over tests/cases/reject_*.ts, leaving the subject files alone — see Stage 1
        status: pending
      - id: reject-single-line
        content: Give the single-line-body reject cases the ordinary layout per WP22 §8c and regenerate their expected outputs — see Stage 1
        status: pending
      - id: reject-verify
        content: Run arrow-verify --applied and the reject_ section, and record the counts in the PR body — see Stage 1
        status: pending
  - id: cases-positive
    title: "test: rewrite the positive golden cases to arrow declarations"
    goal: Every tests/cases program that is not a reject_* case declares its functions as arrows, with every .ll golden byte-identical
    verification: node scripts/arrow-verify.mjs --applied --rev $(git merge-base HEAD origin/main) tests/cases && node tests/differential/goldens.js --fresh && node tests/self/goldens.js
    todos:
      - id: positive-codemod
        content: Run scripts/arrowify.mjs (block bodies, no --concise) over every tests/cases/*.ts that is not reject_* — see Stage 2
        status: pending
      - id: positive-goldens
        content: Regenerate tests/self/goldens/checked/tests/cases and confirm no tests/cases/*.ll changed — see Stage 2
        status: pending
  - id: link-wordings
    title: "test: rewrite the link programs and wording cases to arrow declarations"
    goal: Every module under tests/link and tests/wordings declares its functions as arrows, with every pinned wording unchanged
    verification: node scripts/arrow-verify.mjs --applied --rev $(git merge-base HEAD origin/main) tests/link tests/wordings && node tests/run.js link && node tests/run.js wording
    todos:
      - id: link-codemod
        content: Run scripts/arrowify.mjs over tests/link/**/*.ts — see Stage 3
        status: pending
      - id: wordings-codemod
        content: Run scripts/arrowify.mjs over tests/wordings/**/*.ts and regenerate any position-only expected output — see Stage 3
        status: pending
  - id: fixtures
    title: "test: rewrite the differential corpus and the remaining fixtures to arrow declarations"
    goal: The differential corpus and the smaller fixture directories declare their functions as arrows, with the frozen differential JavaScript and every fixture's expected output unchanged or regenerated with the repo's tooling
    verification: node scripts/arrow-verify.mjs --applied --rev $(git merge-base HEAD origin/main) tests/differential/corpus tests/parser tests/layout tests/emit-ts tests/host-import tests/module-storage && node tests/differential/goldens.js --fresh && node tests/run.js fix && node tests/run.js layout && node tests/run.js emit-ts
    todos:
      - id: differential-codemod
        content: Run scripts/arrowify.mjs over tests/differential/corpus and check the frozen JavaScript in tests/differential/goldens — see Stage 4
        status: pending
      - id: fixture-dirs-codemod
        content: Rewrite tests/fix, tests/parser, tests/layout, tests/emit-ts, tests/host-import and the single-file fixture dirs — see Stage 4
        status: pending
  - id: guard
    title: "test: refuse a new function definition in the test corpus"
    goal: A tests/run.js check fails on any top-level function definition under tests/ outside a reasoned allowlist, the stragglers and the inline Nish in the JavaScript harnesses are rewritten, and WP22's corpus box is ticked
    verification: node tests/run.js arrow-corpus && npm run lint && node docs/check-links.mjs
    todos:
      - id: guard-sweep
        content: Re-run the codemod over tests/**/*.ts to convert cases that landed in the old spelling during the run — see Stage 5
        status: pending
      - id: guard-inline
        content: Rewrite the inline Nish programs in tests/run.js, tests/ffi-*.js and the generator in tests/differential/fuzz.js — see Stage 5
        status: pending
      - id: guard-check
        content: Add the arrow-corpus check and tests/function-spelling-allowlist.txt, with a negative proof — see Stage 5
        status: pending
      - id: guard-docs
        content: Update docs/wp22-arrow-functions.md §7, §8, §10, the WP22 roadmap page and docs/roadmap/index.md — see Stage 5
        status: pending
---

# WP22 C — rewrite the test corpus to arrow declarations

## Context

[WP22](../../docs/roadmap/wp22-arrow-functions.md) made `const f = (...) => ...` the declaration form. Stages A and B made both compilers accept it and emit byte-identical IR. The first half of C rewrote docs, examples, `src/`, `std/` and tooling, and a Biome plugin (`biome-plugins/no-function-declaration.grit`) blocks new `function` declarations there. The test corpus is outside Biome and still uses `function`. [The design note §7](../../docs/wp22-arrow-functions.md#7-the-surfaces-measured) counted 1,034 definitions on 2026-10-05. Counted again at `abbdca8f` with the same pattern, there are **2,127** across about 1,100 files, and new cases are still being written in the old spelling:

| Directory | files | definitions |
| --- | ---: | ---: |
| `tests/cases/reject_*` | 473 | — |
| `tests/cases/` other | 277 | 1,338 in all of `tests/cases` |
| `tests/link/` | 121 | 282 |
| `tests/wordings/` | 77 | 107 |
| `tests/differential/` | 78 | 156 |
| `tests/fix/` | 41 | 41 |
| `tests/parser/`, `layout/`, `emit-ts/`, `host-import/`, small dirs | ~45 | ~200 |
| inline Nish in `tests/run.js`, `tests/ffi-*.js`, `tests/differential/fuzz.js` | 6 | ~63 |

Stage D (refusing `function`) is still an open question and **not** part of this plan. The roadmap says the corpus rewrite pays off only if D goes ahead. This run does it anyway, as requested, and it stands on its own: one spelling across the repository, and a guard that keeps it that way.

## Approach

- **The codemod is [`scripts/arrowify.mjs`](../../scripts/arrowify.mjs), and the proof is [`scripts/arrow-verify.mjs`](../../scripts/arrow-verify.mjs) `--applied`** (design note §8b). A byte of difference in emitted `.ll`, a sidecar, or a `--json` diagnostic (positions stripped) is a bug in the rewrite until proven otherwise. Every stage's PR body records the arrow-verify summary line.
- **Block bodies only, no `--concise`.** Biome does not read the corpus, so its `useConsistentArrowReturn` error does not apply. A block-bodied rewrite moves no line (§8c), so no `.ll` golden, `-g` line, or diagnostic line moves. The only position change is a column, and only in single-line bodies.
- **Leave the subject files alone.** The files where the keyword is the subject (§9a) and the forms the codemod refuses by design (`declare function`, `function*`, `async`, an anonymous or `export default` declaration) stay as they are. That includes `reject_fn_nested`, `reject_fn_anonymous`, `reject_ffi_body`, `reject_generator`, `reject_export_default`, `tests/differential/arrow-parity/declared.ts`, and any case whose name or comment says it tests the `function` spelling (for example the B-stage parity case `fn_arrow`). Stage 5's allowlist names each one with its reason.
- **Slices are directories**, so concurrent stages own disjoint files. Generated goldens are one file per module (`tests/self/goldens/checked/<path>`), so each stage regenerates only its own. A conflict in a generated file is regenerated, never merged by hand.
- **No IR moves, so no `DECLARED` entries.** If nish-cmp reports a moved program, that is a rewrite bug and has to be fixed, not declared.
- **Commit type `test`.** These are test-only changes, so they get no release-note scope. The subject is the stage title.

## Stage 1 — cases-reject

**Owns:** `tests/cases/reject_*`, `tests/self/goldens/checked/tests/cases/reject_*`

- `node scripts/arrowify.mjs <files>` over `tests/cases/reject_*.ts`, excluding the subject files above. Check that `node scripts/arrowify.mjs --check` leaves only the subject files and the refused forms.
- `reject_arrow_annotated` and `reject_arrow_let` convert their `main` (§9a: mechanical, and due before any stage D).
- Single-line bodies: §8c counted 76 single-line bodies in `reject_*` cases. Give them the ordinary multi-line layout, as §8c asks, and regenerate their expected outputs with the repo's tooling (`UPDATE_GOLDENS=1 node tests/run.js <case>` or the case's own update path). Read every regenerated `expected.err` / `expected.json`. Only a line or column may change. The code and the message must not.
- PR body: number of files rewritten, number left with the reason for each, and the arrow-verify summary line.

## Stage 2 — cases-positive

**Owns:** `tests/cases/*` except `tests/cases/reject_*`, and `tests/self/goldens/checked/tests/cases/*` except `reject_*`
**Model:** sonnet

- `node scripts/arrowify.mjs` over every non-reject `tests/cases/*.ts`, excluding the subject files above.
- `git diff --stat -- 'tests/cases/*.ll'` must be empty. Regenerate `tests/self/goldens/checked` with `node tests/self/goldens.js --update` and stage only this stage's files.
- `node tests/differential/goldens.js --fresh` must pass. If it reports a case to register, the rewrite changed the emitted JavaScript, which §8b says it must not do. Stop and report it in the PR.

## Stage 3 — link-wordings

**Owns:** `tests/link/**`, `tests/wordings/**`, `tests/self/goldens/checked/tests/link/**`
**Model:** sonnet

- Codemod over `tests/link/**/*.ts` (multi-module programs: rewrite every module, including non-entry ones) and `tests/wordings/**/*.ts`.
- A wording case pins a message. If a regenerated expected output differs in anything but a position, the rewrite is wrong.

## Stage 4 — fixtures

**Owns:** `tests/differential/goldens.js` (added by the lead, see Amendments), `tests/differential/corpus/**`, `tests/differential/goldens/**`, `tests/self/goldens/checked/tests/differential/**`, `tests/self/goldens/checked/tests/parser/**`, `tests/fix/**`, `tests/parser/**`, `tests/layout/**`, `tests/emit-ts/**`, `tests/host-import/**`, `tests/module-storage/**`, `tests/host-window/**`, `tests/page/**`, `tests/panic/**`, `tests/postgres/**`

- `tests/differential/corpus`: codemod. The frozen JavaScript in `tests/differential/goldens/` should not move, because the two spellings rewrite to the same JavaScript (§8b, the arrow-parity guard). Run `node tests/differential/goldens.js --fresh` and treat any change as a finding.
- `tests/differential/arrow-parity/` is **not** owned. `declared.ts` is the subject.
- `tests/fix/`: the `nish --fix` fixtures are input/expected pairs. Rewrite the input and the expected output consistently, and run `node tests/run.js fix`.
- `tests/parser/`: parser fixtures that no checker accepts (checked by the `tests/run.js` sections that read `tests/parser/recovery.ts` and `names.ts`; run those). Rewrite only what the codemod parses cleanly. A fixture that exists to exercise `function` parsing stays, with its reason in the PR body.
- `tests/layout/structs.ts`: 71 definitions in one file, the C-layout twins. Run `node tests/run.js layout`.
- The rest: codemod plus each directory's own `node tests/run.js <name>` section.

## Stage 5 — guard

Starts after stages 1–4 have merged. It is the sweep, so it is not concurrent with anything.

**Owns:** `tests/**` (sweep only: files still holding a definition), `tests/run.js`, `tests/ffi-*.js`, `tests/differential/fuzz.js`, `tests/function-spelling-allowlist.txt`, `docs/wp22-arrow-functions.md`, `docs/roadmap/wp22-arrow-functions.md`, `docs/roadmap/index.md`, `tests/shard-costs.json`

- **Sweep:** re-run the codemod over `tests/**/*.ts` to catch cases other PRs added in the old spelling while stages 1–4 ran, and verify with arrow-verify `--applied`.
- **Inline Nish:** rewrite the Nish source held in strings in `tests/run.js` (41), `tests/ffi-string.js`, `tests/ffi-buffer.js`, `tests/ffi-struct.js`, and the program generator in `tests/differential/fuzz.js`, so that generated programs use arrows. JavaScript functions in those files are not Nish and are not touched. nish-cmp's fuzz rows use a fixed seed. If the generator change moves their IR, that is a finding.
- **Check:** a `tests/run.js` check whose name contains `arrow-corpus`. It runs the codemod's `--check` logic, or the same parse, over every tracked `tests/**/*.ts`. It fails on a top-level `function` definition in any file not listed in `tests/function-spelling-allowlist.txt` (one path per line, each with a `#` reason), and it fails on a listed file that no longer holds one, so the list only shrinks. The failure message names the file and `node scripts/arrowify.mjs <file>`. Prove the check with a negative: write a temporary case that holds a `function`, show that the check fails, and show that it passes once the case is removed (a test of the check function, not a committed bad case). Add its cost to `tests/shard-costs.json` if the sharding requires it.
- **Docs:** design note §7 table (fresh counts), §8 table (C: done), §10 count. Roadmap page: tick "C: rewrite the test corpus", Done 4 of 5, **Next** stays the stage D decision. Update the `docs/roadmap/index.md` row. Do not touch `.claude/`, `AGENTS.md` or `CLAUDE.md` (CODEOWNERS).

## Amendments

- **2026-11-18, round 1 of `cases-positive`:** `tests/differential/goldens/rewrites.txt` keys each frozen rewrite on a hash of its sources, and nothing can re-freeze one since stage0 left. A rewritten `cases/` or `corpus/` program therefore drops out of the differential oracle on `--update` (77 programs in `cases-positive`'s first push). `fixtures` now also owns `tests/differential/goldens.js`. It adds a re-key mode: the source at the base revision must hash to the frozen key, and `arrowify` of that source must reproduce the working-tree file byte for byte. Only then is the key moved and the stored rewrite kept. **Merge-order edge: `cases-positive` merges after `fixtures`** and re-keys its cases with that mode. `cases-reject` and `link-wordings` hold no frozen programs.

## Out of scope

- Stage D: refusing `function`, the `NL2149` / `NL2229` wordings, and the §9a decisions about `fn-add-function.ts` and `arrow-parity/declared.ts`.
- `--concise` collapsing in the corpus.
- Class methods (WP22 §3), `declare function`, generators, and `async`.
- `runtime/shim.mjs`, `bin/launcher.js`, and JavaScript functions in the harnesses.

## Verification

Each stage runs its `verification` line, `npm run check`, `npm run lint`, and the `node tests/run.js <filter>` sections it touches. CI's eight `test` shards, `lint`, `bootstrap`, `nish-cmp` and the Nish golden runner are the full-suite gate.
