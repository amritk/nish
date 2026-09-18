---
name: WP19 R1 — take the parity gate green and keep it there
overview: Close every undeclared stage0/stage1 difference `node tests/run.js --parity` reports, then make a reintroduced difference visible on the pull request that causes it rather than in a nightly run nobody opened.
stages:
  - id: cptr-debug
    title: The `-g` internal compiler error on a `CPtr` program
    goal: stage1 compiles a `CPtr` program under `-g` with the same exit status, stdout and stderr as stage0, instead of exiting 70.
    verification: npm run build && node tests/run.js --parity --only ffi_pointer  — reports 0 undeclared difference(s); npm test undegraded
    status: pending
    todos:
      - id: cptr-repro
        content: Reproduce the exit-70 internal compiler error under `-g` and capture the ICE object verbatim — see The CPtr debug-info failure
        status: pending
      - id: cptr-fix
        content: Fix the debug-info path in self/debug.ts so an opaque foreign pointer is named the way stage0 names it — see The CPtr debug-info failure
        status: pending
      - id: cptr-golden
        content: Add a golden case pinning `-g` over a `CPtr` program, compiled by both compilers — see The CPtr debug-info failure
        status: pending
      - id: cptr-doc
        content: Record the rule the fix follows in docs/wp27-ffi.md — see The CPtr debug-info failure
        status: pending
  - id: generic-cascade
    title: The second diagnostic after the termination refusal
    goal: Both compilers answer `reject_generic_expanding_field` with the same stderr, line for line, under every variation.
    verification: npm run build && node tests/run.js --parity --only reject_generic_expanding_field  — reports 0 undeclared difference(s); npm test undegraded
    status: pending
    todos:
      - id: cascade-repro
        content: Reproduce both compilers' stderr for the case and record what each says after line 1 — see The cascading diagnostic
        status: pending
      - id: cascade-decide
        content: Decide whether the compilers stop after the termination refusal or agree on the second diagnostic, and write the argument in the PR body — see The cascading diagnostic
        status: pending
      - id: cascade-fix
        content: Implement the decision in src/checker/generics.ts and self/generics.ts, and update the golden — see The cascading diagnostic
        status: pending
      - id: cascade-pin
        content: Pin the agreed wording with a tests/wordings case so the code cannot drift — see The cascading diagnostic
        status: pending
      - id: cascade-doc
        content: Record what was decided in docs/wp18-generics.md — see The cascading diagnostic
        status: pending
  - id: gate-visible
    title: A gate that is red where somebody will see it
    goal: A reintroduced difference is red on the pull request that causes it, and a red nightly reaches the issue tracker on its own.
    verification: npm test && npm run build && node tests/run.js --parity  — reports 0 undeclared difference(s) on this branch once the two fix stages have merged into it
    status: pending
    todos:
      - id: gate-record
        content: Prove the record job in .github/workflows/parity.yml fires on a red full run, and fix it if it does not — see The alarm nobody has heard
        status: pending
      - id: gate-pr
        content: Add a bounded parity check to the pull-request path so a reintroduced difference is red there, with its added minutes measured — see A gate on the push path
        status: pending
      - id: gate-coverage
        content: Fix the registry read in tests/diagnostic_coverage.js that makes its coverage half unable to fail — see A gate that cannot fail
        status: pending
      - id: gate-measure
        content: Re-measure the mode and rewrite the R1 row of docs/wp19-stage0-retirement.md with its date — see The measurement, with its date
        status: pending
      - id: gate-masterplan
        content: Bring the R1 sentence in docs/MASTER_PLAN.md into agreement with the re-measured row — see The measurement, with its date
        status: pending
---

## Context

`node tests/run.js --parity` compiles the whole corpus with both compilers under every flag variation and compares exit status, stdout, stderr and every file written. It is the only check that asks whether a program or a flag is still stage0's, and WP19 R1 — the first of the six gates stage0's retirement stands on — is green exactly when its undeclared difference set is empty.

