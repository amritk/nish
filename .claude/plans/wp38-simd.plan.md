---
name: WP38 — SIMD, the open acceptance follow-ups
overview: Every WP38 stage has landed. Three follow-up issues remain from the Adler-32 and SSE4.1 rounding runs, one decision about checksum.ll moving and two bench-and-test gaps on Math.round, Math.sign and the other bench/math kernels.
roadmap: docs/roadmap/wp38-simd.md
spec: docs/wp38-simd.md
priority: 80
issue: 1865
stages:
  - id: s11-checksum-ll
    title: WP38 S11 — decide whether checksum.ll may move for every nish/compress importer
    goal: The owner has ruled on whether adler32Update's hardware seam may change the shared checksum.ll, and a CI shard log confirms the wasi Adler-32 row on main, or the seam is moved out of the shared module.
    verification: node tests/run.js adler32 && node tests/nish-cmp.js && node tests/run.js wasi && npm run lint
    status: pending
    issue: 1494
    labels: [needs-decision]
    todos:
      - id: s11-decide
        content: Record the owner's ruling on checksum.ll moving for every nish/compress importer in docs/wp38-simd.md section 7 — see WP38 S11 — decide whether checksum.ll may move
        status: pending
      - id: s11-wasi-evidence
        content: Read the adler32 kernel wasi row in a CI shard log on main, built with a sysroot, and cite it in the issue — see WP38 S11 — decide whether checksum.ll may move
        status: pending
      - id: s11-move-seam
        content: If the ruling is no, move the nish_adler32_hw seam out of std/compress/checksum.ts so a program that does not call adler32Update keeps checksum.ll byte for byte — see WP38 S11 — decide whether checksum.ll may move
        status: pending
  - id: s12-sign-float
    title: WP38 S12 — Math.sign on floats at or below the C twin on bench/math sign-float
    goal: bench/math sign-float is at or below the C -O3 twin outside the noise band, with Math.sign of -0, NaN and +0 exact against Node.
    verification: node tests/run.js math && node tests/differential/run.js math && npm run lint
    status: pending
    issue: 1043
    todos:
      - id: s12-asm
        content: Compare the asm of the sign-float kernel with the C twin's to find the extra branch, NaN or -0 fix-up or lost select — see WP38 S12 — Math.sign on floats
        status: pending
      - id: s12-lowering
        content: Change the Math.sign float lowering in src/emit-builtins.ts, keeping -0, NaN and +0 exact against Node — see WP38 S12 — Math.sign on floats
        status: pending
      - id: s12-measure
        content: Measure the kernel interleaved with an A/A noise band and put the figures in the commit's Measured trailer — see WP38 S12 — Math.sign on floats
        status: pending
  - id: s13-rounding-acceptance
    title: WP38 S13 — the SSE4.1 rounding acceptance gaps, benches and edge tests
    goal: All 10 bench/math kernels are measured against main's A/A pair and the twins with the table posted, a whole-suite bench against the merge base is recorded, and math_rounding covers the missing edges and which path ran.
    verification: node tests/run.js math_rounding && node tests/differential/run.js math_rounding && npm run lint
    status: pending
    issue: 1044
    todos:
      - id: s13-bench-math
        content: Measure atan2, tan, hypot, min, max and the sign-float median of bench/math against main's A/A pair and the C, Rust and Go twins — see WP38 S13 — the SSE4.1 rounding acceptance gaps
        status: pending
      - id: s13-whole-suite
        content: Run node bench/run.mjs for the branch against its merge base and name any regression — see WP38 S13 — the SSE4.1 rounding acceptance gaps
        status: pending
      - id: s13-edges
        content: Add the missing edges to tests/cases/math_rounding.ts (±1.5, ±2.5, ±0.49999999999999994, 2^52, the negative largest subnormal) and a check of which path ran — see WP38 S13 — the SSE4.1 rounding acceptance gaps
        status: pending
      - id: s13-node-compare
        content: Give math_rounding a main so a differential run compares it with Node — see WP38 S13 — the SSE4.1 rounding acceptance gaps
        status: pending
---

# WP38 — SIMD, the open acceptance follow-ups

## Context
All 10 of 10 roadmap stages have landed (S0 to S10, `--cpu x86-64-v3`, `nish:simd`, the AES-GCM, SHA-256, ChaCha20, CRC-32 and Adler-32 kernels, and the measured-not-built `--cpu` levels) — see [the roadmap page](../../docs/roadmap/wp38-simd.md). No roadmap box is open. Design note: [docs/wp38-simd.md](../../docs/wp38-simd.md). The three stages below are open GitHub issues from acceptance runs; the test-section names in `verification` are guesses for the lead to refine.

## WP38 S11 — decide whether checksum.ll may move for every nish/compress importer
#1494, escalated from the #1429 run: 6 of 7 acceptance criteria were met. Criterion 4 is partial: a program's own module does not move, but `checksum.ll`, which every importer of `nish/compress` writes, gains the `nish_adler32_hw` branch in `adler32Update`. `tests/nish-cmp.js` declares it; section GC drops the unused function so binaries are unaffected. CRC-32's seam (#1062) moved `checksum.ll` the same way. The wasi half was run only in the s8 worker's container (30/0); the acceptance container had no `libclang_rt.builtins-wasm32.a`.
Likely files: `std/compress/checksum.ts`, `tests/nish-cmp.js`.

### Decision needed
Is the shared std module moving acceptable, given wp33 section 1 rule 6 and the CRC-32 precedent? Options: (a) accept, as for CRC-32 (the cost is one declared nish-cmp entry); (b) keep `checksum.ll` byte for byte by putting the seam outside the shared module (needs a new split). Second question: should a CI shard log with a sysroot confirm the wasi row on main, or is the worker's local pass enough? No recommendation is in the issue; (a) follows the precedent.

## WP38 S12 — Math.sign on floats at or below the C twin on bench/math sign-float
#1043: at the default x86-64 target Nish's sign-float min is 347 to 352 ms against C's 334, about 4 to 5 percent behind and outside the roughly 1 ms band on the min; main's two byte-identical builds measure 348, so #960 did not introduce it. The suspect is the `Math.sign` float lowering in `src/emit-builtins.ts`. The bar from #943 is at or below the fastest same-baseline twin on every `bench/math` kernel.
Likely files: `src/emit-builtins.ts`, `bench/math.ts`.

## WP38 S13 — the SSE4.1 rounding acceptance gaps, benches and edge tests
#1044, from #960's acceptance pass (#949): criteria 5 and 7 are partial and the code has no known defect. atan2, tan, hypot, min and max were never benchmarked on #960's head; sign-float's median is 377 against main A's 355, outside main's own A/A spread of 16 ms (the mins agree, 347 against 348); round's C and Rust twin figures come from the earlier race and no Go figure is given. No whole-suite run was posted. Test gaps: nothing checks that the libm path ran under `NISH_SIMD=scalar` or that the default run took `roundsd`; floor, ceil and trunc lack the edges listed in the issue; `math_rounding` exports `test()`, not `main`, so no Node differential runs. The "Done when" boxes in the issue: kernels measured and table posted, whole-suite bench posted, and optionally the edges and path check.
Likely files: `tests/cases/math_rounding.ts`, `tests/cases/math_rounding.rerun.env`, `bench/`.
