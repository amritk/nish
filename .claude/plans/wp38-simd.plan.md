---
name: WP38 SIMD — runtime byte-search kernel, nish/text indexOfAny, and the CPU-level decision
overview: Take docs/wp38-simd.md from proposed to built for its first stages — record the owner's decisions and the S0 baselines, add a runtime SIMD unit with a find-first-of-a-set kernel chosen at run time, expose it as an ordinary nish/text function the compiler lowers onto the kernel, move std/json's scans onto it, and settle the opt-in --cpu flag against its measured bar. nish:simd types (S3) and the lexer (S4) are out of this run.
stages:
  - id: s0-decide-measure
    title: "docs: record WP38's decisions and its S0 baselines"
    goal: wp38-simd.md moves from proposed to accepted, with Q1–Q4 answered and §2.3 holding the S0 figures every later bar is a ratio against
    verification: node docs/check-links.mjs && npm run lint && npm run lint:dead
    todos:
      - id: s0-decisions
        content: Rewrite the Status line and §8 of docs/wp38-simd.md as decided (Q1–Q4 as signed off) — see S0
      - id: s0-script
        content: Add bench/simd-s0.mjs that builds and times bench/scan.ts (native and wasm), nbody, vec3 and spectral at the baseline and with -march=x86-64-v3 on the same .ll, and times scripts/bootstrap.sh --verify — see S0
      - id: s0-figures
        content: Run it (min and median of at least seven runs) and write the figures and the commit they were taken at into docs/wp38-simd.md §2.3 and §7 — see S0
  - id: s1-kernel
    title: "feat(runtime): find the first byte of a set with 16-byte vectors, chosen at run time"
    goal: A new runtime unit, runtime/runtime-simd.c, exports nish_str_index_of_any with scalar, SSE2 or NEON, and AVX2 paths behind a lazy per-kernel resolver, linked beside runtime.c on every profile and pinned under its own ceiling
    verification: npm run check && npm test && npm run lint && npm run lint:dead
    todos:
      - id: k-unit
        content: Write runtime/runtime-simd.c with nish_str_index_of_any, its three paths and the resolver, declared in runtime/nish.h — see S1 kernel
      - id: k-pin
        content: Let NISH_SIMD=scalar|base|avx2 pin the resolver, and set it in bench/run.mjs beside PINNED_LIBC — see S1 kernel
      - id: k-build
        content: Pair runtime-simd.c with runtime.c in scripts/build.sh for every profile that links strings, wasi included (scalar or simd128 path there) — see S1 kernel
      - id: k-ceiling
        content: Add the unit's ceiling to tests/run.js at the next 256-byte boundary above its measurement, with rows in docs/wp7-runtime.md and docs/MASTER_PLAN.md §2 — see S1 kernel
      - id: k-agree
        content: Add a C test that runs all three paths on a fuzzed corpus and asserts they agree, plus a gc-sections check that a program not calling the kernel carries none of it — see S1 kernel
  - id: s1-surface
    title: "feat(std): indexOfAny in nish/text, lowered onto the runtime kernel"
    goal: indexOfAny(text, bytes, from) in std/text.ts is an ordinary Nish loop under Node and the runtime kernel natively, with the argument checks and edges kept as written
    verification: npm run check && npm test && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: sf-std
        content: Add indexOfAny to std/text.ts as argument checks plus one inner walker loop — see S1 surface
      - id: sf-recognise
        content: Recognise the walker by module and name in a new src/kernels.ts (mirroring src/parallel.ts) and replace its one call with the kernel, declaring it in src/runtime.ts — see S1 surface
      - id: sf-secret
        content: List nish_str_index_of_any in src/secret.ts isPureRuntime with the variable-time reason beside it — see S1 surface
      - id: sf-tests
        content: Add golden .ll, native round trip with expected stdout, Node agreement, a negative test, and a root-package std/text.ts that is not recognised — see S1 surface
      - id: sf-docs
        content: Add the LANGUAGE.md rule, the IR_COOKBOOK entry, std/README.md and docs/AI.md lines, and regenerate tests/self/goldens — see S1 surface
      - id: sf-bench
        content: Add bench/index-of-any.ts and measure kernel vs the unrecognised loop for the Measured trailer — see S1 surface
  - id: s1-json
    title: "perf(std): scan JSON structure and strings with indexOfAny"
    goal: std/json's structure scan and string skip use indexOfAny, and bench/json with jsonFields is at least 1.5x faster than S0
    verification: npm run check && npm test && npm run lint && npm run lint:dead
    todos:
      - id: sj-move
        content: Move jsonEndOfString, the in-string branch of jsonEndOfValue and the structure scan in std/json.ts onto indexOfAny — see S1 json
      - id: sj-measure
        content: Measure bench/json (jsonFields) against S0 and the four non-benchmark shapes, and put the figures in the Measured trailer — see S1 json
  - id: s2-cpu
    title: "feat(cli): an opt-in --cpu level, or the measurement that declines it"
    goal: Either an opt-in --cpu flag that clears wp38's 10% bar and that tests/ct-asm.js reads at every level, or a recorded decision not to ship it yet
    verification: npm run check && npm test && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: c-decide
        content: Read S0's -march=x86-64-v3 figures and take the branch the bar dictates — see S2
      - id: c-flag
        content: If the bar is met, add --cpu (x86-64-v2, x86-64-v3, armv8.2-a, native) through src/options.ts, src/compile.ts and scripts/build.sh with -ffp-contract=off for the runtime, and record the level in the capability report — see S2
      - id: c-ct
        content: If the bar is met, make tests/ct-asm.js read every accepted level and pass its fixtures at each — see S2
      - id: c-docs
        content: Document the flag in docs/LANGUAGE.md with a usage-error negative test, or record the decline in docs/wp38-simd.md §7 — see S2