It is not green. The nightly [Parity workflow](../../.github/workflows/parity.yml) has been red on its last four runs, and on 2026-09-17 it reported `13020 runs over 868 programs (2120.3 s); 55 undeclared difference(s), 2646 declared`. Three classes account for the 55: the `ModuleID` path spelling in the two `std/` link cases, the `-g` internal compiler error on a `CPtr` program, and a diagnostic mismatch on `reject_generic_expanding_field`. The first of those is closed: re-measured on the base SHA on 2026-09-18, the mode reports `13230 runs over 882 programs (2384.2 s); 18 undeclared difference(s), 2674 declared`, and all 18 are the other two classes — 4 rows of the `-g` internal compiler error and 14 of the diagnostic mismatch.

Two things about the gate matter as much as the difference set. All four red runs happened at a SHA whose `parity.yml` had no `record` job, so no issue was opened and the gate's red state has been visible only to somebody who opened the run — which is the failure wp19 §A5 records having cost the project once already. And the mode runs nightly on `main` only, so a pull request can reintroduce a difference and merge green; that is how the `CPtr` internal compiler error reached `main` in the first place.

## The CPtr debug-info failure

stage1 exits 70 — the internal-compiler-error status — compiling a `CPtr` program under `-g`, where stage0 compiles it. Four rows of the difference set are this, over **two** programs — `tests/cases/ffi_pointer.ts` and `docs/cookbook/decl_ffi_pointer.ts` — each contributing an `exit` row and a `files` row, because stage0 writes the `.ll` and stage1 writes nothing.

`CPtr` is opaque by construction (`docs/wp27-ffi.md`): the compiler knows nothing about what the pointer addresses, and the escape classifier and `isPointerParam` are allow-lists that a foreign pointer falls out of. Debug-info emission is the one path that has to say something about a type it has no structure for, and it is where an allow-list that returns nothing meets a caller that expects a name.

Reproduce it first, with the exact command the mode runs, and read the ICE object rather than guessing from the exit status. The fix belongs in the debug-info path in both compilers if both are wrong and in `self/` alone if stage0 is right; whichever it is, `-g` over a `CPtr` program has no golden today, which is why nothing caught this.

**Owns:** `self/debug.ts`, `src/codegen/debug.ts`, `self/ice.ts`, `self/types.ts`, `tests/cases/ffi_pointer*`, `tests/cases/dbg_*`, `docs/cookbook/decl_ffi_pointer*`, `docs/wp27-ffi.md`, `tests/self/goldens/**`

## The cascading diagnostic

`tests/cases/reject_generic_expanding_field.ts` is refused by both compilers with the termination rule the golden `.err` pins, and then each emits a *second* diagnostic, on line 13, and the two do not agree — stage1 says ``null` needs a contextual `T | null` type` at 13:22, stage0 says `Unknown field `inner` on class `Nest$i32`` at 13:12. Fourteen rows of the difference set are this one case under fourteen variations.

Both second diagnostics are cascades from the refused instantiation — one compiler carries on with a class that has no `inner`, the other with a field whose type never got made. The decision is which of two shapes the language wants, and it is a decision rather than a bug fix, so the PR body carries the argument:

- **Stop after the termination refusal.** A monomorphisation that cannot terminate leaves no type to check against, so every later diagnostic about the instantiated class is noise. This is the smaller change if the driver already has a point where checking can stop.
- **Agree on the second diagnostic.** Keeps multi-error output, but makes both compilers model a failed instantiation the same way, which is the larger change.

Either way the outcome is pinned by a `tests/wordings/` case, because a wording that only a golden holds drifts.

**Owns:** `src/checker/index.ts`, `src/checker/generics.ts`, `self/generics.ts`, `src/checker/nullable.ts`, `src/compilation.ts`, `self/compilation.ts`, `tests/cases/reject_generic_expanding_field*`, `tests/wordings/**`, `docs/wp18-generics.md`, `tests/self/goldens/**`

## The alarm nobody has heard

`parity.yml` already has a `record` job that opens an issue on a red or unmeasured full run and closes it on a green one. It has never run: every red night so far was at a SHA that predates the job. Prove it works against a real run — `workflow_dispatch` on this stage's branch, with the corpus still red — and read what it actually does rather than what the YAML says it does. Two conditions are worth reading carefully before trusting them: `inputs.only == ''` on a `schedule` event, where `inputs` is null, and the artifact upload step that the same condition guards.

