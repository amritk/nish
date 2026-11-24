---
name: WP38 — SIMD, the open acceptance follow-ups and the reopened speed stages
overview: Three follow-ups remain from the Adler-32 and SSE4.1 rounding runs. Four stages reopen WP38 after the 2026 state-of-SIMD survey — fast-math by default outside --deterministic, a wasm simd128 level, x86-64-v4 re-measured without 512-bit width and gathers, and a measured reduction recipe. Each ships only on a bar it measures first.
spec: docs/wp38-simd.md
priority: 80
issue: 1865
labels: [ready]
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
  - id: s14-v4-narrow
    title: WP38 S14 — re-measure x86-64-v4 with 256-bit vectors and no gathers
    goal: Q11 is either reopened on figures that show a v4 variant adding over x86-64-v3, and that variant ships as --cpu x86-64-v4, or the variants are recorded as measured and not built.
    verification: node bench/simd-s0.mjs --only nbody,vec3,spectral --self --runs 15 --level x86-64-v3 --level x86-64-v4 plus each variant, two samples; then node tests/run.js ct_asm (CT-16 at the new level) && node tests/run.js simd && npm run check && npm run lint
    issue: 2230
    todos:
      - id: s14-bench-variants
        content: Let bench/simd-s0.mjs take a level with extra clang flags, e.g. x86-64-v4+prefer256 and x86-64-v4+nogather — see WP38 S14 — re-measure x86-64-v4
        status: pending
      - id: s14-measure
        content: Measure v3, v4 and the three v4 variants in the same rotating rounds with a byte-identical copy as the band, two samples, on an AVX-512 machine named by CPU model — see WP38 S14 — re-measure x86-64-v4
        status: pending
      - id: s14-record
        content: Record the table and the verdict under S2's later levels in docs/wp38-simd.md section 7, and file Q12 in section 8 only if a variant clears the bar — see WP38 S14 — re-measure x86-64-v4
        status: pending
      - id: s14-ship
        content: Only on the bar and the owner's Q12 answer — add the winning variant as x86-64-v4 to CPU_LEVEL in src/compile.ts and scripts/build.sh, with ctAtLevel reads in tests/run.js ct_asm, docs and help — see WP38 S14 — re-measure x86-64-v4
        status: pending
  - id: s15-wasm-simd128
    title: WP38 S15 — the simd128 level for the wasm and wasi profiles
    goal: A measured bar decides whether --cpu simd128 ships; if it does, the wasm and wasi profiles build the module and the runtime with -msimd128 under it, and the capability report records it.
    verification: node tests/run.js simd && node tests/run.js wasi && node tests/run.js wasm-size && npm run check && npm run lint && node examples/break-web/build.mjs --check
    issue: 2231
    todos:
      - id: s15-bench
        content: Add bench/wasm-simd128.mjs, which builds index-of-any, the nish/bytes runs, regex scan and the simd-s3a kernels for wasm32-wasi with and without -msimd128 and times them under Node WASI against a byte-identical copy — see WP38 S15 — the simd128 level
        status: pending
      - id: s15-measure
        content: Run it twice, with the module sizes, and record the table and verdict in docs/wp38-simd.md section 7 — see WP38 S15 — the simd128 level
        status: pending
      - id: s15-flag
        content: Only on the bar — accept --cpu simd128 with --profile wasi and wasm in src/compile.ts, add -msimd128 to the module and runtime compile in scripts/build.sh, key the caches and nish run on it, and record it in the capability report — see WP38 S15 — the simd128 level
        status: pending
      - id: s15-tests-docs
        content: Only on the bar — a native round trip and a negative test for the flag, the LANGUAGE.md --cpu rule, docs/guide/language/simd.md and the CLI page, and the regenerated break-web help — see WP38 S15 — the simd128 level
        status: pending
  - id: s16-fast-math-default
    title: WP38 S16 — fast-math by default outside --deterministic
    goal: A measured bar decides whether native and wasm builds emit float ops with fast-math flags by default, strict IEEE order only under --strict-float, which --deterministic implies; if it clears, the flags ship and every pinned output that moves is regenerated.
    verification: node bench/fast-math.mjs (two samples); node tests/run.js deterministic && node tests/run.js float-corpus && node tests/run.js simd && node tests/differential/run.js && node tests/nish-cmp.js && npm run check && npm run lint && NISH=build/nish bash docs/cookbook/regen.sh --check
    issue: 2232
    todos:
      - id: s16-prototype
        content: Add bench/fast-math.mjs, which rewrites each float bench program's .ll to add a flag set to every float op and float reduction, links it at the baseline and at x86-64-v3, and times it against the strict build and a copy — see WP38 S16 — fast-math by default
        status: pending
      - id: s16-measure
        content: Measure the strict build and each candidate flag set on nbody, spectral, vec3, math, par-nbody and an f64 sum and dot kernel, two samples — see WP38 S16 — fast-math by default
        status: pending
      - id: s16-drift
        content: Count, for each flag set, the tests/differential cases and tests/cases programs whose output changes against Node without --deterministic — see WP38 S16 — fast-math by default
        status: pending
      - id: s16-reopen
        content: Record the figures in docs/wp38-simd.md section 7, take the fast-math bullet out of section 9, and file Q12 in section 8 with set F (no nnan or ninf) and --strict-float as decided — see WP38 S16 — fast-math by default
        status: pending
      - id: s16-strict-flag
        content: Only on the bar — add --strict-float to src/compile.ts, implied by --deterministic, with its cache key, capability report entry, docs and help — see WP38 S16 — fast-math by default
        status: pending
      - id: s16-emit
        content: Only on the bar — emit the chosen flags in src/emit-ops.ts, src/simd.ts (float ops and sum) and the float builtins, and drop them under --strict-float — see WP38 S16 — fast-math by default
        status: pending
      - id: s16-fallout
        content: Only on the bar — regenerate the goldens, the cookbook and the reference, add the nish-cmp DECLARED entries, move the differential harness to --strict-float, and confirm the bootstrap compiler's output is unchanged — see WP38 S16 — fast-math by default
        status: pending
      - id: s16-docs
        content: Only on the bar — rewrite the no-fast-math rules in docs/LANGUAGE.md, docs/guide, bench/README.md, docs/wp9-optimisation.md and src/simd.ts — see WP38 S16 — fast-math by default
        status: pending
  - id: s17-reduction-recipe
    title: WP38 S17 — the measured chunked-loop and several-accumulator recipe
    goal: The guide and the cookbook show how to write a float reduction and a checked loop that vectorise, each with the figures that prove it, or the stage records that the recipe missed its bar.
    verification: node bench/reduce-recipe.mjs on x86-64 and in the simd-arm64 CI job; node tests/run.js simd && NISH=build/nish bash docs/cookbook/regen.sh --check && node docs/check-links.mjs && npm run lint
    issue: 2233
    todos:
      - id: s17-bench
        content: Add bench/reduce-recipe.ts and its driver, timing a one-accumulator f64 sum against a four-accumulator and an f32x4 form, and an element loop against its chunked form, under --strict-float — see WP38 S17 — the reduction recipe
        status: pending
      - id: s17-measure
        content: Measure on x86-64 and on CI's AArch64 runner, two samples each, and record the table in docs/wp38-simd.md section 7 — see WP38 S17 — the reduction recipe
        status: pending
      - id: s17-check
        content: Only on the bar — a tests/run.js check that each recipe loop's IR holds a vector body, as the existing vectorisation checks do — see WP38 S17 — the reduction recipe
        status: pending
      - id: s17-docs
        content: Only on the bar — a section in docs/guide/language/simd.md and a docs/cookbook entry, quoting the measured figures and the commit that produced them — see WP38 S17 — the reduction recipe
        status: pending