---

## Context

[docs/wp38-simd.md](../../docs/wp38-simd.md) (merged in #508) proposes SIMD in stages S0–S4 and says no stage starts before the owner answers its §8. Its recommendations: (a) runtime kernels first, (d) a CPU flag beside it, (b) `nish:simd` only on its bar, (c) declined; baseline target; wrapping integer lanes; 128-bit only. This plan builds S0, S1 and S2. The json-one-pass run (#507) is in flight and owns `std/json.ts`, `runtime/runtime.c` and `s.indexOf`; nothing here touches its files until `s1-json`, which waits for it.

## Sign-off

Accepted by the owner on 2026-10-09: the plan, its acceptance criteria, and wp38 §8 as recommended — Q1 (a) runtime kernels first, (d) a CPU flag beside it, (b) on its bar, (c) declined; Q2 the baseline default target; Q3 integer lanes wrap, named so; Q4 128-bit only. `s1-json` is escalated as blocked on #507 if it cannot start before the run's deadline.

## Approach

- **One stage, one PR, one branch** `feature/wp38-simd/<stage-id>`.
- **Kernel before surface.** `s1-kernel` touches no `src/`, so it moves no self-golden. `s1-surface` links against it, so it starts only after `s1-kernel` merges.
- **The fixed interface** both S1 stages build to:

  ```c
  /* runtime/nish.h — first index i >= from with s[i] in set, or -1.
     from is already clamped to [0, len] by the caller; set holds 1..16 bytes. */
  int64_t nish_str_index_of_any(const nish_str *s, const nish_str *set, int64_t from);
  ```
- **Generated goldens are shared.** `tests/self/goldens/**` is regenerated (`node tests/self/goldens.js --update`) by every `src/` stage after it merges `main`, never resolved by hand (CLAUDE.md). That is the one path two stages may both write.
- **Bars are the doc's.** S1's ship bar is `bench/json` at ≥1.5x over S0; S2's is ≥10% on one of nbody/vec3/spectral with no loss on the others. A stage that misses its bar records the measurement and does not ship the feature.

## S0

- Status line → "accepted, S0–S2 in progress"; §8 table gains a "Decided" column with the signed-off answers.
- `bench/simd-s0.mjs` builds each program with the current `build/nish`, links with `--profile speed`, and for the `-march` column re-links the *same* `.ll` with `-march=x86-64-v3`. Every timed loop takes input that changes per iteration and folds into a printed checksum (CLAUDE.md). `bench/scan.ts` as wasm runs under Node.
- `bench/json` is not on `main` yet (it lives with #507), so its S0 row is written as "pending #507" with the reason; `s1-json` takes that row.
- Figures: min and median of ≥7 runs, the machine, and the commit SHA.

## S1 kernel

- **Unit.** `runtime/runtime-simd.c`, its own ceiling (wp7's rule: a new surface gets its own unit). Scalar path for any target; SSE2 on x86-64 and NEON on AArch64 as the baseline path (no dispatch needed); AVX2 under `__attribute__((target("avx2")))`. Set of 1..16 bytes: compare-and-OR per set byte for small sets, or a nibble-table classify — the worker's choice, stated in the commit body.
- **Resolver.** A function pointer starts at a resolver that calls `__builtin_cpu_init` and `__builtin_cpu_supports("avx2")`, reads `NISH_SIMD` (`scalar`, `base`, `avx2`; unset means best), stores the path and calls it. Nothing runs at program start.
- **Build.** `scripts/build.sh` compiles `runtime-simd.c` beside `runtime.c` the way it does `runtime-os.c` and siblings, for every profile that links strings; under wasi the scalar path (or `wasm_simd128.h` under `-msimd128` — not the default, §5).
- **Pinning.** `bench/run.mjs` sets `NISH_SIMD=base` beside `PINNED_LIBC` so the instruction count does not depend on the host. `bench/instructions.json` must not change.
- **Tests.** A C driver under `tests/simd/` runs all three paths (skipping AVX2 when the host lacks it, and saying so) on a seeded fuzzed corpus of lengths 0..300 with matches at every alignment, plus a check in `tests/run.js` that a program that never calls the kernel links none of it.
- **ARM in CI (owner, 2026-10-09).** The NEON path's agreement test runs natively on an ARM runner in `ci.yml` rather than as a local skip. The resolver keeps its direct `cpuid`/`xgetbv` check: `__builtin_cpu_supports` links libgcc's `__cpu_indicator_init` constructor into every program (+5.3 KB, start-up work in programs that never call the kernel).
- **Docs.** Ceiling row in `docs/wp7-runtime.md`, unit row in `docs/MASTER_PLAN.md` §2. If any path is adapted from elsewhere, its notice and a `THIRD_PARTY_NOTICES.md` entry (`.claude/licensing.md`).

## S1 surface

- `std/text.ts`:

  ```ts
  /** The first index at or after `from` whose byte is one of `bytes`, or -1. Variable-time. */
  export const indexOfAny = (text: string, bytes: string, from: i32): i32 => { /* checks, clamp, then indexOfAnyFrom(text, bytes, clamped) */ }
  ```
  The inner walker is a plain loop over `charCodeAt`; `bytes` is 1..16 ASCII bytes or the call panics as the std file says.
- `src/kernels.ts` recognises the walker by module (`nish/text`, package-checked as `isThreadsModule` does) and name; the emitter replaces that one call with `@nish_str_index_of_any`. A root-package file at `std/text.ts` is an ordinary module (negative test).
- `src/secret.ts` `isPureRuntime` gains the symbol with a comment: pure, variable-time, `std/crypto` must not call it on secret data.
- Tests: `tests/cases/text_index_of_any*.ts` with golden `.ll`, `.out` and Node agreement; edges — empty text, `from` < 0 and > length, no match, match at the last byte, non-ASCII text, 16-byte set; a negative case for an empty or over-long set. Every `.ll` golden of programs not using it is unchanged.
- Docs: LANGUAGE.md rule under the std text section, IR_COOKBOOK entry with the exact IR, `std/README.md`, `docs/AI.md`.
- Measured: `bench/index-of-any.ts`, a ≥1 MB haystack with rare matches, kernel vs the walker compiled unrecognised.

## S1 json

Starts only after `s1-surface` **and** #507's `json-skip-strings` stage have merged and `bench/json` is on `main`. Moves the byte-wise scans of [std/json.ts](../../std/json.ts) onto `indexOfAny`. Bar: `bench/json` with `jsonFields` ≥1.5x faster than its S0 row, measured on one machine; none of #507's non-benchmark shapes slower (a compiler `--json` line, a 50-key object with the field last, a miss, short strings only). Missing the bar means the PR records the figures and S1b (block classifier) is proposed, not built.

## S2

Starts after `s0-decide-measure` and `s1-surface` merge (it shares `scripts/build.sh`, `tests/run.js` and `docs/LANGUAGE.md` with them). If S0 shows <10% at `x86-64-v3` on all of nbody, vec3 and spectral, or a loss on any, the PR only records the decline in wp38 §7 (docs-only, `docs:` type). Otherwise: `--cpu <level>` passes `-march` to the module and runtime alike plus `-ffp-contract=off` for the runtime; an unknown level is a usage error (exit 2) with a negative test; the capability report records the level; `tests/ct-asm.js` compiles its fixtures at every accepted level and passes. The default stays the baseline.

## Ownership

| Stage | Owns | Model | Starts after |
| --- | --- | --- | --- |
| s0-decide-measure | `docs/wp38-simd.md`, `bench/simd-s0.mjs` | lead | — |
| s1-kernel | `runtime/runtime-simd.c`, `runtime/nish.h`, `scripts/build.sh`, `bench/run.mjs`, `tests/run.js`, `tests/simd/**`, `.github/workflows/ci.yml`, `docs/wp7-runtime.md`, `docs/MASTER_PLAN.md`, `THIRD_PARTY_NOTICES.md` | lead | — |
| s1-surface | `std/text.ts`, `std/README.md`, `src/kernels.ts`, `src/runtime.ts`, `src/emit.ts`, `src/emit-*.ts`, `tests/run.js`, `tests/link/std_text_index_of_any*/**`, `tests/link/caps_package_named_nish/expected.caps.json`, `src/secret.ts`, `src/std-modules.ts`, `src/run-cache.ts`, `tests/nish/run.ts`, `tests/cases/text_index_of_any*`, `tests/link/std_text_index_of_any/**`, `tests/self/goldens/**`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/AI.md`, `bench/index-of-any.ts` | lead | s1-kernel |
| s1-json | `std/json.ts`, `tests/link/std_json/**`, `tests/self/goldens/**` | lead | s1-surface, #507 stage 3 |
| s2-cpu | `src/options.ts`, `src/compile.ts`, `src/capability-report.ts`, `src/target.ts`, `scripts/build.sh`, `tests/ct-asm.js`, `tests/run.js`, `tests/cases/cli_cpu*`, `tests/self/goldens/**`, `docs/LANGUAGE.md`, `docs/wp38-simd.md`, `docs/MASTER_PLAN.md`, `docs/README.md` | lead | s0-decide-measure, s1-surface |

## Out of scope

- S1b (block classifier) — only if `s1-json` misses its bar.
- S3 `nish:simd` vector types — the doc gates it on S1's result; a separate run.
- S4 the lexer on `indexOfAny` — needs the release after S1 (rolling freeze).
- Target intrinsics (declined), a wider default target (declined), `-ffast-math` (declined).
- Any change to `s.indexOf` or `runtime/runtime.c` (json-one-pass owns them).

## Verification

Every stage: `npm run check`, an **undegraded** `npm test` (read the skip count), `npm run lint`, `npm run lint:dead`, `node docs/check-links.mjs` when Markdown moves, `node bench/run.mjs --instructions --check` with `bench/instructions.json` unchanged, and CI green on the head including `bootstrap`.
