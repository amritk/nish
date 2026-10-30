---
name: Hardware CRC-32 for nish/compress/checksum, and a measured verdict on SIMD Adler-32
overview: "Crc32.update is slicing-by-8, braided five ways from 80 bytes, in Nish. Natively it gains a runtime kernel on the WP38 S5 pattern: a compiler seam, a nish_crc32_hw resolver answered once per process, and NISH_CRC32=soft to force the Nish code. x86-64 folds with PCLMULQDQ; AArch64 uses the ARMv8 CRC32 instructions, plus PMULL folding if it measures faster. wasm and 32-bit keep the Nish code. gzip, zlib and http-compress pick it up with no API change. A second stage measures SSSE3 and NEON Adler-32 and ships them only past a 20% bar."
stages:
  - id: crc32-kernels
    title: "perf(runtime): CRC-32 on PCLMULQDQ and the ARMv8 CRC32 instructions"
    goal: Every Crc32.update in a native x86-64 or AArch64 program runs a hardware kernel where the CPU has one, and the Nish code everywhere else. Results are bit-identical on every path, and the run is proven on hardware CI for both architectures.
    verification: "npm run check && npm run lint && node tests/run.js std_compress && node tests/run.js 'crc32 kernel' && node tests/run.js simd && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node scripts/security-scope.mjs && node bench/crc32.mjs --check, all exit 0. The checked goldens are regenerated and read. Every CI test shard is green and undegraded, and simd-arm64 is green with its CRC-32 steps."
    status: pending
    todos:
      - id: crc-walker
        content: Move Crc32.update's loop into a private free walker in std/compress/checksum.ts that update calls once, after its checks — see Stage 1, The seam
        status: pending
      - id: crc-seam
        content: Recognise the walker by module and name (isCrc32Seam, isCompressChecksumModule) and lower its call to a branch on nish_crc32_hw with a value join — see Stage 1, The seam
        status: pending
      - id: crc-runtime
        content: Write runtime/runtime-checksum.c with the resolver, the x86 PCLMUL fold kernel and the AArch64 CRC32 kernel, with its contract in runtime/nish.h — see Stage 1, The kernels
        status: pending
      - id: crc-pmull
        content: Measure AArch64 PMULL folding against the crc32x loop on the arm64 runner, and keep it only if it is faster on 64 KiB and 1 MiB — see Stage 1, The kernels
        status: pending
      - id: crc-link-lists
        content: Add runtime-checksum.c to every runtime link list, with the wasm arm keyed on nish_crc32_hw — see Stage 1, Build and link
        status: pending
      - id: crc-tests
        content: Add the per-path tests, the differential test, the soft-leaves-the-kernel-unused test and the triple and toolchain compile checks — see Stage 1, Tests
        status: pending
      - id: crc-ci
        content: Add hardware CI steps to the x86 test shard and to simd-arm64 that assert the kernel ran — see Stage 1, Hardware CI
        status: pending
      - id: crc-bench
        content: Add bench/crc32.ts and bench/crc32.mjs, and record the figures per machine and path, with the selected path — see Stage 1, Benchmark
        status: pending
      - id: crc-docs
        content: Write the security record, its index row, the guide page, the wp38 row and the budget row — see Stage 1, Docs and records
        status: pending
  - id: adler32-simd
    title: "perf(runtime): a measured verdict on SSSE3 and NEON Adler-32"
    goal: Measure a vectorised Adler-32 against the Nish adler32Update on x86-64 and AArch64 at 64 KiB and 1 MiB. Ship each architecture's kernel only if it gains 20% or more at both sizes, and otherwise record the figures and ship nothing.
    verification: "node bench/adler32.mjs --check exits 0 and prints both sizes per path with checksums. npm run check, npm run lint and node tests/run.js std_compress pass. If a kernel ships, node tests/run.js 'adler32 kernel', node tests/run.js simd, WASI_SYSROOT=/usr node tests/run.js wasi and node tests/run.js performance also pass. Every CI test shard and simd-arm64 is green."
    status: pending
    todos:
      - id: adler-prototype
        content: Write the SSSE3 and NEON Adler-32 kernels in C and a bench against the compiled Nish adler32Update — see Stage 2, Measure
        status: pending
      - id: adler-decide
        content: Record the figures and the noise band per architecture in docs/wp38-simd.md and bench/README.md, and decide against the 20% bar — see Stage 2, Decide
        status: pending
      - id: adler-ship
        content: For each architecture that passed, ship the kernel on Stage 1's seam pattern with the same test set, or ship nothing — see Stage 2, Ship
        status: pending
---

