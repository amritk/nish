---
name: bcrypt on BMI2 — measured verdict
overview: Measure whether a BMI2 kernel (or a generator change) makes nish/crypto/bcrypt meaningfully faster on modern x86-64, commit the benchmark and the ceiling harness that answer it, ship a generator change only if it clears its noise band, and record the verdict in the bcrypt security record's Speed section the way the Adler-32 verdict was recorded.
stages:
  - id: bcrypt-verdict
    title: bcrypt BMI2 — benchmark, ceiling and verdict
    goal: The repo can reproduce per-width ns/hash for default and x86-64-v3 builds plus a hand-kernel ceiling, and its docs state the measured verdict on a BMI2 kernel
    verification: npm run check && npm run lint && node tests/run.js bcrypt && node bench/crypto/bcrypt/run.mjs --rounds 5 --cpu-both && node bench/crypto/bcrypt/ceiling.mjs --rounds 5
    todos:
      - id: bench-cpu-both
        content: Extend bench/crypto/bcrypt/run.mjs to build and time the width 1–6 rows under both the default target and --cpu x86-64-v3 — see Benchmark
        status: pending
      - id: ceiling-harness
        content: Add bench/crypto/bcrypt/ceiling.mjs plus a kernel generator and C harness that time a spill-free hand-written x86-64 round kernel (baseline, rorx+shr, rorx+movzx) against Nish's widths — see Ceiling harness
        status: pending
      - id: generator-experiment
        content: Try the generator change in bench/crypto/bcrypt/gen-body.mjs (unrolled rounds, no loop counter) and keep it only if it beats a byte-identical-copy noise band — see Generator experiment
        status: pending
      - id: verdict-doc
        content: Write the measured verdict as a subsection of docs/security/crypto-bcrypt.md Speed, refresh its width table, and add a pointer next to the Adler-32 verdict in docs/wp38-simd.md — see Verdict
        status: pending
---

## Context

Measured in this session (Emerald Rapids Xeon at a measured 3.15 GHz, cost 10, user CPU, median of 5 interleaved rounds):

| Width | default ms/hash | x86-64-v3 ms/hash | cycles/block per lane |
| --- | ---: | ---: | ---: |
| 1 | 56.9 (56.3–60.3) | 57.5 (56.5–60.5) | 168 |
| 2 | 31.8 (31.7–34.8) | 32.4 (31.9–35.3) | 94 |
| 3 | 24.1 (22.3–24.5) | 23.5 (22.8–24.9) | 71 |
| 4 | 19.4 (18.8–22.3) | 19.5 (18.4–22.9) | 57 |
| 5 | 17.1 (16.3–17.8) | 17.7 (16.4–19.7) | 50 |
| 6 | 15.7 (15.5–17.4) | 16.3 (15.0–19.3) | 46 |

- `--cpu x86-64-v3` emits a byte-identical round loop: LLVM 18 does not pick `shrx`/`rorx`/`bextr` for constant shifts on Intel.
- The 6-lane loop is already lean: no bounds checks, `zext nneg` indexes, hoisted base, `[base + idx*4 + disp]` loads, P-xor off the critical path. About 10.2 ALU ops per lane half-round against an ideal of about 10. The cost is register pressure: 13 spills and 32 reg-reg moves per 6-lane round.
- A hand-written, spill-free, fully unrolled 6-lane x86-64 kernel (bit-checked against a C reference) gave 15.1 ms with `rorx`+`shr`, 15.8 ms with `rorx`+`movzx ah`, and 16.5–16.8 ms with baseline instructions only, against Nish at 16.5 ms in the same interleaved run. That is at most about 9% less CPU, inside the ±10% noise band. The core is ALU-throughput bound (about 4.3–4.8 ALU ops per cycle), not load bound.
- C (`clang -O2`, with or without `-march=x86-64-v3`) does no better than Nish: 16.0 ms at 6 lanes.

So the 30% target is not reachable with BMI2 on this core. The requirements say what to do in that case: don't force a kernel; record the measured verdict as the Adler-32 one was ([docs/wp38-simd.md](docs/wp38-simd.md) "Adler-32: measured, not built"). The scratch investigation (programs, timers, hand-kernel generator and harness, raw times) is on this plan branch under `.claude/plans/bcrypt-bmi2/` for the worker to start from.

## Approach

