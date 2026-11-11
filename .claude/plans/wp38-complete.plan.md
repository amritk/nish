---
name: WP38 complete — Adler-32 kernels (S8) and the next --cpu levels
overview: Finish WP38's last two boxes. S8 ships the SSSE3 and NEON Adler-32 kernels that #1078 measured at 7x on CRC-32's seam (issue #1079). The cpu-levels stage measures x86-64-v4 and one AArch64 level against S2's bar, ships each level that clears it and both constant-time checkers pass at, and records the rest as measured, not built.
stages:
  - id: s8-adler32
    title: perf(runtime) — ship the SSSE3 and NEON Adler-32 kernels (WP38 S8)
    goal: adler32Update runs on an SSSE3 or NEON kernel chosen once per process, with NISH_ADLER32=soft pinning the Nish loop, on the seam CRC-32 uses
    verification: npm run check && npm run lint && node tests/run.js simd && node tests/run.js "adler32 kernel" && node tests/run.js std_compress && node tests/run.js wasi && node tests/run.js performance && node bench/adler32.mjs --check
    todos:
      - id: s8-runtime
        content: Move the SSSE3 and NEON kernels from bench/adler32/kernel.c into runtime/runtime-checksum.c behind nish_adler32_hw and nish_adler32_update — see S8 runtime
      - id: s8-seam
        content: Split adler32Update's loop into a private adler32Walk in std/compress/checksum.ts and add isAdler32Seam plus an emit arm in src/kernels.ts, src/emit.ts, src/runtime.ts — see S8 seam
      - id: s8-tests
        content: Add tests/simd/adler32.c, the adler32 kernel section, link tests, wasi no-symbol check, triple and stub compiles and the runtime budget row — see S8 tests
      - id: s8-ci-bench
        content: Assert the kernel path in ci.yml on x86 shard 1 and simd-arm64, and give bench/adler32.mjs a default-vs-soft-vs-copy mode — see S8 CI and bench
      - id: s8-docs
        content: Record COMP entry and scope row in docs/security/compress.md, the compression guide page, wp38 S8 row and roadmap box — see S8 docs
  - id: cpu-levels
    title: perf(cli) — measure x86-64-v4 and an AArch64 level for --cpu (WP38)
    goal: Each of x86-64-v4 and one AArch64 level is measured against S2's bar on its own machine, and --cpu accepts exactly the levels that clear it and pass both ct-asm checkers
    verification: npm run check && npm run lint && node tests/run.js ct_asm && node tests/run.js cli && node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: cpu-measure-v4
        content: Measure x86-64-v4 with bench/simd-s0.mjs against the baseline and x86-64-v3 on nbody, vec3 and spectral, with the --self band — see Levels measurement
      - id: cpu-measure-arm
        content: Measure armv8.2-a (or armv8.4-a+crypto) on CI's simd-arm64 runner the same way — see Levels measurement
      - id: cpu-ship
        content: Accept each level that clears the bar in src/compile.ts and scripts/build.sh, with ct-asm reads at the level, driver and negative tests — see Levels shipping
      - id: cpu-docs
        content: Record the figures in docs/wp38-simd.md, the rule in LANGUAGE.md, the CLI guide page, CT-16 in ct-verification.md and the roadmap box — see Levels docs
---

## Context

[WP38](../../docs/roadmap/wp38-simd.md) is at 8 of 10. The two open boxes are S8 (Adler-32 kernels, measured past their bar in #1078, specified in issue #1079 and [wp38 §3.1](../../docs/wp38-simd.md), "Adler-32: measured, not built") and "`--cpu` levels for AArch64 or `x86-64-v4`, each on its own measurement" (§7, S2: "An AArch64 level or `x86-64-v4` comes later, each on its own measurement and its own pass of both checkers"). The S4, S6c and S6d items are declined and stay so.

## Approach

- One stage per box; both develop concurrently. They share a few files (below), so **cpu-levels merges after s8-adler32** and takes in `main` before its merge. Each edits a different region of the shared files.
- S8 copies CRC-32's pattern (#1062) exactly: same unit, same resolver style, same test set. No design choice is reopened.
- cpu-levels is measurement first. A level that misses S2's bar, or fails either ct-asm checker, is recorded as measured, not built, and that closes the box just as a shipped level does. SVE levels (`armv9-a`, `neoverse-v1`) are out: §7 measured them failing ct-asm. `native` stays refused.

| File | s8-adler32 | cpu-levels |
| --- | --- | --- |
| `tests/run.js` | `simd` and `adler32 kernel` sections | `ct_asm` sections, driver tests |
| `.github/workflows/ci.yml` | `adler32` assertions in x86 shard 1 and `simd-arm64` | arm64 measurement step (`simd-arm64` or a new job) |
| `docs/wp38-simd.md`, `docs/roadmap/wp38-simd.md`, `docs/roadmap/index.md` | S8 row and box | S2 levels text and box |
| `tests/self/goldens/**`, `docs/reference/**` | regenerated | regenerated |

## S8 runtime

**Owns (s8-adler32):** `runtime/runtime-checksum.c`, `runtime/nish.h`, `std/compress/checksum.ts`, `src/kernels.ts`, `src/emit.ts`, `src/runtime.ts`, `tests/simd/adler32.c`, `tests/simd/calls-adler32.c`, `tests/link/std_compress_adler*/**`, `tests/runtime-budgets.js`, `bench/adler32.mjs`, `bench/adler32/**`, `bench/README.md`, `docs/security/compress.md`, `docs/security/README.md`, `docs/guide/using-nish/compression.md`, `docs/MASTER_PLAN.md`, `docs/wp7*.md`, plus the shared rows above.

Exactly as issue #1079 lists: `nish_adler32_hw()` answered once per process; x86-64 detection by `cpuid.h` leaf 1 ECX bit 9 (never `__builtin_cpu_supports`); NEON on little-endian AArch64 with `<arm_neon.h>` guards and a stub arm for big-endian and headerless toolchains; `NISH_ADLER32=soft`, exact match only. Each kernel compiled with `target(...)` alone. The bench file keeps its own copies or includes the runtime's — the worker's call, stated in the PR.

## S8 seam

`adler32Update` keeps `checksumWindow` and hands the checked window to a private `adler32Walk`. `isAdler32Seam` in [src/kernels.ts](../../src/kernels.ts) and an emit arm in [src/emit.ts](../../src/emit.ts) with a `phi i32` join, as `emitCrc32KernelArm` does; skipped on wasm. A program that does not call `adler32Update` keeps its IR byte for byte (wp33 rule 6). This touches `src/`: it uses no new construct (rolling freeze), runs `wasi` and `performance`, regenerates checked goldens, and runs nish-cmp, adding `DECLARED` entries if a corpus program's IR moves.

## S8 tests

Mirror CRC-32's set in [tests/run.js](../../tests/run.js) (the `crc32 kernel` and `simd` sections):

- `tests/simd/adler32.c`: every path against a scalar reference, lengths 0..4096 × offsets 0..15, the chunk boundaries 5535/5536/5537/11072 and NMAX, all-`0xff` and random bytes, guard page.
- `tests/link/std_compress_adler*`: unset and `soft` print identical bytes; a `-Wl,--wrap` counter shows soft calls the kernel 0 times and unset calls it on a capable CPU (`/proc/cpuinfo`).
- Triple and stub compiles (darwin, i686, armv7, aarch64_be, hidden headers); `--profile wasi` names no `nish_adler32_` symbol and `nish_adler32_hw` answers 0 there.
- A `tests/runtime-budgets.js` ceiling update for `runtime-checksum.c`.

## S8 CI and bench

`ci.yml`: grep assertions for the adler32 agreement line and the "calls the kernel" line on x86 shard 1 and `simd-arm64`, as for crc32. `bench/adler32.mjs` gains a `--self` mode timing `default`, `default (copy)` and `soft` through the shipped `adler32Update`, as `bench/crc32.mjs --self` does, so the shipped path is measured against the 20% bar, not only the bench-local kernel.

## S8 docs

COMP entry and scope row in [compress.md](../../docs/security/compress.md), index row; `NISH_ADLER32` in [compression.md](../../docs/guide/using-nish/compression.md); the wp38 §7 S8 row says shipped with the `--self` figures; tick the S8 box (`Fixes #1079`).

## Levels measurement

**Owns (cpu-levels):** `src/compile.ts`, `src/cli-style.ts`, `src/run-cache.ts`, `scripts/build.sh`, `bench/simd-s0.mjs`, `tests/ct-asm-runtime.js`, `tests/ct-asm.js`, `tests/nish/cli.ts`, `docs/LANGUAGE.md`, `docs/guide/using-nish/cli.md`, `docs/security/ct-verification.md`, `docs/BENCHMARKS.md`, plus the shared rows above.

S2's bar, per level: **≥10%** at the level on at least one of nbody, vec3 or spectral, with no loss on the others beyond the band of a byte-identical copy, same machine, minimum and median of ≥7 runs (`bench/simd-s0.mjs --self`, extended to take the level). `x86-64-v4` is measured in a worker container (this host has AVX-512F/BW/VL) and judged against both the baseline and `x86-64-v3`, since a v4 that only matches v3 buys nothing. The AArch64 level (`armv8.2-a`; `armv8.4-a+crypto` if the worker argues for it) is measured on CI's `ubuntu-24.04-arm` runner via a `simd-arm64` step that prints the table in its log, as `bench/adler32.mjs` does there.

## Levels shipping

For each level that clears: `src/compile.ts` and `scripts/build.sh` accept it (an AArch64 level only for an AArch64 target, an x86-64 level only for x86-64; wasm profiles refuse all); `tests/run.js`'s two `ct_asm` sections read the level for the fixtures and the runtime kernels; driver tests build and run at the level; negative tests for a cross-architecture level, an unknown level and `native`. The capability report records the level. If no level clears, nothing in `src/` changes and the stage is a record.

## Levels docs

The figures, commit and machine in [wp38 §7](../../docs/wp38-simd.md) (S2 text) and [BENCHMARKS.md](../../docs/BENCHMARKS.md) if it ships; the `--cpu` rule in LANGUAGE.md and the CLI guide page; CT-16 in [ct-verification.md](../../docs/security/ct-verification.md) names every level read; tick the box (and mark WP38 Landed, 10 of 10, in the roadmap and index if s8 has merged — it will have, by the merge order).

## Out of scope

S4 (lexer on `indexOfAny`), S6c, S6d, SVE levels, `native`, a `nish:simd` change, and any kernel other than Adler-32.

## Verification

Each stage's `verification` line, plus CI's eight test shards, `bootstrap`, `nish-cmp` and the golden-case shards green at the PR head. `node scripts/gen-reference.mjs --check` and `node scripts/security-scope.mjs` for docs and runtime changes.
