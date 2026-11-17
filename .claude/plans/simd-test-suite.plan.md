---
name: nish:simd in the test suite — lane-wise tooling loops and SIMD variants checked against scalar
overview: Use nish:simd (the 16-byte vector types, runtime/nish.d.ts ~3739-4495) where it helps the test suite without losing coverage. First, profile the Nish-written test tooling (the golden runner tests/nish/run.ts and what it calls in std/testing.ts and std/text.ts, tests/nish/cli.ts, tests/self/*.ts) and make the hot byte/line loops lane-wise only where the measurement says it pays. Second, add SIMD variants of test programs that do byte runs, checksums or codecs, each checked against the scalar result it sits beside; no scalar loop is removed. One PR.
stages:
  - id: s1-simd-suite
    title: "perf(self): run the test tooling's hot byte loops lane-wise, and add nish:simd variants checked against scalar"
    goal: The golden runner and its std helpers use nish:simd for every hot loop where a measured profile shows a gain beyond the noise band (or the PR records the data showing none pays), new SIMD-variant test programs assert equality with their scalar twins, no existing scalar test is weakened, and CI's eight test shards are green.
    verification: npm run check && npm run lint && node tests/run.js simd && node tests/run.js nish-runner && node tests/run.js self && node tests/run.js differential
    todos:
      - id: profile-tooling
        content: Build the runner (build/nish tests/nish/run.ts --link build/nish-runner) and profile a fixed case set — instruction counts (valgrind/cachegrind if present) or the runner's own monotonicNanos per-case table, interleaved baseline vs change, at least 5 runs each — to find which of splitLines (std/text.ts), testingFirstDifferentLine/eqLines (std/testing.ts), stripHeader/normaliseProducer/printStdoutFrom (tests/nish/run.ts) dominate — see S1
        status: pending
      - id: lane-wise-tooling
        content: Make the dominant loops lane-wise (u8x16 eq + bitmask newline/difference scans) only where the profile shows a gain outside the noise band; leave a measured non-win scalar and record it in the PR body. Behaviour byte-identical; keep a scalar tail for the last <16 bytes — see S1
        status: pending
      - id: freeze-check
        content: Confirm no change lands in src/ or in std/ modules src/ imports (std/input, std/raster, std/cli); tests/self/*.ts is seed-compiled, so any change there uses only what the seed ships (nish:simd is in the seed since 0.34.0) — see S1
        status: pending
      - id: simd-variants
        content: Add SIMD variants (new tests/cases/simd_*.ts and/or tests/link/*_simd/ programs) for byte runs, a checksum (Adler-32 or CRC-32) and a codec (base64 or hex), each computing scalar and lane-wise results on the same inputs (incl. lengths 0, 1, 15, 16, 17, 31, 33 and a non-multiple-of-16 tail) and printing/asserting equality; scalar originals untouched — see S1
        status: pending
      - id: goldens-and-registrations
        content: Golden .ll + .out for each new case, llvm-as pass, register with node tests/differential/goldens.js --update in the same commit, regenerate tests/self/goldens with --update, docs/reference via gen-reference if std/ moved, nish-cmp run and DECLARED entries if std/ moved corpus IR — see S1
        status: pending
      - id: measured-trailer
        content: Commit message carries Measured: with before/after figures and their noise band (.claude/testing.md "A Measured: trailer"); PR body shows the exact LLVM IR for each new TS snippet in tests — see S1
        status: pending
---

# nish:simd in the test suite

## S1 — lane-wise tooling and SIMD variants

Owns: `std/testing.ts`, `std/text.ts`, `tests/nish/**`, `tests/self/*.ts`,
`tests/cases/simd_*`, `tests/link/*simd*/**`, `tests/simd/**`,
`tests/run.js`, `tests/nish-cmp.js`, `tests/differential/**`,
`tests/self/goldens/**`, `tests/shard-costs.json`, `docs/reference/**`,
`scalar.config.json` (reference routes only).

Generated (regenerate, never hand-edit): `tests/self/goldens/checked/**`,
`tests/differential/goldens*`, `tests/cases/*.ll`, `docs/reference/**`.

Out of scope: `src/**`, `runtime/**`, `std/input*`, `std/raster*`,
`std/cli*`, `.github/**`, `.claude/**`, any existing scalar test's loop.

### Facts the worker starts from

- nish:simd surface: `loadU8x16(xs: readonly u8[], i)`, `eq`/`ne`/`lt`…
  returning masks, `any`/`all`/`bitmask(m): i32`, `addWrapping`,
  `sumWrapping`, `select`, `shuffle`, `store`. Loads are from typed arrays by
  element index — strings have to become bytes first, and that copy is part
  of what the profile must pay for.
- `tests/nish/run.ts` and `tests/nish/cli.ts` are compiled by the fresh
  stage1 (`build/nish-test` / `build/nish`), and `std/testing.ts` and
  `std/text.ts` are not imported by `src/`, so the rolling freeze does not
  bind them. `tests/self/{types,diagnostics,symbols}.ts` are linked by the
  seed.
- Under Node a vector is a typed array, so `std/text.ts` changes must keep
  the emit-ts differential agreeing. Do not regenerate
  `tests/differential/emit-ts-known.txt` here (local Node is 22, CI pins 26).
- `tests/simd/*` are C drivers for `runtime/runtime-simd.c`; nish:simd golden
  cases are `tests/cases/simd_*`. Candidate scalar twins:
  `tests/link/std_compress_adler_*`, `std_compress_crc_*`, `std_base64*`,
  `std_bytes_runs`.