One stage, because the deliverable is one verdict with the tools that reproduce it. No runtime C kernel, no `src/kernels.ts` seam, no new security scope: those are only justified by a gain, and the measured ceiling is under the noise band. If the worker's own measurements on its container contradict this (a hand kernel more than 20% faster than Nish's best width, repeated in two runs), it stops, opens the PR as a draft with the numbers, and says so — the lead escalates to the human rather than widening the stage.

## Benchmark

[bench/crypto/bcrypt/run.mjs](bench/crypto/bcrypt/run.mjs) already times widths 1–6. Add a `--cpu-both` flag (name is the worker's choice; update the verification line accordingly in the PR body) that builds the Nish programs twice, default and `--cpu x86-64-v3`, and prints both columns in one interleaved run. Report ms per hash and ns per hash. Keep the header comment accurate. Nothing fetched is copied into the repository.

## Ceiling harness

Port `hand/gen.mjs` + `hand/harness.c` from the plan branch into `bench/crypto/bcrypt/` (for example `ceiling.mjs` + `kernel/`), as [bench/adler32/kernel.c](bench/adler32/kernel.c) holds the Adler candidates. It must: generate the 6-lane and 5-lane hand kernels in three variants (baseline, `rorx`+`shr`, `rorx`+`movzx`), check each bit-for-bit against the C reference before timing, run interleaved with the Nish widths, print medians and spread, and skip with a note on a non-x86-64 host or a CPU without BMI2 (`/proc/cpuinfo` flags). The code is original (random state, no π table), so no third-party notice is needed; confirm against [.claude/licensing.md](.claude/licensing.md).

## Generator experiment

In [bench/crypto/bcrypt/gen-body.mjs](bench/crypto/bcrypt/gen-body.mjs), try the one change the asm reading suggests: fully unroll the 8 round pairs so the loop counter's register is freed (and any other change the worker finds that cuts spills). Measure against the base and against a byte-identical copy of the base for the noise band (`.claude/testing.md` "A `Measured:` trailer"). Ship it into [std/crypto/bcrypt.ts](std/crypto/bcrypt.ts) only if the best-width gain is outside the band in two separate runs; then regenerate the goldens and run `node tests/differential/goldens.js` checks as `.claude/selfhost.md` says. Otherwise leave `std/` untouched and record the figure in the verdict.

## Verdict

A new `### BMI2 and x86-64-v3: measured, not built` subsection of [docs/security/crypto-bcrypt.md](docs/security/crypto-bcrypt.md) `## Speed`, in the Adler verdict's shape: the candidates, the bar (20% against a byte-identical-copy noise band), the per-width table (default and v3), the ceiling table, the asm diagnosis (what LLVM emits and why BMI2 does not shorten it), the AMD question left open (measured on Intel only; the harness is how someone answers it), why the outside claims (7.3 ms on 5 lanes, "BMI2 halved it") do not reproduce here, and what a server should check first (whether its batches are full). Refresh the stale width table in that section if the numbers moved. One-line pointer from [docs/wp38-simd.md](docs/wp38-simd.md) beside the Adler-32 verdict.

**Owns:** `bench/crypto/bcrypt/**`, `docs/security/crypto-bcrypt.md`, `docs/wp38-simd.md`, `std/crypto/bcrypt.ts`, `tests/self/goldens/checked/**`, `tests/differential/**` (the last three only if the generator experiment ships)

## Out of scope

- A runtime C kernel, a `src/kernels.ts` seam, CPU-feature dispatch, a change to `bcryptCalibrate` or the public API — unjustified at a ≤9% ceiling.
- Changing the server's batching (that is the user's application).
- CI workflow changes to measure on AMD runners.

## Tests

- If `std/crypto/bcrypt.ts` changes: `node tests/run.js bcrypt`, `node tests/differential/bcrypt.js`, the wipe tests in [tests/wipes/crypto.js](tests/wipes/crypto.js), and byte-for-byte output across widths 1–6 against the current kernel (random passwords, salts, costs 4–6, a 72-byte password, NUL bytes, null lanes).
- The ceiling harness refuses to time a kernel whose state differs from the C reference.

## Verification

```bash
npm run check
npm run lint
node tests/run.js bcrypt
node bench/crypto/bcrypt/run.mjs --rounds 5 --cpu-both
node bench/crypto/bcrypt/ceiling.mjs --rounds 5
```

Plus, if `std/` changed: `node tests/self/goldens.js --update` (read the diff) and `node tests/differential/goldens.js --update`.
