---
name: Settle CT-13 (#378) and the macEqual reading (#599), and say whether #477 is unblocked
overview: Two open timing readings in the constant-time record. CT-13 is `ladderStep`'s |t| = 35–42 from #377, never reproduced since #537 held the harness to the module's domain; #599 is the weekly run's `macEqual` |t| = 5.64 on the x64 runner, with arm64 clean and the next weekly run (2026-10-19) reading 3.35. Re-measure both, decide for each whether it is a leak or an artefact of the harness, change the harness where it is at fault, fix code only for a confirmed leak, and record the verdicts in docs/security/ct-verification.md. One stage, because both readings share the harness and the record.
stages:
  - id: settle-readings
    title: "test(ct): settle the ladderStep (CT-13) and macEqual timing readings"
    goal: CT-13 and the macEqual reading each carry a verdict — leak or artefact — backed by readings taken at the PR head, in docs/security/ct-verification.md, with the harness changed if it caused either and code changed only if one is a real leak
    verification: node tests/ct-timing.js --quick exits 0; node tests/ct-timing.js --samples 1000000 run at least 3 times on this VM with every verdict ok and the controls differing; a workflow_dispatch of ct-timing.yml on the branch green on both runners; npm run check, npm run lint and an undegraded npm test green
    status: pending
    todos:
      - id: ct13-rerun
        content: Re-run ladderStep in the module's domain (DOMAINS as committed) and out of it, in the full seven-function driver and linked alone, several seeds each at 1,000,000 samples on this VM (the same Intel Xeon @ 2.80GHz class CT-13 was read on) — see CT-13
        status: pending
      - id: mac-rerun
        content: Re-run ct_asm_mac at 1,000,000 samples, many seeds, and characterise what produced 5.64 (which test, which percentile, whether it repeats, what the fixed and random classes hand macEqual) — see macEqual
        status: pending
      - id: ci-readings
        content: Dispatch ct-timing.yml on the branch (x64 AMD EPYC runner and arm64) at the PR head and take its readings as the second machine for both — see CI readings
        status: pending
      - id: harness-fix
        content: If either reading is the harness's doing, change tests/ct-timing.js (and dudect.c / ct-timing.yml if the fault is there) so it cannot recur, keeping every control required to differ — see The harness
        status: pending
      - id: code-fix
        content: Only if a reading repeats and is shown to be the code, find the instruction responsible and fix std/crypto (and the mirroring fixture), with a before/after reading — see A real leak
        status: pending
      - id: record
        content: Record both verdicts in docs/security/ct-verification.md — CT-13's row and its readings section, and a new row for macEqual citing #599 — with the commit the anchors are at — see The record
        status: pending
---

# Settle CT-13 and the macEqual reading

## Context

- **CT-13 (#378).** `ladderStep` read |t| = 35–42 at 300,000 samples when the
  driver linked all seven x25519 functions, on an Intel Xeon @ 2.80GHz VM, and
  1.4–2.9 alone. #537 added `DOMAINS` to `tests/ct-timing.js` (signed limbs
  below 2^26 / 2^27, a 0/1 swap) with domain controls, and took 34 runs on that
  VM class that read 1.46–3.22. The row stays open because the 35–42 "was never
  re-run on the host that produced it", its cause is unmeasured, and only the
  x86-64 code was inventoried. Weekly CI since: 1.17 / 2.09 (10-05), 1.24 /
  1.44 (10-12), 1.22 (x64, 10-19).
- **macEqual (#599).** Weekly run 38205978049 (2026-10-12, AMD EPYC 7763,
  1,000,000 samples): `macEqual` |t| = 5.64 from "cropped, 89", batch 4,
  uncropped t −0.915; arm64 1.71. Run 39201550804 (2026-10-19, same runner
  type): 3.35 from "cropped, 76". The max is taken over 102 tests per function
  (100 cropped percentiles, uncropped, second order) across 46 functions and
  two runners every week.
- **#477** (extend `tests/ct-asm.js` to each module's "discipline" loops) asks
  for CT-13 to be settled first or alongside.

## CT-13

Readings at the PR head: in domain and out, full driver and `ladderStep`
alone, at least four seeds each, 1,000,000 samples. A scratch filter for
"alone" stays uncommitted unless the harness gains a committed way to do it
(a fixture/function filter is acceptable if small). The verdict is one of:

- **artefact** — it does not reproduce in any configuration on the same CPU
  class or on either CI runner, with the reason the record can state (out of
  domain inputs on a layout since moved by #426, as #537 measured), and the
  row closes;
- **leak** — it reproduces in domain: go to *A real leak*;
- **still open** — only with a named measurement that would settle it and
  why it could not be taken here. Not a default.

Also inventory the aarch64 code of `ladderStep` (clang `--target=aarch64`,
`-O2`) for any operand-dependent-latency instruction, which #537 did not do.

## macEqual

Find what the 5.64 was. Questions to answer with measurements: does any
seed at 1,000,000 samples cross 4.5 on this VM; how is |t| spread across the
102 tests for macEqual against a function known to be quiet (e.g.
`tableLookup`, `timingSafeEqual32`); what false-positive rate does "max over
102 correlated tests, 46 functions, two runners, weekly" give under the null
(a permutation or A/A run — the same class on both sides — measures this
directly); and whether the fixed class gives macEqual something structurally
different (equal tags, all-zero bytes) from the random class.

## CI readings

`ct-timing.yml` has a `workflow_dispatch` trigger. Dispatch it on the branch
once the harness is final, and quote both runners' rows for `ladderStep` and
`macEqual`. A red run's `report` job comments on the open `ct-timing` issue;
that is expected and the PR body says so.

## The harness

If the macEqual reading is the max-of-many-tests false positive, the fix
belongs in the harness, not the code: for example a function above the
threshold is re-measured with a fresh seed in the same run and is a finding
only if it crosses again, which is what #599's own text tells a reader to do
by hand. Whatever the change:

- each `control` (`ct_asm_refused`, the `DOMAINS` controls) must still be
  required to differ, on first measurement, or the run fails;
- the table says when a function crossed once and did not repeat, rather
  than hiding it;
- the change is justified by a measured null rate, not by the one reading;
- the header comments, the workflow's prose and `docs/security/ct-verification.md`
  say what the new rule is.

## A real leak

Only if a reading repeats on fresh seeds in domain on the same machine, and
the A/A null does not explain it. Find the instruction (disassembly at `-O2`,
then bisect the function body in a scratch fixture), fix
`std/crypto/x25519.ts` or the code `macEqual` mirrors, keep the fixture in
step, and show the reading before and after. A code fix in `std/` regenerates
`tests/self/goldens/checked.txt` with `node tests/self/goldens.js --update`.

## The record

`docs/security/ct-verification.md`: CT-13's row and `## CT-13: the readings`
updated with the new readings and the verdict; a new row (next free CT-n) for
the macEqual reading, citing #599 and both weekly runs; a Tests row for any
new harness behaviour, named by its exact string; anchors at a stated commit.
Check `docs/security/README.md`'s counts if a row's state changes. The PR
body says whether #477 is unblocked and why, and carries `Fixes #378` and
`Fixes #599` only for verdicts that close them.

**Owns:** `tests/ct-timing.js`, `tests/ct-timing/**`, `.github/workflows/ct-timing.yml`, `docs/security/ct-verification.md`, `docs/security/README.md`, `tests/cases/ct_asm_x25519.ts`, `tests/cases/ct_asm_mac.ts`, `std/crypto/x25519.ts`, `tests/self/goldens/**`

## Verification

- `node tests/ct-timing.js --quick` exits 0.
- `node tests/ct-timing.js --samples 1000000` three times on this VM: every
  verdict ok, controls differ (or, for a leak, the leak shown before and gone
  after).
- `ct-timing.yml` dispatched on the branch, green on both runners.
- `npm run check`, `npm run lint`, an undegraded `npm test`.
