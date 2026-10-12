---
name: Tidy up after the AES-GCM kernel run
overview: Write down the five conventions the AES-GCM kernel run (#577, ledger #579) paid for, make CI's runtime size report print the ceilings the runtime-budget gate actually applies, and re-time the bitsliced AES fallback against the ce9d394 baseline to see whether the pre-registered 3.0% minimum band now holds.
stages:
  - id: claude-md-conventions
    title: "docs: record the AES-GCM kernel run's conventions in CLAUDE.md"
    goal: CLAUDE.md states the five conventions the kernel run learned, each in the file's existing style
    verification: npm run lint
    status: pending
    todos:
      - id: conv-ci-mergeability
        content: Add the conflicting-PR-gets-no-CI convention (check mergeability first when a push shows no runs, #594) — see Stage 1
        status: pending
      - id: conv-runtime-unit
        content: Add the new-runtime-unit convention (build.sh halves and run-cache.ts runtimeUnits() in one commit) — see Stage 1
        status: pending
      - id: conv-runtime-prelude
        content: Add the src/runtime.ts declaration moves the IR_COOKBOOK runtime prelude convention (regen.sh in the same change) — see Stage 1
        status: pending
      - id: conv-wasm-profile
        content: Add the wasm32-skip-also-covers-profile-wasm convention — see Stage 1
        status: pending
      - id: conv-cpuinfo-pass
        content: Add the cpuinfo-gated-positive-check-needs-a-CI-grep convention — see Stage 1
        status: pending
  - id: size-report-budgets
    title: "fix(build): make the size report print the ceilings the runtime-budget gate applies"
    goal: scripts/size-report.sh and node tests/run.js runtime-budget read the same ceilings for the same units, from one source
    verification: bash scripts/size-report.sh && node tests/run.js runtime-budget
    status: pending
    todos:
      - id: budgets-one-source
        content: Give the runtime .text ceilings one source both tests/run.js and scripts/size-report.sh read — see Stage 2
        status: pending
      - id: report-every-unit
        content: Make scripts/size-report.sh print a row for every unit and configuration the gate measures, with that unit's ceiling — see Stage 2
        status: pending
      - id: pin-report-gate-agree
        content: Add a check in tests/run.js that fails when the report and the gate disagree on a unit or a ceiling — see Stage 2
        status: pending
      - id: docs-size-report
        content: Correct docs/ARCHITECTURE.md's size-report description to match — see Stage 2
        status: pending
  - id: aes-fallback-retime
    title: "docs(bench): re-time the bitsliced AES fallback against the ce9d394 baseline"
    goal: A fresh NISH_AES=soft run against a ce9d394 build is recorded in docs/wp38-simd.md, and the S5 verdict moves only if the 3.0% minimum band held
    verification: NISH_AES=soft node bench/aes-gcm.mjs --check && npm run lint
    status: pending
    todos:
      - id: build-ce9d394
        content: Build bench/aes-gcm.ts as it stood at ce9d394 into a binary outside the tree — see Stage 3
        status: pending
      - id: run-fallback-bench
        content: Run NISH_AES=soft node bench/aes-gcm.mjs --self --binary <ce9d394 build> on the quietest host available — see Stage 3
        status: pending
      - id: record-result
        content: Record the run in docs/wp38-simd.md, and update section 2.3 and the section 7 S5 row only if the 3.0% minimum band held — see Stage 3
        status: pending
---

# Tidy up after the AES-GCM kernel run

## Context

The AES-GCM kernel run (#577, tracking issue #579) merged `runtime/runtime-aes.c` (#594) and left three loose ends: lessons its PRs paid for that no rule records, a CI size report that disagrees with the gate on `main`, and a fallback verdict read at the median because the 3.0% minimum band did not hold on a noisy machine.

All three stages touch disjoint files and run concurrently. None touches `src/`, `std/` or a positive `tests/cases/*`, so no generated golden moves and the rolling freeze does not apply.

| Stage | Owns | Model |
| --- | --- | --- |
| `claude-md-conventions` | `CLAUDE.md` | lead |
| `size-report-budgets` | `scripts/size-report.sh`, `tests/run.js`, `tests/runtime-budgets.*` (new, if chosen), `docs/ARCHITECTURE.md`, `docs/wp7-runtime.md` | lead |
| `aes-fallback-retime` | `docs/wp38-simd.md` | lead |

No stage edits `.github/workflows/**`; a stage that finds it needs to says so in its PR body instead.

## Stage 1: claude-md-conventions

**Owns:** `CLAUDE.md`

Add five conventions to [`CLAUDE.md`](../../CLAUDE.md), each in the file's existing style: a bold lead sentence stating the rule, then the incident that taught it by PR number, placed in the section it belongs to (git/PR conventions under "Git & PR Guidelines", compiler conventions beside the existing `src/` paragraphs). Tighten wording to match the file; do not change what each rule says.

1. A PR that conflicts with `main` gets no `pull_request` CI. When a push shows no runs, check mergeability first (#594 lost two heads to this).
2. A new runtime unit goes into `scripts/build.sh`'s `halves` and `src/run-cache.ts`'s `runtimeUnits()` in the same commit. Either one alone makes `--runtime-from` exit 2 on every cached link.
3. A declaration added to `src/runtime.ts` moves `docs/IR_COOKBOOK.md`'s runtime prelude. Regenerate it with `docs/cookbook/regen.sh` in the same change.
4. A lowering skipped for wasm32 must also cover the freestanding `--profile wasm` route, whose IR is compiled for the host.
5. A positive check gated on `/proc/cpuinfo` needs a CI step that greps its PASS line, or a masked runner turns it vacuous.

Before writing each, confirm the names it cites exist (`halves` in `scripts/build.sh`, `runtimeUnits` in `src/run-cache.ts`, `docs/cookbook/regen.sh`, the `<!-- cookbook:begin runtime-prelude -->` block). Commit type `docs`, no scope needed.

## Stage 2: size-report-budgets

**Owns:** `scripts/size-report.sh`, `tests/run.js`, `tests/runtime-budgets.*`, `docs/ARCHITECTURE.md`, `docs/wp7-runtime.md`

**Why they disagree.** [`scripts/size-report.sh`](../../scripts/size-report.sh) hard-codes its ceilings in the row labels: `budget 3584` for `runtime.c` and `budget 1280` for `runtime-os.c`. The gate in [`tests/run.js`](../../tests/run.js) (`runtime-budget` section, around line 9036) applies `RUNTIME_TEXT_BUDGET = 3606` and `RUNTIME_OS_TEXT_BUDGET = 1536` to the same measurement (`.text*` of `clang -Oz -c`). Both constants were raised in recorded commits (`nish_wipe`, checked arithmetic, `nish_realpath`, `nish_read_file_bytes`); the report's labels were never moved. So 3,601 and 1,530 are the same numbers the gate measures, and they pass the real ceilings. The report also omits seven of the gate's nine rows (`-DNISH_THREADS=1`, parallel ×2, host, net, simd, aes), though `docs/ARCHITECTURE.md` says it "reports every row". Confirm this diagnosis on the worker's host before changing anything: run both and compare the figures.

**Fix: one source.** Move the gate's table (file, flags, ceiling, constant name) where both can read it, and have the report print one row per entry with that entry's ceiling, so neither can drift from the other again. A small data module beside `tests/run.js` (`tests/runtime-budgets.mjs` or `.json`) that `run.js` imports and the script reads through `node` is the suggested shape; the measurement-history comments stay with each constant. Any equivalent single-source design is acceptable; a second hand-maintained copy is not.

**Never raise a budget.** Every `*_TEXT_BUDGET` value is byte-identical before and after. If a unit is over its real ceiling, that is a finding for the PR body, not a number to change.

**Pin it.** A `tests/run.js` check that runs the report (or reads what it would print) and fails when a unit the gate measures is missing from it, or when a ceiling differs. Add a negative: a report fed a stale ceiling fails it.

**Docs.** Correct `docs/ARCHITECTURE.md`'s size-report sentences (lines ~273 and ~687) to what the report now prints; `docs/wp7-runtime.md` only if it describes the report's rows. `knip` (`npm run lint:dead`) must stay clean if a new file is added. Commit type `fix(build)` or `ci` as fits; the body is the changelog entry and says why the two disagreed.

## Stage 3: aes-fallback-retime

**Owns:** `docs/wp38-simd.md`

A measurement stage. The only file changed is the doc; build products stay under `build/` or the scratchpad.

1. **The baseline binary.** Build `bench/aes-gcm.ts` as it stood at `ce9d394` — the S5 baseline (§7 S5: "Baseline measured at `ce9d394`"). Use a worktree at `ce9d394`, build its compiler with the seed that commit's own bootstrap expects (`bash scripts/fetch-seed.sh --force` there), and build the bench with `--profile speed` exactly as `bench/aes-gcm.mjs` builds its baseline. `bench/aes-gcm.ts` does not exist at `ce9d394` (it came later), so copy `main`'s `bench/aes-gcm.ts` into the `ce9d394` worktree and build it there, against that commit's compiler and `std/`, and say so in the record. If it does not compile there, find how the earlier samples' baseline was built (§2.3's S5 baseline section and the PRs it cites) and do the same; if neither works, open the PR as a draft saying exactly what blocked it. The checksum must match the soft column's on every run, or the run stops by design.
2. **The run.** On `main`'s `build/nish` (`npm run build` after `bash scripts/fetch-seed.sh --force`): `NISH_AES=soft node bench/aes-gcm.mjs --self --binary <ce9d394 build> --runs 48` (≥ 48 rounds, the longest of the three prior samples). The quietest host available is this worker's container: record `uptime` load averages before and after, `nproc`, the CPU model, and that nothing else ran. If the container's CPU lacks AES-NI that does not matter for `soft`, but record it.
3. **Read it against the pre-registered bar**: the fallback (baseline column under `NISH_AES=soft`) is not slower than the `ce9d394` column outside 3.0% at the minimum and 11.1% at the median, on all nine workloads, with the `--self` copy's spread reported as the noise band.
   - **Band held** (every workload's soft minimum within +3.0% of `ce9d394`'s *and* the self copy's own minimum within 3.0%): update §2.3's "The fallback" paragraph and conclusion and the §7 S5 row's fallback sentence to say the pre-registered bar holds at the minimum too, citing this run.
   - **Band did not hold**: add the run as a fourth sample in §2.3 (host, command, rounds, checksum, per-workload soft min/median and band), state that the minimum band again does not hold on this host, and leave the median verdict and the §7 row as they are.
4. Commit `docs(bench): …` with a `Measured:` trailer carrying the headline figures and the noise band, copied from the bench's own output.

## Out of scope

- Raising, lowering or re-measuring any runtime `.text` ceiling.
- Editing `.github/workflows/**` (a merge-gate sensitive path); the CI step that runs the report stays as it is.
- Changing `std/crypto/aes.ts`, `runtime/runtime-aes.c` or the bench program.
- Conventions beyond the five listed.

## Tests

- Stage 2: the new `tests/run.js` check (positive and negative) beside the `runtime-budget` section.
- Stages 1 and 3: documentation only; `npm test`'s docs checks must stay green.

## Verification

Every stage, before its PR: `npm run check`, `npm run lint`, and an undegraded `npm test` (read the skip count against `main`'s), plus its own stage verification command above.
