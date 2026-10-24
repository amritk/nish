---
name: SSE4.1 roundsd for float rounding on default x86-64 builds
overview: With no --cpu flag, Math.round, floor, ceil and trunc (every llvm.floor/ceil/trunc/round the emitter writes) run the CPU's own roundsd on any SSE4.1 machine and stay exact on baseline x86-64, closing the round gap in issue 943 without raising the default target.
stages:
  - id: sse41-rounding
    title: perf(codegen) — run roundsd for float rounding on default x86-64 builds
    goal: Default-target x86-64 binaries round with an inline roundsd when the CPU has SSE4.1 and fall back to the exact libm path otherwise, beating the fastest baseline twin on every bench/math kernel.
    verification: npm run check && npm run lint && node tests/run.js math_ && node tests/run.js round && node tests/run.js selfhost && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/run.js instructions && node tests/run.js emit-ts && node tests/run.js hardening
    todos:
      - id: reproduce
        content: Reproduce the gap — the round kernel's asm at the default target and at --cpu x86-64-v2, every rounding intrinsic site, and a 20+ run interleaved noise band on main with full RELRO — see Reproduce
        status: pending
      - id: race
        content: Race run-time dispatch (inline asm vs a target-features helper vs a hoisted multiversioned loop) against the linker-side libm-only PLT or -z now, plus anything better, and pick the fastest exact one — see Candidates
        status: pending
      - id: implement
        content: Implement the winner in the emitter (src/emit-builtins.ts, src/runtime.ts) and, for dispatch, the cpuid flag in the C runtime init with a forced-fallback override — see Implementation
        status: pending
      - id: edge-case
        content: Add a math_* case pinning round/floor/ceil/trunc edge cases byte for byte against Node, run through both the fast path and the forced fallback — see Tests
        status: pending
      - id: goldens
        content: Regenerate the checked and differential goldens and the touched .ll goldens with the repo tooling, and confirm aarch64 goldens and bench/instructions.json move only for a stated reason — see Goldens and bench
        status: pending
      - id: bench
        content: Run node bench/run.mjs --only math --runs 10 --warmup 2 on a scratch checkout and the whole bench suite, and record the table and any regression — see Goldens and bench
        status: pending
      - id: ship
        content: Run the full verification, then open one PR titled perf(codegen) with the exact new IR, the golden list, the bench table and a Measured trailer with the noise band — see Verification
        status: pending
---

# SSE4.1 roundsd for float rounding on default x86-64 builds

Fixes #943. One stage, one PR.

**Owns:** `src/**`, `runtime/**`, `scripts/build.sh`, `tests/**`, `bench/instructions.json`, `docs/IR_COOKBOOK.md`, `docs/LANGUAGE.md`, `.claude/plans/n943-sse41-rounding.plan.md`

## Context

- [`src/emit-builtins.ts`](../../src/emit-builtins.ts) lowers `Math.round` as `llvm.floor`, a tie fix-up and `llvm.copysign` (`emitMathRound`, line ~244), and `floor`/`ceil`/`trunc` straight to `llvm.<name>.f64` (line ~175). [`src/runtime.ts`](../../src/runtime.ts) declares them (line ~1193).
- At the default x86-64 target (no SSE4.1) `llvm.floor` becomes a libm call. [`scripts/build.sh`](../../scripts/build.sh) line 298 links user programs with `-fno-plt`, so the call goes through the GOT: round measured Nish 531 ms vs C 483 ms in #943. At `--cpu x86-64-v3` the same IR is an inline `roundsd` (292 ms, ahead of Rust v3 at 367 ms).
- Five pure-SSE2 replacements were already raced in #943. None beat the libm call in a real build, so that route is closed.

## Reproduce

- Check the asm of the [`bench/math.ts`](../../bench/math.ts) round kernel at the default target and at `--cpu x86-64-v2`: a call vs an inline `roundsd`.
- List every site that emits `llvm.floor`, `llvm.ceil`, `llvm.trunc` or `llvm.round`, and time floor/ceil/trunc if they hit the same call.
- Take a noise band with 20+ interleaved runs of the round kernel on current `main`. `main` carries #916 (full RELRO, `-z now`), which may already change the call cost. Record it before racing.