# Hardware CRC-32 for nish/compress/checksum

## Context

| Fact | Where |
| --- | --- |
| `Crc32.update(crc, buf, off, len): u32` is slicing-by-8 with eight 256-entry tables, braided five ways (Kadatch–Jenkins) from 80 bytes | `std/compress/checksum.ts:104-243` |
| It is called by `gzip.ts` (`new Crc32()` at :180, :217, :314, :533; `update` at :410), and through it by `std/net/http-compress.ts`. zlib uses Adler-32 (`adler32Update`, :256) | grep `Crc32` |
| WP38 S5 is the pattern: `isAesSeam` (`src/kernels.ts:97-154`), `emitAesKernelArm` (`src/emit.ts:1677-1737`), the declares (`src/runtime.ts:1237-1291`), `runtime/runtime-aes.c` (its resolver at :444-457, cpuid/getauxval at :412-435, its stubs at :459-490), and the contract in `runtime/nish.h:313-345` | |
| The seam is skipped on wasm (`isWasmBuild`, `emit.ts:1680`). A `--profile wasi` build must reference no kernel symbol | `tests/run.js:17763` |
| Both paths are tested by wrapping the kernels with `-Wl,--wrap` counters and running with the env var unset and set to `soft` | `tests/run.js:17960-18128` |
| Hardware CI: shard 1 of `test` (ubuntu-latest, x86) and `simd-arm64` (`ubuntu-24.04-arm`) | `.github/workflows/ci.yml:419-435, 1055` |
| macOS CI is off (`runtime-net` is `if: false`; `test`'s macos-latest is commented out). Darwin is checked by cross-compiling | `ci.yml:211, 1130` |
| PR #1055 (`sha256-hw`, run #1022) adds a third seam over the same files. Whichever lands second merges `main` and regenerates | open PR |

The targets are x86_64 and aarch64 on linux and darwin, wasm32-wasi and wasm32-unknown-unknown. 32-bit and wasm get no kernel.

## Stage 1: perf(runtime): CRC-32 on PCLMULQDQ and the ARMv8 CRC32 instructions

**Owns:** `runtime/runtime-checksum.c`, `runtime/nish.h`, `src/kernels.ts`, `src/emit.ts`, `src/runtime.ts`, `src/std-modules.ts`, `src/run-cache.ts`, `std/compress/checksum.ts`, `std/README.md`, `scripts/build.sh`, `scripts/fuzz.sh`, `tests/run.js`, `tests/nish/run.ts`, `tests/runtime-budgets.js`, `tests/simd/crc32*`, `tests/link/std_compress_crc*/**`, `tests/self/goldens/checked/**` (generated), `.github/workflows/ci.yml`, `.github/workflows/interop.yml`, `bench/crc32*`, `bench/README.md`, `docs/wp38-simd.md`, `docs/guide/using-nish/compression.md`, `docs/security/compress.md`, `docs/security/README.md`, `docs/ARCHITECTURE.md`, `docs/wp7-runtime.md`, `THIRD_PARTY_NOTICES.md`

### The seam

- `Crc32.update` keeps `checksumWindow` and the table-size check, then makes **one** call: `crc32Walk(t, bt, crc, buf, off, len): u32`. This is a private free function holding today's loop verbatim, so the soft path is byte-for-byte today's code.
- `src/std-modules.ts`: add `COMPRESS_CHECKSUM_SPECIFIER` and `isCompressChecksumModule`, shaped like `isCryptoAesModule`.
- `src/kernels.ts`: add `isCrc32Seam(program, sig)`, matching the free, non-instance `crc32Walk` in that module. Add `CRC32_HW = "nish_crc32_hw"` and the kernel's symbol, with a header paragraph like S5's.
- `src/emit.ts`: off wasm, the call becomes `nish_crc32_hw() ? kernel(...) : crc32Walk(...)`, joined by a `phi i32`. AES seams are void-only, so the value join is new. Keep it local to this seam, and keep the void rule for AES as it is.
- The kernel takes `crc` (pre- and post-conditioned as the walker's caller expects), the array the walker reads, `off` and `len`, in the AES array ABI.
- The contract goes in `nish.h`: `0 <= off`, `off + len <= length`, already checked by `update`.
- `src/` may only use constructs the seed ships (rolling freeze). This change adds a recognition, not a construct.

### The kernels (`runtime/runtime-checksum.c`)

- **Resolver**: `int32_t nish_crc32_hw(void)`, answered once and cached atomically, as `nish_aes_hw` is. Only the exact value `NISH_CRC32=soft` pins the soft path.
- **Detection**:
  - x86-64: cpuid leaf 1, ECX PCLMULQDQ (bit 1) and SSE4.1 (bit 19).
  - Linux aarch64: `getauxval(AT_HWCAP)`, `HWCAP_CRC32` (bit 7), and `HWCAP_PMULL` (bit 4) for the fold.
  - Apple: `sysctlbyname("hw.optional.armv8_crc32")`.
  - Every other system: 0.
  - No `__builtin_cpu_supports`, for the same reason runtime-aes.c gives.
- **x86-64** `target("pclmul,sse4.1")`: the Gopal et al. method (Intel, "Fast CRC Computation for Generic Polynomials Using PCLMULQDQ", 2009), as zlib-ng and Chromium use it, for the reflected ISO 3309 polynomial 0xEDB88320.
  - Fold 4×128 bits per step from 64 bytes, then fold to 128 bits, then reduce to 32 bits with a Barrett reduction.
  - Inputs under the fold threshold, and the tail, take a byte loop on a 1 KiB table in C.
  - Derive the constants with a checked-in generator, or cite them with a test that recomputes them.
  - **Never the SSE4.2 `crc32` instruction**: it computes CRC-32C.
- **AArch64** `target("+crc")`: a `__crc32d` loop of 8 bytes per step (`__crc32w/h/b` for tails).
- **AArch64 PMULL** `target("+crypto")` (or `+aes`): a fold kernel on the same method. Keep it, selected on `HWCAP_PMULL`, only if `bench/crc32.mjs` on the `ubuntu-24.04-arm` runner shows it faster than the crc32x loop at 64 KiB and 1 MiB, outside the noise band. Otherwise delete it, and record the figures and the verdict.
- **Elsewhere**, and on a toolchain without the intrinsics: `nish_crc32_hw` returns 0 and the kernels are `__builtin_trap()` stubs, as in runtime-aes.c. Choose this at compile time with `__has_include(<wmmintrin.h>)`, `__has_include(<arm_acle.h>)` and `__has_attribute(target)`, not by arch alone.
- **No `-march` and no global CPU flag.** Only these functions carry target attributes.
- **Licensing**: any code ported from zlib-ng (zlib licence) or Chromium (BSD-3) keeps its notice and gets a `THIRD_PARTY_NOTICES.md` entry (`.claude/licensing.md`).

### Build and link

- Add `runtime-checksum.c` beside `runtime-aes.c` in `scripts/build.sh` (`halves` :216), its wasm arm (:638-652, keyed on `@nish_crc32_hw(`), `scripts/fuzz.sh`, `tests/run.js` `RUNTIME_C` (:157), `tests/nish/run.ts` (:497), `src/run-cache.ts` (:82) and the `interop.yml` path triggers.
- Section GC must keep hello byte-identical with the file linked.

### Tests

Each test below runs under `NISH_CRC32` unset and `=soft`. The C test also calls every kernel the build has, directly.

1. **`tests/link/std_compress_crc_paths`** checks:
   - "123456789" gives 0xCBF43926, and the empty input gives 0.
   - The CRC and ISIZE trailers (RFC 1952) of `.gz` files made by system `gzip -n` from real files, either committed as fixtures or produced by the test.
   - Streaming updates split at every point in 1..16, 63/64/65 and 127/128/129, on inputs long enough to cross each threshold.
   - The outputs under both settings must be identical and match `expected.out`.
2. **Differential, `tests/link/std_compress_crc_diff`**:
   - Seeded random inputs of every length 0..4096, at offsets 0..15 into a larger array, plus 1, 4 and 16 MiB inputs (and one odd size).
   - Each is checked against a bitwise reference CRC in the program, and the run prints a digest.
   - The digest must match across both settings.
3. **`tests/simd/crc32.c`**: every compiled kernel (clmul, crc32x and, if kept, pmull) against zlib's `crc32()` on the same lengths and offsets. It is built natively and on the QEMU aarch64 arm the `simd` section already has.
4. **The kernel stays unused under soft**: a `-Wl,--wrap=nish_crc32_*` counter, as for AES.
   - Under `=soft` it must count 0 calls.
   - Unset on a CPU whose `/proc/cpuinfo` shows `pclmulqdq`+`sse4_1` (x86) or `crc32` (arm64), it must count more than 0. Otherwise it must count 0.
   - New section name: `crc32 kernel`.
5. **Triples**:
   - `--profile wasi` and `--profile wasm` builds reference no `nish_crc32_` symbol and still pass `std_compress`.
   - `runtime-checksum.c` compiles for `x86_64-apple-darwin` and `arm64-apple-darwin` (cross-compile, no link), and for i686 and armv7 (stub path).
   - It compiles with the intrinsic headers hidden and selects the stub path.
6. The existing `std_compress`, `std_compress_node` and `std_http_compress` pass unchanged. `gzip.ts` and `zlib.ts` do not change.

### Hardware CI

- **`test` shard 1** (x86): add a step "The CRC-32 PCLMUL path ran" that greps the counter line from the `crc32 kernel` section, as "The AES-NI path ran" does.
- **`simd-arm64`**:
  - Run `node tests/run.js "crc32 kernel"` and grep that the unset run called the kernel.
  - Run the `tests/simd/crc32.c` agreement natively.
  - Run `node bench/crc32.mjs` once so its figures are in the log.
- Do not add steps to any job that has `if: false`.
- The PR body names what CI cannot run (darwin x86_64/arm64: cross-compiled only; i686/armv7: cross-compiled stub; wasm: run through the existing wasi/wasm sections) and how each was checked.

### Benchmark

- `bench/crc32.ts` and `bench/crc32.mjs`, on `bench/aes-gcm.mjs`'s pattern: interleaved columns, a byte-identical copy column for the noise band, checksums, and `--env NISH_CRC32=soft`.
- They report:
  - CRC-32 throughput (MB/s and ns/op) on 64 B, 4 KiB, 64 KiB and 1 MiB.
  - gzip compress and decompress of a 1 MiB file, in ns/op.
- Each machine reports the selected path (`clmul`, `crc32x`, `pmull` or `soft`), read from the same evidence the counter test uses.
- Record figures for this container (x86) and the arm64 runner in `bench/README.md` and the PR body.

### Docs and records

- **Security record**: extend `docs/security/compress.md` with a `## Scope` row for `runtime/runtime-checksum.c` and its review. The kernels read only `[off, off+len)` of an array whose bounds the caller checked; record that and test it. Add `runtime/runtime-checksum.c` to that area's row in the `docs/security/README.md` index. `node scripts/security-scope.mjs` passes.
- **`docs/guide/using-nish/compression.md`**: which machines run which path, and `NISH_CRC32=soft`.
- **Other docs**: a row and section in `docs/wp38-simd.md` (S-row, §7), `std/README.md`, and the places `docs/ARCHITECTURE.md` and `docs/wp7-runtime.md` list runtime files.
- **Budget**: a `RUNTIME_CHECKSUM_TEXT_BUDGET` row in `tests/runtime-budgets.js`, set from the measured `.text`.

## Stage 2: perf(runtime): a measured verdict on SSSE3 and NEON Adler-32

**Owns:** `bench/adler32*`, `bench/README.md`, `docs/wp38-simd.md`, and, only if a kernel ships, Stage 1's seam files: `runtime/runtime-checksum.c`, `runtime/nish.h`, `src/kernels.ts`, `src/emit.ts`, `src/runtime.ts`, `std/compress/checksum.ts`, `tests/run.js`, `tests/simd/adler32*`, `tests/link/std_compress_adler*/**`, `tests/runtime-budgets.js`, `tests/self/goldens/checked/**`, `.github/workflows/ci.yml`, `docs/guide/using-nish/compression.md`, `docs/security/compress.md`

**Depends on:** Stage 1 merged. It starts after the merge, because it reuses the seam and edits the same files.

### Measure

- Write an SSSE3 kernel (`target("ssse3")`, the `pmaddubsw`/`psadbw` method) and a NEON kernel (baseline on AArch64), both deferring the modulo as `adler32Update` does.
- `bench/adler32.mjs` compares each against the compiled Nish `adler32Update` at 64 KiB and 1 MiB, with a copy column for the noise band.
- Run it in this container and on the `ubuntu-24.04-arm` runner, with a `simd-arm64` step that prints the figures.

### Decide

Ship an architecture's kernel only if it gains **20% or more at both 64 KiB and 1 MiB**, outside the noise band. Record every figure, the band and the verdict in `docs/wp38-simd.md` and `bench/README.md`.

### Ship

- For each architecture that passed, add `nish_adler32_hw` and `NISH_ADLER32=soft` and an `adler32Walk` seam on Stage 1's pattern, with the same test set (paths, differential, counter, triples) and a CI assertion.
- If neither passes, the PR is the record alone, and the bench stays.

## Verification

- **Locally, per stage**:
  - Run the stage's `verification` line.
  - `node tests/self/goldens.js --update`, then read the diff.
  - `npm run sync-main` on a conflict with `main`, including after #1055 lands.
- **The full-suite gate is CI**: every `test (…, shard N/4)` row and `simd-arm64` green on the head, with skip counts read.
