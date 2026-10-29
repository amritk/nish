---
name: Hardware-accelerated SHA-256 — SHA-NI and ARMv8 CE kernels behind a seam, a tuned portable path everywhere else
overview: SHA-256 today is pure Nish (std/crypto/sha256.ts, FIPS 180-4, one `sha256Compress` per 64-byte block); HMAC (std/crypto/hmac.ts) and HS256 reach it only through `Sha256`. Nish compiles for x86_64-linux, aarch64-linux, x86_64-darwin, aarch64-darwin, wasm32-wasi and wasm32-unknown-unknown. This plan copies the WP38 S5 AES seam (src/kernels.ts, runtime/runtime-aes.c, `nish_aes_hw`, `NISH_AES=soft`) for SHA-256: the compiler branches each `sha256Compress` call on `nish_sha256_hw`, which answers once per process, to a C kernel on SHA-NI (x86-64) or the ARMv8 Cryptography Extension (AArch64), compiled with per-function `target(...)` attributes; every other CPU and target runs the Nish code, which stage 1 tunes. No public API changes.
stages:
  - id: portable
    title: "perf(crypto): tune the portable SHA-256 path"
    goal: The Nish SHA-256 that every CPU without the extensions runs is a well-optimised scalar implementation — fully unrolled rounds, round constants in a table or immediates, big-endian loads that lower to one bswap'd load, no per-block allocation — measured against the current code on 64 B, 1 KiB, 1 MiB and HS256 sign+verify
    verification: node tests/run.js crypto_sha256 && node tests/run.js crypto_hmac && npm run check && npm run lint && node bench/crypto/run.mjs --validate && node bench/sha256/run.mjs prints SHA-256 64 B / 1 KiB / 1 MiB and HS256 sign+verify ns/op
    status: pending
    todos:
      - id: portable-audit
        content: Read the -O2 IR/asm of sha256Compress as built today and record in the PR body which of the four properties (unrolled rounds, constant table, bswap loads, no per-call allocation) it already has
        status: pending
      - id: portable-tune
        content: Tune sha256Compress (and the Sha256 update/digest loop and one-shot sha256() only where they allocate per block or per call needlessly) until the -O2 output has all four properties; keep `sha256Compress(h: u32[], w: u32[], src: u8[], at: i32): void` as a private function with exactly this name, signature and meaning, called once per 64-byte block — it is the seam stage 2 replaces
        status: pending
      - id: portable-bench
        content: Add bench/sha256/ (a Nish program plus run.mjs on bench/crypto/run.mjs's interleaved-rounds-with-a-copy-column pattern) timing SHA-256 on 64 B, 1 KiB and 1 MiB inputs and an HS256 sign+verify of a typical JWT (base64url header.payload, nish/crypto/base64url + hmacSha256 / hmacSha256Verify) in ns/op; report before/after in the PR body with the noise band
        status: pending
      - id: portable-vectors
        content: Make sure the NIST vectors (empty, "abc", 448-bit, 896-bit, 1,000,000 x 'a') and RFC 4231 HMAC-SHA256 cases 1-7 are pinned in tests/link (add the missing ones); they run against whatever path the build selects
        status: pending
  - id: hw
    title: "perf(crypto): SHA-256 on SHA-NI and the ARMv8 Cryptography Extension"
    goal: On x86-64 with SHA+SSE4.1+SSSE3 and on AArch64 with SHA2, every sha256Compress call runs a C kernel selected once per process by runtime CPU detection; everything else runs the Nish path; one baseline binary per architecture; NISH_SHA256=soft forces the portable path; every path is tested on CI on x86-64 and ARM64
    verification: node tests/run.js crypto_sha && node tests/run.js crypto_hmac && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint && node scripts/security-scope.mjs
    status: pending
    todos:
      - id: hw-kernel
        content: "Add runtime/runtime-sha256.c on runtime-aes.c's pattern: `nish_sha256_hw()` (cached; x86-64 CPUID leaf 7 EBX.SHA + leaf 1 SSE4.1/SSSE3; Linux AArch64 getauxval(AT_HWCAP) & HWCAP_SHA2; macOS sysctlbyname(\"hw.optional.arm.FEAT_SHA256\"); NISH_SHA256=soft → 0) and `nish_sha256_compress(h, src, at)` using sha256rnds2/msg1/msg2 under __attribute__((target(\"sha,sse4.1,ssse3\"))) and sha256h/h2/su0/su1 under target(\"+sha2\"); other targets compile hw to `return 0` and the kernel to an unreachable trap. Declare both in runtime/nish.h. No -march anywhere"
        status: pending
      - id: hw-seam
        content: "Recognise `sha256Compress` in nish/crypto/sha256 as a seam in src/kernels.ts and lower each call in src/emit.ts to a branch on `nish_sha256_hw` (kernel arm / original call arm), reusing the AES seam lowering rather than copying it; wasm builds emit the call as written and reference no nish_sha256_ symbol. Wire the new runtime file wherever runtime-aes.c is wired (src/runtime.ts, src/run-cache.ts, scripts/build.sh, tests/runtime-budgets.js)"
        status: pending
      - id: hw-optional-simd
        content: "Measure an SSSE3/AVX2 message-schedule C path for x86-64 without SHA-NI against stage 1's tuned scalar path (merge main first if stage 1 has landed). Ship it as a third path, forced by NISH_SHA256=simd, only if it gains >= 20% on 1 KiB and 1 MiB; otherwise record the measurement in the PR body and do not ship it"
        status: pending
      - id: hw-tests
        content: "Tests run against every path the build contains: the NIST and RFC 4231 vectors under the default path and under NISH_SHA256=soft (and =simd if shipped), plus a differential test hashing seeded random inputs of every length 0..4096 that includes every length 0..200 and 4032..4096 (the 55/56/64 boundaries and multi-block tails), streaming with varied split points, comparing digests across all paths; a C-level test of the kernel against the vectors in tests/simd/ like aes-gcm.c; a test proving NISH_SHA256=soft really leaves the kernel unused on a SHA-NI machine"
        status: pending
      - id: hw-ct-and-cross
        content: Add the kernels to tests/ct-asm-runtime.js for both architectures, and check the runtime file compiles with clang --target for every supported triple (x86_64/aarch64 linux and darwin, wasm32-wasi, wasm32-unknown-unknown); a target whose toolchain lacks the intrinsics gets only the portable path at compile time
        status: pending
      - id: hw-ci
        content: Make CI run the SHA-256 path tests on x86-64 (ubuntu-latest), ARM64 Linux (ubuntu-24.04-arm) and Apple Silicon (macos-latest), and run bench/sha256/run.mjs on each runner for each path, printing which path `nish_sha256_hw` selected. Name in the PR body any target CI cannot run (x86-64 without SHA-NI is covered by NISH_SHA256=soft; say how) 
        status: pending
      - id: hw-docs
        content: Security record for runtime-sha256.c under docs/security/ (scope, constant-time argument, what a wipe cannot reach) with its index row; NISH_SHA256 documented wherever NISH_AES is (docs/guide, docs/INSTALL.md, std/README.md); docs/wp38-simd.md row; THIRD_PARTY_NOTICES only if code is copied
        status: pending
---

# Hardware-accelerated SHA-256

## Context

- `std/crypto/sha256.ts`: pure Nish. `sha256Compress(h, w, src, at)` folds one
  64-byte block; `Sha256.update` / `digest` and the one-shot `sha256()` call it.
  Round constants are a `switch` LLVM turns into a table; byte loads are four
  shifts with a bounds check each; the 64 rounds are a loop.
- `std/crypto/hmac.ts` (`hmacSha256`, `HmacSha256`, `hmacSha256Verify`,
  PBKDF2) uses `Sha256` only, so it — and HS256, which is HMAC-SHA256 over
  `base64url(header).base64url(payload)` — inherits any speedup with no API
  change. There is no JWT module; HS256 is benchmarked by composing the two.
- Precedent: WP38 S5's AES seam (`src/kernels.ts` `isAesSeam`,
  `src/emit.ts` `emitAesKernelArm`, `runtime/runtime-aes.c`, `nish_aes_hw`,
  `NISH_AES=soft`, `tests/simd/aes-gcm.c`, `tests/ct-asm-runtime.js`,
  `docs/security/crypto-aead.md`). This plan reuses it rather than inventing a
  second mechanism.
