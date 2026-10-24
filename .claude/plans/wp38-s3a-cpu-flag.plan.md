---
name: WP38 S7 golden, S3a and S2 — pin the offset rule, measure nish:simd's bar, then the --cpu x86-64-v3 flag
overview: The owner's decisions of 2026-10-16 (docs/wp38-simd.md §8, Q7 to Q9). S7 is already built by #561, so a first stage only pins its one missing negative golden. S3a measures S3's two bar kernels without building any language, so `nish:simd` is built or declined on figures. S2 adds `--cpu x86-64-v3`, the one CPU level that met its bar, with both constant-time checkers reading it.
stages:
  - id: s7-other-holder-golden
    title: S7's missing negative golden
    goal: Pin that a guard on one array's length does not prove an offset access into another, the one negative case of S7's row that #561 left without a golden
    verification: node tests/run.js <case> runs the new case natively and under Node with its expected panic; every CI test shard green and undegraded; the differential and checked goldens regenerated and read
    status: pending
    todos:
      - id: s7-golden-case
        content: Add tests/cases/arr_bounds_offset_other.ts and its .ll, and a row in each of tests/run.js's two offset-index tables — see S7, The missing golden
        status: pending
      - id: s7-register-goldens
        content: Register the case with node tests/differential/goldens.js --update and regenerate tests/self/goldens with node tests/self/goldens.js --update — see Verification
        status: pending
  - id: s3a-measure
    title: S3a — S3's bar kernels, measured without a surface
    goal: Record in docs/wp38-simd.md §2.3 whether a portable 128-bit vector kernel beats a fair scalar Nish kernel by 1.5x, on a numeric kernel and on a byte scan
    verification: node bench/simd-s3a.mjs --self --runs 15 prints every column with one checksum per kernel; npm run lint and node docs/check-links.mjs pass; every CI test shard green and undegraded, which compiles the new bench/*.ts
    status: pending
    todos:
      - id: s3a-numeric-kernels
        content: Write the spectral mat-vec kernel four ways in bench/simd-s3a/ (C portable-vector, C scalar, Nish scalar with checked indexing, Nish scalar with uncheckedGet) — see S3a, The kernels
        status: pending
      - id: s3a-byte-kernels
        content: Write bench/scan.ts's depth count the same four ways in bench/simd-s3a/ — see S3a, The kernels
        status: pending
      - id: s3a-portability-check
        content: Show the C vector kernels' optimised IR holds no llvm.x86 or llvm.aarch64 intrinsic, the only IR nish:simd could emit — see S3a, Staying portable
        status: pending
      - id: s3a-harness
        content: Add bench/simd-s3a.mjs on bench/simd-s0.mjs's pattern (interleaved rounds, a byte-identical copy column, min and median, checksums) — see S3a, The harness
        status: pending
      - id: s3a-record
        content: Write the S3a record into docs/wp38-simd.md §2.3 and its §7 row, with the reading the bar gives — see S3a, The record
        status: pending
  - id: s2-cpu-flag
    title: S2 — the --cpu x86-64-v3 flag
    goal: Ship `--cpu x86-64-v3` for the module and the runtime alike, every other value refused, with tests/ct-asm.js and tests/ct-asm-runtime.js reading x86-64 at that level
    verification: npm run check, npm run lint, node tests/run.js wasi and node tests/run.js performance green locally; every CI test shard green and undegraded; the ct_asm checks pass at the baseline and at x86-64-v3; the checked goldens regenerated and read
    status: pending
    todos:
      - id: s2-parse-flag
        content: Parse --cpu in src/compile.ts, accepting x86-64-v3 alone and refusing every other value with exit 2 — see S2, The flag
        status: pending
      - id: s2-forward-build
        content: Forward the level through pushRecipeFlags to a new --cpu case in scripts/build.sh that adds -march=x86-64-v3 and -ffp-contract=off for every unit — see S2, The link
        status: pending
      - id: s2-refuse-targets
        content: Refuse --cpu under the wasi and wasm profiles and for a --target that is not x86-64 — see S2, The flag
        status: pending
      - id: s2-cache-keys
        content: Add the level to runtimeCacheKey and runCacheKey in src/run-cache.ts — see S2, The caches
        status: pending
      - id: s2-capability-report
        content: Record the level in the capability report in src/capability-report.ts and update tests/nish/cli.ts's expected report — see S2, Where a deployer reads it
        status: pending
      - id: s2-ct-asm-levels
        content: Run both ct_asm sections of tests/run.js and tests/ct-asm-runtime.js at the baseline and at x86-64-v3 on x86-64 — see S2, The constant-time checks
        status: pending
      - id: s2-tests
        content: Add driver tests that a --cpu build links and runs, and that an unknown level, native and a wasm profile are each refused — see Tests
        status: pending
      - id: s2-docs
        content: Update LANGUAGE.md, docs/guide/using-nish/cli.md, CT-16 in docs/security/ct-verification.md and the S2 row of docs/wp38-simd.md — see S2, Docs
        status: pending
      - id: s2-goldens
        content: Regenerate tests/self/goldens with node tests/self/goldens.js --update and read the diff — see Verification
        status: pending
---

## Context

[docs/wp38-simd.md](../../docs/wp38-simd.md) §8 records the owner's decisions of 2026-10-16:

- **Q7:** S2's `--cpu` flag ships with one value, `x86-64-v3`, for the module and the runtime alike.
- **Q8:** S3 (`nish:simd`) waits for S3a's figures.
- **Q9:** S7, the offset-index credit, first. It turned out to be built already: #561 credits `xs[i + c]` from a guard on the sum (`offsetIndex` and `belowReach`, [src/bounds.ts](../../src/bounds.ts)). §3.2.1's dot product, guarded and with checked indexing, now compiles to a binary byte-identical to its `uncheckedGet` form (§7, S7). So this plan has S3a and S2, and before them one small stage that pins the S7 negative case #561 left without a golden.

The stages share no source file. `s7-other-holder-golden` is mechanical (`Model: sonnet`); it and `s2-cpu-flag` both edit `tests/run.js` (different sections) and regenerate `tests/self/goldens`. That is a merge-order edge: the golden stage merges first, and `s2-cpu-flag` merges `main` and regenerates before it merges. Both edit `docs/wp38-simd.md`, in different rows, so whichever merges second merges `main` first.

| Stage | Owns |
| --- | --- |
| `s7-other-holder-golden` | `tests/cases/arr_bounds_offset_other.*`, `tests/run.js` (the two offset-index tables), `tests/differential/goldens/**`, `tests/self/goldens/**` |
| `s3a-measure` | `bench/simd-s3a/**`, `bench/simd-s3a.mjs`, `docs/wp38-simd.md` (§2.3's S3a subsection, §7's S3a row) |
| `s2-cpu-flag` | `src/compile.ts`, `src/run-cache.ts`, `src/capability-report.ts`, `scripts/build.sh`, `tests/run.js` (the two `ct_asm` sections and the driver tests), `tests/ct-asm-runtime.js`, `tests/nish/cli.ts`, `tests/self/goldens/**`, `docs/LANGUAGE.md`, `docs/guide/using-nish/cli.md`, `docs/security/ct-verification.md`, `docs/wp38-simd.md` (§7's S2 row) |

## S7 — the missing golden

### The missing golden

#561 pins a reach too short for `k` (`arr_bounds_offset_reach`), a sum that may be negative (`arr_bounds_offset_floor`) and `--wrapping` (`arr_bounds_offset_wrap`). It has no case where the guard bounds one array and the access reads another. `tests/cases/arr_bounds_offset_other.ts` is that case, written like `arr_bounds_offset_reach.ts`:

```ts
// A guard on `xs.length` says nothing about `ys`: `ys[i + 1]` keeps its check
// and panics on the pass where `ys` is shorter.
const mixed = (xs: i32[], ys: i32[]): i32 => {
  let s = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    s = s + xs[i + 1] + ys[i + 1];
  }
  return s;
};
```

Model: sonnet.

`main` calls it with `xs` of four elements and `ys` of two. Checked at `5403a55`: `mixed` keeps one `nish_panic_index` branch, on `ys`, and none on `xs`; NL9007 warns once, on `ys[i + 1]`; the run prints `index out of range: 2 >= 2` and exits 1. Like its siblings it has no `.out`. It gets one row in each of the two offset-index tables in [tests/run.js](../../tests/run.js) (around line 6949): `["arr_bounds_offset_other", "mixed", 1]` in the check-count table, and `["arr_bounds_offset_other", "a guard on another array's length", "", "2 >= 2"]` in the panic table. The `.ll` shows both facts. The PR shows that IR, as CLAUDE.md asks for every snippet added to the tests.

## S3a — S3's bar kernels, measured without a surface

S3's bar (§7) is a kernel written with `nish:simd` at least 1.5x faster than the same kernel in scalar Nish at the default target, on a numeric program from `bench/` and on a byte scan `indexOfAny` cannot express. S3a answers it before any type exists. It writes each kernel in C with the generic vectors `nish:simd` would lower to, and times it against the fair scalar comparator §3.2.1 defines.

### The kernels

Two kernels, four forms each, in `bench/simd-s3a/`:

| Kernel | From | Vector form |
| --- | --- | --- |
| mat-vec | the inner `A(i, j) * u[j]` sum of [bench/spectral.ts](../../bench/spectral.ts) | `f64x2`, two lanes and two accumulators |
| depth count | the string, escape and depth state machine of [bench/scan.ts](../../bench/scan.ts) | `u8x16` compares for `"`, `\`, `[{` and `]}`, an `any` test per block, and the bitmask only on a hit (§3.2.1, point 4) |

The four forms of each:

1. **C, portable vector.** `typedef double f64x2 __attribute__((vector_size(16)))` and its `u8x16` sibling. Only element-wise arithmetic and compares, `__builtin_shufflevector` with constant indices, and `__builtin_reduce_add` / `__builtin_reduce_or`. No `<immintrin.h>` and no `<arm_neon.h>`. This stands in for `nish:simd`'s lowering.
2. **C, scalar.** The same algorithm without vectors. It separates the language's cost from the vectors' gain, so a ratio is not a C-against-Nish artefact.
3. **Nish, scalar, checked indexing.** The comparator S3's bar names. It meets §3.2.1's rules: integer arithmetic wraps where the lanes do (`nish:unsafe`'s `wrappingAdd`), with one accumulator per vector-kernel lane, and a guard `i + c < n` so #561 proves the offset accesses.
4. **Nish, scalar, `uncheckedGet`.** The same, every access through `uncheckedGet`, to show what the checks still cost.

Every form takes inputs that change on every iteration and folds every answer into a printed checksum, as `bench/simd-s0.mjs` does. A kernel's four forms must print one checksum.

### Staying portable

A vector form only counts if it emits what `nish:simd` could. Its `clang -O2 -S -emit-llvm` output must hold no `llvm.x86.` and no `llvm.aarch64.` call. The harness checks this for each C vector file before timing it, and refuses to time one that fails.

### The harness

`bench/simd-s3a.mjs` follows `bench/simd-s0.mjs`:

- It builds the Nish forms with `build/nish --profile speed --link` and the C forms with `clang -O3`, at the baseline target, with no `-march`.
- Then it runs every binary in alternating rounds after one warm-up.
- Flags:
  - `--runs N`, the number of timed rounds (default 7, the note's minimum);
  - `--self`, which adds a byte-identical copy of the Nish checked form as the noise band;
  - `--only mat-vec,depth`, which picks the kernels.
- It reports the minimum and median in ms for each binary, and fails if any binary in a kernel prints a different checksum.
- For each Nish form it says whether `opt -O3` gave the kernel a vector loop: it greps the optimised IR for `<2 x double>` or `<16 x i8>`, as §3.2.1 did by hand.

### The record

A new §2.3 subsection, "S3a: the bar kernels without a surface", records:
- the commit, the machine (lscpu) and clang's version;
- the table of the four forms per kernel, with the copy's band;
- each ratio of form 1 over form 3, read against the band;
- whether forms 3 and 4 vectorised.

An AArch64 figure comes from a machine that has one; if none is at hand, the record says so rather than leaving it blank.

The record ends with the reading §7 already fixes:
- If neither kernel clears 1.5x, S3 moves to §9, the owner's call recorded as a new question.
- If only the depth count clears it, S3 is weighed against S6c's classifier on that kernel.
- If both clear it, S3's design is written next.

§7's S3a row is marked landed with the commit.

## S2 — the `--cpu x86-64-v3` flag

### The flag

[src/compile.ts](../../src/compile.ts) parses `--cpu <level>` beside `--profile` (line 504):
- **Accepted:** `x86-64-v3` only.
- **Refused, exit 2, one line naming the accepted level:**
  - any other value, `native` included. `native` is refused because no CI run can read it (§7, "What reading every level costs").
  - `--cpu` under `--profile wasi`, and with `--target` set to a triple that is not x86-64.

Without `--cpu` nothing changes: no `.ll` golden moves, because the level only reaches the link.

### The link

`pushRecipeFlags` passes `--cpu x86-64-v3` on. [scripts/build.sh](../../scripts/build.sh) gains a `--cpu)` case beside `--profile)` (line 90). It adds `-march=x86-64-v3 -ffp-contract=off` to the flags every unit compiles with: the program, `runtime.c` and the units it brings. That covers the one-command link, `--runtime-objects` and `--runtime-from` alike.

Module and runtime get the level together because the speed profile's LTO inlines baseline runtime functions into module functions (§7, S2's recommendation). `-ffp-contract=off` keeps the runtime's C from fusing a multiply and an add on a level with FMA (§3.4). `build.sh --profile wasm` refuses `--cpu` too, because a wasm32 guard in the compiler never sees that route (CLAUDE.md).

### The caches

A cached runtime compiled at the baseline must never be linked into a `--cpu` program, or the other way round. So the level goes into both keys in [src/run-cache.ts](../../src/run-cache.ts):
- `runtimeCacheKey` (line 311), on the `profile` line;
- `runCacheKey` (line 279).

A test builds the same program with and without `--cpu` against one cache and shows two runtime entries.

### Where a deployer reads it

§5 says the level a binary was built for is recorded where a deployer can read it. The capability report ([src/capability-report.ts](../../src/capability-report.ts)) gains a top-level `"cpu"` key: `"x86-64-v3"`, or `"baseline"` without the flag. The report's byte-for-byte contract in [tests/nish/cli.ts](../../tests/nish/cli.ts) is updated in the same change.

### The constant-time checks

§6 lets the flag ship only once both checkers read the level. On x86-64, the two `ct_asm` sections of [tests/run.js](../../tests/run.js) run once at the baseline and once with `-march=x86-64-v3` added to `clangAsm`:
- the Nish fixtures, `ct_asm: …`;
- the runtime kernels, through `runtimeChecks` in [tests/ct-asm-runtime.js](../../tests/ct-asm-runtime.js), which takes the extra flag as a parameter.

Each check name gains the level, so a record citing one still greps to it. #638 measured both passing at v3: 50 of 50 fixture readings and 7 of 7 kernel readings. A failure there blocks the stage, as §6 says.

### Docs

- **[docs/LANGUAGE.md](../../docs/LANGUAGE.md):** the rule. One accepted level, what it changes (the link only, module and runtime), what it does not (no operation's meaning; no contraction), and that a release binary stays baseline.
- **[docs/guide/using-nish/cli.md](../../docs/guide/using-nish/cli.md):** the flag beside `--profile` in "Compiling: IR and binaries". A binary built with it dies with `SIGILL` on a CPU without AVX2, and `--cpu` is for a binary that stays on known machines.
- **[docs/security/ct-verification.md](../../docs/security/ct-verification.md):** CT-16 narrowed to "baseline and x86-64-v3 read; every other level unread". The record names the commit its anchors are at and the exact `check(...)` strings, as CLAUDE.md requires.
- **[docs/wp38-simd.md](../../docs/wp38-simd.md):** §7's S2 row marked landed.

## Out of scope

- Any CPU level but `x86-64-v3`. An AArch64 level or `x86-64-v4` comes on its own measurement and its own pass of both checkers. The SVE levels need an SVE model first (§7).
- `native`, at all.
- `-msimd128` for the wasm profiles (§5). It is a separate level with its own stage.
- `nish:simd` itself. S3a decides whether it is ever written.
- Building the prebuilt `nish` with `--cpu`. It stays baseline (§5).

## Tests

- **S3a:** `npm test` already compiles every `bench/*.ts` (`tests/run.js:14881`), so the Nish forms are covered. The harness's checksum and portability checks are its own tests.
- **S2, positive:** a `--cpu x86-64-v3` build of `examples/hello.ts` links and prints the same output as the baseline build. Gate it on `/proc/cpuinfo` showing `avx2`, and grep its PASS line in `.github/workflows/ci.yml` so a runner without AVX2 cannot leave it unread (CLAUDE.md).
- **S2, negative:** each of `--cpu native`, `--cpu x86-64-v4`, `--cpu armv8.2-a`, `--cpu x86-64-v3 --profile wasi`, and `--cpu x86-64-v3 --target aarch64-unknown-linux-gnu` exits 2 with its message.
- **S2, caches:** the two-entry test above.
- **S2, constant time:** every existing `ct_asm` check runs at both levels on x86-64.

## Verification

- **S7 golden:**
  - `node tests/run.js <case>`, with the new case's native and Node runs read
  - `node tests/differential/goldens.js --update` and `node tests/self/goldens.js --update`, with each diff read

- **S3a:**
  - `node bench/simd-s3a.mjs --self --runs 15`
  - `npm run lint`
  - `node docs/check-links.mjs`
- **S2:**
  - first, `bash scripts/fetch-seed.sh --force` and `npm run build`
  - then `npm run check` and `npm run lint`
  - then `node tests/run.js wasi` (with `WASI_SYSROOT` set; read its skip line) and `node tests/run.js performance`
  - finally `node tests/self/goldens.js --update`, with the diff read before it is committed
- **Every stage:** every CI `test` shard green and undegraded on the PR's head, per [CLAUDE.md](../../CLAUDE.md#definition-of-done).
