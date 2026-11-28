# std-instruction-gate: run report

Tracking issue: #2440. The run started at 05:40Z and hit its 8-hour deadline at 13:40Z on 2026-11-28.

## What was asked

- Fix the instruction-count regression in `jsonValueRoom` / `jsonValueRoomI32` that PR #2103 introduced. It came from a push loop. The fix is one `new Array` with a guarded set.
- Audit `std/` for other push-loop copies and fills, giving a before/after delta for each helper.
- Count six more std programs in `bench/instructions.json`.
- Add a coverage check, with a reasoned exemption list, that fails when a scanned std module is reached by no counted program.
- Make an instruction-count raise need a named `raises` entry: `--update` refuses an unnamed raise, and CI compares the head against the merge-base and writes a step-summary table.
- Add the rule "a change removing a panic site may not raise an instruction count" to CLAUDE.md and to the open std-panics plans.
- Optionally, count emit-ts encodes.

## What merged

| stage | PR | squash commit | review rounds | merged by |
|---|---|---|---|---|
| s3-raise-guard | #2444 | 1d309db1 | r1: 1 blocking · r2: 0 (delta) | lead |
| s4-rule-ci | #2448 | bb459380 | r1: 0 · r2: 0 (delta) | the owner (CODEOWNERS paths) |
| s1-room-fix | #2449 | 6c7da243 | r1: 2 blocking · r2: 1 · r3: 1, fixed and checked at the gate | lead |
| s2-counted-rows | #2462 | 21757b38 | r1: 1 blocking · r2: 0 (delta) | lead |

**s1, #2449**
- Rewrote `jsonValueRoom(I32)` and four more push-loop zero fills to a single `new Array`: `upstreamBytes`, `upstreamSlots`, `http1ClientZeros` and `tlsZeros`.
- Every early return the guards first added was replaced by a proof of the regrown lengths.
- The PR body has an instruction delta for each audited helper.
- Round 2 caught a +2.02M raise on std-http1 against main's CI. The fix took it to 114,012,250, which is −0.106%.

**s3, #2444**
- Each counted row now carries `commit` and `valgrind` stamps.
- `--update` refuses a raise unless `--raise … --why … --pr` names it.
- Added `scripts/instruction-raises.mjs` and its fixtures.

**s4, #2448**
- CI's PR lane compares the head's counts against the merge-base under `ci-gate` and writes a base/head/delta% table to the step summary.
- Added the rule to CLAUDE.md and to the wp8x std-panics plans.

**s2, #2462**
- Added six counted rows, all from CI shard 8/9 job 140986157500:

  | row | count |
  |---|---|
  | std-json-value-parse | 338,923,870 |
  | std-json-value-reuse | 321,271,283 |
  | std-json-value-read | 293,062,923 |
  | std-yaml-json-load | 263,941,182 |
  | std-regex | 326,875,516 |
  | std-text | 278,871,048 |

- Lowered 19 existing rows to the counts CI measured after s1. The biggest drops were net-dns-message (−9.55%), chacha20poly1305-seal (−7.5%) and pg-codec (−6.65%).
- Added the std-module coverage check (`bench/instructions-exempt.txt`, every line with a reason). It routes the compile through `spawnNish`.

## Acceptance (main @ 21757b38)

ACCEPTANCE

## Not done

- **s5-prover-length** was not started because of the deadline. It would teach `src/bounds.ts` to prove the regrown-array lengths, so std guards like the ones in s1 need no hand-proved length.
- **s6-emit-ts-encodes** was not started because of the deadline. It was optional.

Both stay in `.claude/plans/std-instruction-gate.plan.md` on the `feature/std-instruction-gate/plan` branch. That plan branch is not merged.

## Deferred findings (non-blocking, sent once to the PR)

- **#2462 N1:** a ci.yml change was outside s2's Owns.
- **#2462 N3:** more bench programs, to cover modules that are now exempt, were outside s2's Owns.
- **#2462 N6:** each written row's `commit` stamp is `8451307aa`, a branch SHA that the squash merge drops. Re-stamping those rows to 21757b38 would make them reachable from `main`.
- **#2462 N7:** the file-level `valgrind` in `bench/instructions.json` still reads 3.22.0, while every row CI writes is measured under 3.26.0. This was already the case before the run.
- **#2448:** the `ci.yml` check does not pin the run body. The step summary labels its base with the payload's `base.sha`.

## Needs a human

- Decide whether to re-stamp the s2 rows' `commit` field (N6) and the file-level `valgrind` (N7). Both are small edits to `bench/instructions.json`.
- Pick up s5, and s6 if wanted, in a fresh `/feature` run or by hand from the plan branch.