---

# WP38 — SIMD, the open acceptance follow-ups

## Context
All 10 of 10 roadmap stages have landed (S0 to S10, `--cpu x86-64-v3`, `nish:simd`, the AES-GCM, SHA-256, ChaCha20, CRC-32 and Adler-32 kernels, and the measured-not-built `--cpu` levels) — see [the design note](../../docs/wp38-simd.md). No roadmap box is open. Design note: [docs/wp38-simd.md](../../docs/wp38-simd.md). S11 to S13 are open GitHub issues from acceptance runs; the test-section names in their `verification` are guesses for the lead to refine.

S14 to S17 reopen WP38 after [The state of SIMD in Rust in 2026](https://shnatsel.github.io/state-of-simd-rust-2026/) was read against this design. The survey confirms most of what WP38 decided: generic LLVM vector IR rather than target intrinsics, 128-bit vectors (SVE is "effectively 128-bit"), a baseline default with run-time dispatch in the runtime, and no AVX-512 by default. It points at four gaps, and these stages take them. The owner has also reversed one decline: fast-math should be the default for a build that does not have to match its TypeScript reading, not an opt-in (S16).

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

## Approach — measure, then build (S14 to S17)
Each of S14 to S17 follows WP38's own pattern ([docs/wp38-simd.md](../../docs/wp38-simd.md) section 7, S2 and S3a): the stage first builds the bench, measures it, and records the table and verdict in section 7. It writes code a user sees only when the bar clears. A bar that misses is a finished stage too: its result is a "measured, not built" entry in section 7, as the AArch64 levels and v4 got. Each figure is a minimum and median against a byte-identical copy, so the copy's spread is the noise band, in two samples, on a named machine, with the commit that produced it (`CLAUDE.md` → "A bench side is the code it names"). Where a stage changes a decision recorded in section 8 or a decline in section 9, it adds the figures and files a new question (Q12 onward) for the owner before it builds.

Independent of each other: S14, S15 and S16. S17 waits for S16, because whether LLVM reassociates a one-accumulator sum by itself decides who the recipe is for.

## WP38 S14 — re-measure x86-64-v4 with 256-bit vectors and no gathers
Q11 (2026-11-12) kept `x86-64-v4` out: it is 3.6–7.4% slower than `x86-64-v3` on spectral and gains on neither nbody nor vec3 ([docs/wp38-simd.md](../../docs/wp38-simd.md), "S2's later levels"). That run never isolated why. The survey names two known causes. One is 512-bit code on its own. The other is LLVM's AVX-512 autovectoriser emitting gathers and scatters, which it reports as 1.75x slower on Intel (llvm#70259) and 4x slower on AMD (llvm#91370). clang 18, the version CI uses, accepts both remedies: `-mprefer-vector-width=256` and `-mno-gather -mno-scatter`.

**Measure.** Extend `--level` in [bench/simd-s0.mjs](../../bench/simd-s0.mjs) to take extra clang flags (for example `x86-64-v4+prefer256`, `x86-64-v4+nogather`, `x86-64-v4+prefer256+nogather`). Run `--only nbody,vec3,spectral --self --runs 15` with v3, v4 and the three variants in the same rotating rounds, twice. This container has AVX-512 F, BW, CD, DQ, IFMA, VBMI and VL; name the CPU model in the record.

**Bar.** This is Q11's criterion. A variant must beat `x86-64-v3` outside the copy's band at the minimum on at least one of the three programs, in both samples, and be no slower than v3 beyond the band on any of them. It must also clear S2's original bar against the baseline, and both constant-time checkers must read it cleanly (CT-16 in [docs/security/ct-verification.md](../../docs/security/ct-verification.md)).

**Ship, only on the bar and Q12.** Add the variant to `CPU_LEVEL` in [src/compile.ts](../../src/compile.ts) as `x86-64-v4`, with its flags in [scripts/build.sh](../../scripts/build.sh). Add the cache and `nish run` keys, the capability report value, the `--cpu` rule in `docs/LANGUAGE.md`, the CLI guide page and the regenerated break-web help.

## WP38 S15 — the simd128 level for the wasm and wasi profiles
[docs/wp38-simd.md](../../docs/wp38-simd.md) section 5 plans `-msimd128` as a level for the wasm and wasi profiles "behind the same flag", but nothing builds it. The runtime already holds simd128 paths ([runtime/runtime-bytes.c](../../runtime/runtime-bytes.c):33, [runtime/runtime-simd.c](../../runtime/runtime-simd.c):43), and `tests/run.js` section `simd` runs them under Node WASI with `-msimd128`. The wasm compile line ([scripts/build.sh](../../scripts/build.sh), `wasm_compile`) never adds it, so programs get the scalar paths, and LLVM scalarises `nish:simd` code. The survey's point holds: wasm has no run-time feature detection, so the level has to be chosen at build time, and an opt-in flag is the right shape. This plan takes `--cpu simd128` as the spelling, because section 5 says the same flag.

**Measure.** Add `bench/wasm-simd128.mjs`. It builds `bench/index-of-any.ts`, a `nish/bytes` run, the regex scan and the `bench/simd-s3a` kernels for wasm32-wasi with and without `-msimd128`, and times them under Node 22's WASI against a copy. It also reports the module and runtime sizes against the `wasm-size` budgets.

**Bar.** S3's bar: at least 1.5x at the minimum on at least one kernel, in both samples, with no kernel slower beyond the band and the size growth within the `wasm-size` budgets.

**Ship, only on the bar.** [src/compile.ts](../../src/compile.ts) accepts `--cpu simd128` with `--profile wasi` and `--profile wasm` and refuses it natively, with a new diagnostic and its `tests/link` negative. `-msimd128` goes on the module and the runtime units in [scripts/build.sh](../../scripts/build.sh). The flag also gets the cache and `nish run` keys, the capability report `"cpu"` value, `docs/LANGUAGE.md`, [docs/guide/language/simd.md](../../docs/guide/language/simd.md), the CLI guide page and the regenerated break-web help. The page says that a host without simd128 refuses the whole module.

## WP38 S16 — fast-math by default outside --deterministic
[docs/wp38-simd.md](../../docs/wp38-simd.md) section 9 declines fast-math under any flag, because its answers change with the optimiser. The owner has reversed the principle behind that. A build for Nish alone should be as fast as it can be, and results must agree with the TypeScript reading only when both are built and must match. `--deterministic` is already that promise: without it, a native build already differs from Node wherever libm and V8 differ (`Math.sin`, `pow`), and the float corpus is held to one `expected.txt` only under it ([docs/LANGUAGE.md](../../docs/LANGUAGE.md#--deterministic)). So the strict reading stays under `--deterministic`, and the default becomes fast. What it buys is the wp9 gap: an i32 sum vectorises to about 0.24 cycles per element, while an f64 sum is one serial `addsd` at about 3.4 ([docs/wp9-optimisation.md](../../docs/wp9-optimisation.md), "Reductions cannot be reassociated").

**Measure first, with no `src/` change.** `bench/fast-math.mjs` takes each float bench program's `.ll` from the current compiler and rewrites it to add a flag set to every `fadd`, `fsub`, `fmul`, `fdiv`, `frem` and `fneg`, to the float intrinsic calls and to `llvm.vector.reduce.fadd`. It links each at the baseline and at `x86-64-v3`, and times them against the strict build and a byte-identical copy. The programs are `bench/nbody.ts`, `bench/spectral.ts`, `bench/vec3.ts`, `bench/math.ts`, `bench/par-nbody.ts` and an f64 sum and dot kernel. It measures these flag sets:

| Set | Flags | Why it is measured |
| --- | --- | --- |
| R | `reassoc contract` | Reductions vectorise, and FMA fuses at v3 |
| F | `reassoc contract arcp afn nsz` | LLVM's `fast` without the NaN and infinity assumptions |
| X | `fast` | For information only: the ceiling |

The stage also counts, for each set, the `tests/differential` cases and `tests/cases` programs whose output changes against Node without `--deterministic`. That count is the cost.

**Bar.** S2's bar: at least 10% at the minimum on at least one float program, in both samples, and no program slower than the copy's band in a whole-suite `node bench/run.mjs` against the strict build. If no set clears it, section 9's decline stands, with the figures beside it.

### Decided (2026-11-24, by the owner)
1. **The flag set is F**, `reassoc contract arcp afn nsz`, falling back to R if F adds nothing over R beyond the band. `nnan` and `ninf` are never emitted. They do not change the rounding; they make an operation on a NaN or an infinity poison. LLVM then folds `x !== x`, `Number.isNaN` and `isFinite` to constants, and a branch or index on poison is undefined behaviour, which would put the bounds prover's guarantees behind the user's floats. Set X is measured for information only.
2. **The strict trigger is a new `--strict-float` flag**, which `--deterministic` implies. It turns fast-math off and changes nothing else, so a program that must match Node can still use the clock, the file system or the network that `--deterministic` refuses. The differential harness passes it.

Q12 in section 8 records these with the stage's figures. If the bar misses, they lapse with section 9's decline.

**Ship, only on the bar and Q12.**
- Add `--strict-float` to [src/compile.ts](../../src/compile.ts), implied by `--deterministic`, keyed in the caches and `nish run`, recorded in the capability report, with its `docs/LANGUAGE.md` rule, CLI guide page and regenerated break-web help.
- Emit the chosen flags from `floatOpcode` and its callers in [src/emit-ops.ts](../../src/emit-ops.ts), the float ops and `sum` in [src/simd.ts](../../src/simd.ts), and the float builtins. Omit them under `--strict-float`.
- Keep `-ffp-contract=off` on the C runtime: its float code is exact or integer-only, and nothing has measured a gain there.
- Pinned outputs move with it. Regenerate the goldens and the cookbook; add `nish-cmp` `DECLARED` entries for every corpus program whose IR moves; check that `tests/self/goldens` and CI's `bootstrap` job show the self-built compiler's output unchanged.
- Rewrite every rule that says "no fast-math flags": the simd operation table and `--deterministic` in `docs/LANGUAGE.md`, the guide's float and CLI pages, the twin rule in [bench/README.md](../../bench/README.md) (C gets a column with the same flags, so the race stays fair), [docs/wp9-optimisation.md](../../docs/wp9-optimisation.md) and the comment at `src/simd.ts:282`.

## WP38 S17 — the measured chunked-loop and several-accumulator recipe
The survey's practical answer to fragile autovectorisation is to loop over fixed-size chunks and read the assembly. In Nish, two things block vectorisation: the extra exits that the overflow and bounds checks add (wp38 section 2.2), and IEEE order on a float accumulator. wp38 already measured the accumulator effect in C, 1.9x from a second accumulator and 2.3x from four (section 3), but no Nish user is told. After S16, the float half of the recipe matters only under `--strict-float`; the chunked-loop half matters everywhere.

**Measure.** `bench/reduce-recipe.ts` and its driver time, under `--strict-float` (or the default build, if S16 did not ship):
- a one-accumulator f64 sum against a four-accumulator form and an `f32x4`/`f64x2` form;
- an element loop with checked indexing against its chunked form, where one guard per chunk lets the prover discharge the inner indices.

Run it on x86-64 here and on CI's `ubuntu-24.04-arm` runner, in a step added to the `simd-arm64` job for one run, two samples each.

**Bar.** At least 1.5x at the minimum for each form the page recommends, on both architectures. A form that misses it is left out of the page, with its figures in section 7.

**Ship, only on the bar.** Add a "Writing loops that vectorise" section to [docs/guide/language/simd.md](../../docs/guide/language/simd.md) and a cookbook entry under `docs/cookbook/` (regenerated with `docs/cookbook/regen.sh`), each quoting the figures and the commit that produced them. Add a `tests/run.js` check that each recommended loop's IR holds a vector body, beside the existing vectorisation checks ([docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)).

## Out of scope (S14 to S17)
- Function multiversioning of compiled Nish code: it conflicts with Q2's one binary per triple and the instruction gate, and the survey reports that it blocks inlining at the boundary.
- SVE, SVE2 and RVV levels: the survey finds SVE effectively 128-bit and RVV irrelevant in 2026, and the AArch64 levels already measured flat.
- Flush-to-zero or denormals-are-zero: they change JS number semantics, beyond what a fast-math flag set changes.
- Target intrinsics as a language surface: still declined (section 9).