- Targets: x86_64-linux, aarch64-linux, x86_64-darwin, aarch64-darwin (native,
  hardware path possible), wasm32-wasi and wasm32-unknown-unknown (portable
  only, no symbol referenced). CI already has ubuntu-latest (x86-64, SHA-NI on
  current Azure hosts), ubuntu-24.04-arm and macos-latest (Apple Silicon).

## Stage `portable`

**Owns:** `std/crypto/sha256.ts`, `bench/crypto/hash/**`, `bench/sha256/**` (new), `tests/link/crypto_sha256*/**`, `tests/link/crypto_hmac_rfc4231*/**`

The seam contract is frozen: `sha256Compress` keeps its name, signature and
per-block meaning so stage `hw` can be built against `main` in parallel.

## Stage `hw`

**Owns:** `runtime/runtime-sha256.c`, `runtime/nish.h`, `src/kernels.ts`, `src/emit.ts`, `src/runtime.ts`, `src/run-cache.ts`, `scripts/build.sh`, `tests/run.js`, `tests/perf-baseline.json`, `tests/runtime-budgets.js`, `tests/ct-asm-runtime.js`, `tests/simd/sha256*`, `tests/link/sha256_hw_*/**` (new; not `crypto_sha256*`, which stage `portable` owns), `.github/workflows/ci.yml`, `docs/security/**`, `docs/guide/**`, `docs/INSTALL.md`, `docs/wp38-simd.md`, `docs/ARCHITECTURE.md`, `docs/IR_COOKBOOK.md`, `std/README.md`, `scalar.config.json`

Merge-order edge: `portable` → `hw` (so `hw`'s differential and benchmarks
run against the tuned scalar path before it merges). Development is parallel.

## Generated files

`tests/self/goldens/checked/**`, `tests/differential/*known*`, `tests/differential/goldens*` —
regenerated with `node tests/self/goldens.js --update` /
`node tests/differential/goldens.js --update`, never hand-merged.