## A gate on the push path

The nightly fixes "nobody remembered to type the command". It does not stop a pull request from merging a difference, and that is how this one landed. The full corpus takes 35 minutes on a hosted runner and grows with every program, so putting it on every push is the trade `ci.yml` already argues against — the check has to be bounded.

Bound it by what the pull request touched: the corpus programs its diff adds or changes, plus the flag-set half that already runs in `npm test`. A pull request that changes no corpus program pays nothing; one that adds a case pays that case. State the added minutes as a measurement in the PR body, taken from the check's own run, not as an estimate.

This stage merges after the other two. A per-pull-request parity check introduced while the corpus is red would be red on every pull request in the repository, including its own.

**Owns:** `.github/workflows/parity.yml`, `.github/workflows/ci.yml`, `tests/self/parity.js`, `tests/run.js`, `docs/wp19-stage0-retirement.md`, `docs/MASTER_PLAN.md`

## A gate that cannot fail

Review of the second fix stage turned up a third gate that is not doing its job, and it is this stage's rather than that one's. `tests/diagnostic_coverage.js`'s `registry()` matches a code with `^ {4}("...")`, four literal spaces, but `self/codes.ts` has been two-space indented since the arrow refactor. It therefore parses **0 of 408** codes, `--require-coverage` iterates an empty map and can never fail, and the per-case registry-fragment cross-check is silently skipped for every case. Run on the branch it reports `coverage 0/0 codes` and exits 0.

It is pre-existing — the same regex and the same indentation are on `main` — and `tests/run.js:719-728` already fixed this exact trap with `^\s+` and documents it, so the fix is to read the codes the way the other tool learned to. What it is *not* is a widening of this stage: the stage exists to make a gate red where somebody will see it, and a gate that cannot go red at all is the same defect one step further along.

Expect turning it on to reveal codes that nothing provokes. Those are a finding to report with their count, not a reason to leave the parser broken; if the list is long enough to be its own work package, say so with the number and pin the parser fix on its own.

## The measurement, with its date

wp19 §A7 is explicit that a parity number goes stale in about a day and that a row without a date is not a measurement. So the R1 row is rewritten from a run this work performed, quoting the mode's own summary line and the day it was taken, and the sentence in `docs/MASTER_PLAN.md` §9 that repeats it is brought into agreement in the same pull request.

## The goldens both fix stages move

`tests/self/goldens/` records what stage1 prints — `checked.txt` for every positive corpus program, `checked_self.txt` for the modules of `self/` — so any change to a `self/` module, and any new corpus program, moves them. Both fix stages do both, and `npm test` fails until the goldens are regenerated: `node tests/self/goldens.js --update`, never by hand.

That makes it the one file set two concurrent stages share, which the slicing rules otherwise forbid. It is admissible here for one reason and only this one: it is **generated**, so a conflict between the two branches is resolved by regenerating on the later one rather than by choosing lines. The rule each stage follows is the same — regenerate, then read the diff and confirm every moved line is explained by its own change, because a golden that moved for a reason the stage cannot name is the failure this file set exists to catch.

## Out of scope

- **R2 and R4** — the second operating system, the darwin fixed point, the seed matrix, the installer and the npm registry name. None of them is a difference between the two compilers.
- **R6** — deleting stage0. R1 being green makes retirement possible; it is not an argument that it is due (wp19 §7).
- **Closing a difference by declaring it** unless the declaration is a rule with a reason. A declaration that only says "these differ" turns the gate off, which is the one outcome worse than red.
- **Widening `tests/self/parity.js`'s declared set to reach green.** Both fix stages are forbidden to edit that file at all; it belongs to the third stage.

## Tests

- `tests/cases/` — one new golden per fix, compiled by both compilers, plus the `-g` case the `CPtr` class had none of.
- `tests/wordings/` — the diagnostic the second stage settles on, so `tests/diagnostic_coverage.js` keeps counting it.
- `node tests/run.js --parity --only <fragment>` — the scoped form each stage verifies with.

## Verification

```
npm run check
npm run lint
npm test
npm run build && node tests/run.js --parity
```

The last one is the gate: it is green when it prints `0 undeclared difference(s)`.