## Candidates

| | candidate | notes |
|---|---|---|
| a | run-time dispatch | A process-wide flag set once at startup from cpuid (`__builtin_cpu_supports("sse4.1")` in the C runtime init) picks inline `roundsd` or the libm path. Ways to emit `roundsd` in a baseline function: inline asm, a helper marked `"target-features"="+sse4.1"` that LLVM can still inline, or a hoisted multiversioned loop. Pick the one LLVM does not penalise, and check the branch is hoisted out of hot loops. |
| b | linker-side | Call libm through the PLT, or `-z now`, for libm symbols only, and keep `-fno-plt` for everything else. This is the comparison point, not the goal. |
| c | anything better | Name it in the PR. |

Ship the fastest candidate that is exact on every edge case. The goal is `roundsd` on SSE4.1 hardware with no `--cpu` flag. If (b) wins outright, the PR says why dispatch lost, with the figures.

## Implementation

- The emitter change lives in `src/emit-builtins.ts` / `src/runtime.ts`, and applies only to the x86-64 target without SSE4.1 in its features. aarch64 and wasm lowering do not change.
- The rolling freeze applies: `src/` may not use a construct or builtin the seed does not ship. The emitter may *emit* new IR.
- The runtime flag goes in the existing runtime init ([`runtime/runtime.c`](../../runtime/runtime.c), or wherever startup already runs), with an environment override or test hook that forces the fallback. A new `runtime/*.c` file would need a `docs/security/` record. Prefer extending an existing file.
- The new lowering gets a `docs/IR_COOKBOOK.md` entry, with the exact IR.

## Tests

- A new `tests/cases/math_*` case, mirroring [`tests/cases/math_intrinsics.ts`](../../tests/cases/math_intrinsics.ts). It needs a golden `.ll` and a `.out` that matches Node's prelude byte for byte.
  - `round`: ±0, ±0.5, ±1.5, ±2.5, 0.49999999999999994, -0.49999999999999994, 2^52-0.5, 2^52, 2^53+1, ±Infinity, NaN, -1e-300, and the smallest and largest subnormals.
  - `floor`, `ceil` and `trunc`: the matching edges, including -0 results.
- The same case runs once more with the fallback forced, so CI covers both paths on SSE4.1 runners.
- Register it with `node tests/differential/goldens.js --update` in the same commit.

## Goldens and bench

- `node tests/self/goldens.js --update` regenerates the goldens. Read the diff. Only `.ll` goldens whose rounding lowering changes may move, and the PR lists them. aarch64 goldens and the NEON job stay put.
- If `bench/instructions.json` moves, the PR says why.
- Run `node bench/run.mjs --only math --runs 10 --warmup 2` on a scratch checkout, because it rewrites `docs/BENCHMARKS.md`. The full table goes in the PR. The bar: on every math kernel, Nish at the default target is at or below the fastest twin built for the same baseline target, outside the noise band. Rust native is reported separately.
- Run the whole bench suite and report any kernel that regresses.

## Out of scope

- Raising the default `--cpu` target. A binary built today must still run on baseline x86-64.
- Pure-SSE2 rounding sequences (already raced in #943).
- Changing `-fno-plt` for non-libm symbols.

## Verification

- `npm run check` and `npm run lint`, reading their bare exit codes.
- `node tests/run.js` filters `math_` and `round` (the filter is a substring of case names, so a bare `cases` matches none), then sections `selfhost`, `wasi` (`WASI_SYSROOT=/usr`, read the skip line), `performance`, `instructions`, `emit-ts` and `hardening`.
- The full `npm test` once before the PR opens, reading the skip count. CI's four shards stay the gate.
- The PR has the exact new IR, a `perf(codegen): …` subject, a `Measured:` trailer with the figures and the noise band, and `Refs: #943`.
