---
name: WP41 — a 64×64→128 high product with a wasm fallback
overview: The mulHigh and mulHighIsNative builtins land in PR 1808 (S1), with P-256 and the JSON tokenizer moved onto mulHigh. Two measured stages remain — X25519 on five 51-bit limbs and Poly1305 on 64-bit limbs, each chosen by mulHighIsNative with today's narrow-limb code kept for wasm32 and Node, each landing only if it clears its bar.
priority: 70
labels: [ready]
issue: 2046
stages:
  - id: mul-high
    title: WP41 S1 — the mulHigh and mulHighIsNative builtins, with P-256 and the JSON tokenizer on mulHigh
    goal: mulHigh and mulHighIsNative exist as builtins with a native, wasm32 and TypeScript lowering, and P-256 and the JSON tokenizer call mulHigh in place of their hand-built four-product helpers
    verification: PR 1808 merged with CI green on its head
    status: completed
    todos:
      - id: mul-high-pr
        content: Land the builtins, the P-256 and JSON drop-ins and the design note through PR 1808 — see WP41 S1 — the mulHigh and mulHighIsNative builtins, with P-256 and the JSON tokenizer on mulHigh
        status: completed
  - id: x25519-fe51
    title: WP41 S2 — X25519 on five 51-bit limbs where the wide multiply is native
    goal: std/crypto/x25519.ts gains a five-limb 51-bit field on mulHigh, chosen by mulHighIsNative, with the ten-limb field kept as the wasm32 and Node path, landed only if it clears its bar
    verification: node tests/run.js x25519 && node tests/run.js ct_asm && node tests/run.js secret && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js && npm run check && npm run lint && node scripts/gen-reference.mjs --check && node bench/crypto/run.mjs --only x25519,x25519-base
    issue: 2048
    todos:
      - id: fe51-baseline
        content: Measure x25519 and x25519-base natively and on wasm32 at the base SHA before any change, with the noise band of a byte-identical copy — see WP41 S2 — X25519 on five 51-bit limbs where the wide multiply is native
        status: pending
      - id: fe51-field
        content: Write the 51-bit field (mul, square, carry, reduce, invert) in std/crypto/x25519.ts on mulHigh and select it with mulHighIsNative, keeping Secret and wipe discipline — see WP41 S2 — X25519 on five 51-bit limbs where the wide multiply is native
        status: pending
      - id: fe51-ct
        content: Point the x25519 constant-time disassembly fixtures at the new field and confirm tests/ct-asm.js reads mul, mulx or umulh on secret data as constant time — see WP41 S2 — X25519 on five 51-bit limbs where the wide multiply is native
        status: pending
      - id: fe51-tests
        content: Run the RFC 7748 vectors and the 1000-iteration check on both fields natively, on wasm32 and under Node, plus a test that calls the ten-limb field directly in a native build — see WP41 S2 — X25519 on five 51-bit limbs where the wide multiply is native
        status: pending
      - id: fe51-docs
        content: Record the measurement in docs/BENCHMARKS.md and docs/crypto-performance.md, update docs/security/crypto-ecc.md and the S2 state in docs/wp41-mul-high.md — see WP41 S2 — X25519 on five 51-bit limbs where the wide multiply is native
        status: pending
  - id: poly1305-wide
    title: WP41 S3 — Poly1305 on 64-bit limbs where the wide multiply is native
    goal: Poly1305 in std/crypto/chacha20poly1305.ts gains a 64-bit-limb block function on mulHigh chosen by mulHighIsNative, with the 26-bit limbs kept for wasm32 and Node, landed only if it clears its bar
    verification: node tests/run.js chacha20 && node tests/run.js poly1305 && node tests/run.js ct_asm && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js && npm run check && npm run lint && node scripts/gen-reference.mjs --check && node bench/crypto/run.mjs --only aead
    issue: 2049
    todos:
      - id: poly-baseline
        content: Measure ChaCha20-Poly1305 seal and open natively and on wasm32 at the base SHA, with the noise band of a byte-identical copy — see WP41 S3 — Poly1305 on 64-bit limbs where the wide multiply is native
        status: pending
      - id: poly-block
        content: Write the 44-bit and the full 64-bit radix Poly1305 block and finalize in std/crypto/chacha20poly1305.ts on mulHigh, measure both and keep the faster one that clears the bar, selected by mulHighIsNative — see WP41 S3 — Poly1305 on 64-bit limbs where the wide multiply is native
        status: pending
      - id: poly-ct
        content: Point the chacha20poly1305 constant-time disassembly fixture at the new block function and confirm tests/ct-asm.js reads it as constant time — see WP41 S3 — Poly1305 on 64-bit limbs where the wide multiply is native
        status: pending
      - id: poly-tests
        content: Run the RFC 8439 vectors and the existing AEAD tests on both block functions natively, on wasm32 and under Node — see WP41 S3 — Poly1305 on 64-bit limbs where the wide multiply is native
        status: pending
      - id: poly-docs
        content: Record the measurement in docs/BENCHMARKS.md, docs/crypto-performance.md and the Poly1305 note in docs/wp38-simd.md, update crypto-aead.md, crypto-chacha20-hw.md and the S3 state in docs/wp41-mul-high.md — see WP41 S3 — Poly1305 on 64-bit limbs where the wide multiply is native
        status: pending
---

# WP41: a 64×64→128 high product with a wasm fallback

## Context

- Before WP41, Nish had no 64×64→128 product. std built the high half from four 32×32 products in `p256FiatMulxU64Hi` ([std/crypto/p256.ts](../../std/crypto/p256.ts)) and `jsonTokMulHigh` ([std/json-tokenizer.ts](../../std/json-tokenizer.ts)).
- [docs/crypto-performance.md](../../docs/crypto-performance.md) names the missing product as the larger lever for X25519 (ten 26/25-bit limbs, 100 products per multiply, against fe51's 25) and for Poly1305 ("five 26-bit limbs in `u64`, twenty-five products a block").
- Measured gaps ([docs/BENCHMARKS.md](../../docs/BENCHMARKS.md), Nish 0.42.0): x25519 12.5k op/s, 2.0x behind go-purego and 2.3x behind openssl-portable; ChaCha20-Poly1305 from 1350 B 2.3x to 2.5x behind openssl-portable, "mainly a Poly1305 floor".
- WP41 was first declined in one line on the old roadmap page ("Not built"): Poly1305 on 64-bit limbs measured 14% to 21% faster natively and 19% to 27% slower on wasm32. The wasm loss came from changing the algorithm, not from the product, so std now keeps both algorithms and `mulHighIsNative()`, a compile-time constant, lets the build keep one.
- The `/feature` run that reopened WP41 is tracked in [issue 1804](https://github.com/amritk/nish/issues/1804). Its stage 1 is [PR 1808](https://github.com/amritk/nish/pull/1808).

**Spec:** [docs/wp41-mul-high.md](../../docs/wp41-mul-high.md), "The bars" and "Decisions". It lands on `main` with PR 1808; until then it is on that PR's branch, `feature/wp41-mul-high/mul-high`. The `spec:` frontmatter field is added once PR 1808 merges. The open work is tracked by this plan's issues, not a `docs/roadmap/` page (`main` retired those in #1998), so PR 1808 drops its `docs/roadmap/wp41-mul-high.md` and its `docs/roadmap/index.md` edit when it takes in `main`.

## Approach

The settled decisions are the spec's "Decisions" table. The ones the open stages lean on:

| Decision | Choice |
| --- | --- |
| Product | `mulHigh(a: u64, b: u64): u64`, one `mul`/`mulx` (x86-64) or `umulh` (AArch64) natively, the inline four-product sequence on wasm32, `(a * b) >> 64n` under Node |
| Algorithm fallback | `mulHighIsNative(): boolean`, constant `true` on 64-bit native targets, `false` on wasm32 and under Node; LLVM deletes the path a target does not take |
| Narrow-limb code | stays unchanged in std as the wasm32 and Node path |
| Constant time | `mulHigh` has no data-dependent branch on any lowering; `tests/ct-asm.js` models `mulx` (CT-5) |
| Bars | each std stage has a pre-registered bar; a stage that misses it lands its measurement and no std change, and is marked "measured, not built" |
| Rolling freeze | `src/` may not call `mulHigh` until the next release; std may |

## WP41 S1 — the mulHigh and mulHighIsNative builtins, with P-256 and the JSON tokenizer on mulHigh

Built in [PR 1808](https://github.com/amritk/nish/pull/1808) (`feat(checker): a mulHigh builtin for the 64×64→128 high product`), which is part of [issue 1804](https://github.com/amritk/nish/issues/1804). This stage has no issue of its own: the PR carries it.

What the PR lands: the two builtins with their native, wasm32 and TypeScript lowerings; the operand check (a non-`u64` operand is NL2819, with a `tests/link/mul_high_reject_operand` negative); `p256FiatMulxU64Hi` and `jsonTokMulHigh` replaced by `mulHigh`; the `docs/LANGUAGE.md` rule, IR cookbook entry, guide section and regenerated `docs/reference/`; the ECC-9 row in `docs/security/crypto-ecc.md`; the design note. Its measured result against the S1 bar: P-256 verify 1.330x and sign 1.357x at the minimum, outside the band; JSON tokenize within its band on every case; wasm32 P-256 assembly byte-identical.

S2 and S3 call `mulHigh`, so neither starts until PR 1808 is on `main`.

## WP41 S2 — X25519 on five 51-bit limbs where the wide multiply is native

Spec: [docs/wp41-mul-high.md](../../docs/wp41-mul-high.md), "The bars" (bar 2) and "Decisions". Starts after [PR 1808](https://github.com/amritk/nish/pull/1808) merges: it calls `mulHigh` and `mulHighIsNative`.

**Owns:** `std/crypto/x25519.ts`, `tests/run.js`, `tests/cases/x25519_*`, `tests/cases/ct_asm_x25519*`, `tests/ct-asm.js`, `tests/ct-asm-runtime.js`, `tests/link/**`, `tests/wordings/**`, `tests/self/goldens/**`, `tests/differential/**`, `tests/nish-cmp.js`, `tests/shard-costs.json`, `docs/reference/**`, `docs/security/crypto-ecc.md`, `docs/security/ct-verification.md`, `docs/security/README.md`, `docs/BENCHMARKS.md`, `docs/crypto-performance.md`, `docs/wp41-mul-high.md`, `bench/**`

### The field

- Five 51-bit limbs in `u64`. Each limb product is a (high, low) pair: `mulHigh(a, b)` and the wrapping low product `a * b`. Column sums accumulate as pairs, are carried at 51 bits, and the top is reduced by 19.
- `mul`, `square`, carry, reduce and invert on the new field; `x25519`, `x25519Base` and the ladder call it when `mulHighIsNative()` and the ten-limb field otherwise. The ten-limb code is unchanged.
- The private scalar stays a `Secret`, computed inside `expose`, and every new intermediate is wiped before return (CLAUDE.md → Security).

### Constant time

The x25519 disassembly fixture `tests/run.js` reads (`tests/cases/ct_asm_x25519.ts`) must cover the 51-bit field. A `mul`, `mulx` or `umulh` on secret data must be read as constant time (CT-5 already models `mulx`). Limb carries are a shift and a mask. A 128-bit column sum's low-half carry, which Nish has no add-with-carry builtin for, comes from a branch-free compare (`lo < addend`); the fixture must show it lowers to `setb`/`adc` or `cset`, never a branch. No branch on a limb anywhere.

### Bar

Measured interleaved at the base SHA and the head on one machine, with the noise band of a byte-identical copy of the base:

- x25519 op/s natively at least **1.4x** the base at the minimum, beyond the band, in two runs.
- wasm32 x25519 not slower outside its band.

Missed → no std change lands. The PR records the measurement in `docs/BENCHMARKS.md`, marks S2 "measured, not built" in `docs/wp41-mul-high.md`, and still closes this issue: the measured verdict is the deliverable.

### Tests

RFC 7748 §5.2 vectors and the 1,000-iteration check on both fields, natively, on wasm32 and under Node. A test that calls the ten-limb field directly in a native build, so it stays checked where it is not selected. Existing x25519, TLS and `secret` tests pass unchanged.

### Docs

`docs/BENCHMARKS.md` rows naming their commit; `docs/crypto-performance.md`'s X25519 section; `docs/security/crypto-ecc.md` scope and findings (and its row in `docs/security/README.md` if counts change); the S2 state in `docs/wp41-mul-high.md`. The PR's `Measured:` trailer states the figures and band.

## WP41 S3 — Poly1305 on 64-bit limbs where the wide multiply is native

Spec: [docs/wp41-mul-high.md](../../docs/wp41-mul-high.md), "The bars" (bar 3) and "Decisions". Starts after S2 merges: it shares `tests/nish-cmp.js`, `docs/BENCHMARKS.md`, `tests/ct-asm.js` and the WP41 design note, and repeats S2's arrangement.

**Owns:** `std/crypto/chacha20poly1305.ts`, `tests/run.js`, `tests/cases/chacha*`, `tests/cases/poly1305*`, `tests/cases/ct_asm_chacha20poly1305*`, `tests/ct-asm.js`, `tests/link/**`, `tests/wordings/**`, `tests/self/goldens/**`, `tests/differential/**`, `tests/nish-cmp.js`, `tests/shard-costs.json`, `docs/reference/**`, `docs/security/crypto-aead.md`, `docs/security/crypto-chacha20-hw.md`, `docs/security/ct-verification.md`, `docs/security/README.md`, `docs/BENCHMARKS.md`, `docs/crypto-performance.md`, `docs/wp38-simd.md`, `docs/wp41-mul-high.md`, `bench/**`

### The block function

- Poly1305's accumulator and `r` in 64-bit limbs, products through `mulHigh`, selected by `mulHighIsNative()`. The five 26-bit limbs stay as the wasm32 and Node path, unchanged.
- The radix is measured, not assumed: see "Radix (decided)" below.
- The ChaCha20 runtime kernel (`runtime/runtime-chacha20.c`) and its seam are untouched.

### Radix (decided)

Both radixes sum (high, low) product pairs, and Nish has no add-with-carry builtin, so each 128-bit column sum takes its low-half carry from a branch-free compare (`lo < addend`). The two candidates:

- **44-bit radix, three limbs** (the poly1305-donna-64 layout): nine products a block, products below 2^93, limb carries by shift and mask, lazy reduction, a short carry chain.
- **Full 64-bit radix, two limbs plus two bits** (the OpenSSL 64-bit layout): fewer full-width products, a longer serial chain of compare-derived carries.

**Decision (owner, 2026-11-20): the worker's measured choice.** Build both behind `mulHighIsNative()`, measure each against the base with the bar below, and keep the faster one that clears it; the other is deleted before the PR is merged, and its figures go into the PR's `Measured:` trailer and `docs/BENCHMARKS.md`. Both must be branch-free on limb data and pass the RFC 8439 vectors before either is timed.

### Bar

Measured interleaved at the base SHA and the head on one machine, with the noise band of a byte-identical copy of the base:

- ChaCha20-Poly1305 seal at 16 KiB and 1 MiB natively at least **10% faster** than the base at the minimum, beyond the band, in two runs (WP41's first measurement found 14% to 21% on Poly1305 alone).
- wasm32 not slower outside its band.

Missed → no std change lands. The PR records the measurement in `docs/BENCHMARKS.md`, marks S3 "measured, not built" in `docs/wp41-mul-high.md`, and still closes this issue.

### Tests

RFC 8439 §2.5.2 and §2.8.2 vectors and the existing AEAD tests on both block functions, natively, on wasm32 and under Node. The `ct_asm_chacha20poly1305` fixture covers the new block function.

### Docs

`docs/BENCHMARKS.md` rows naming their commit; `docs/crypto-performance.md`'s ChaCha20-Poly1305 section; the Poly1305 note in `docs/wp38-simd.md`; `docs/security/crypto-aead.md` and `docs/security/crypto-chacha20-hw.md` (and their rows in `docs/security/README.md`); the S3 state in `docs/wp41-mul-high.md`.

## Out of scope

- A 128-bit integer type, or a `mulWide` returning both halves.
- A signed high product.
- A `mulx`-only lowering behind a CPU flag.
- `src/` calling `mulHigh` (the rolling freeze).
- Ed25519, P-384, RSA, SHA-512 and AES-GCM.
- Any `.github/workflows/**` change.

## Verification

Each stage's `verification` line, plus: `node tests/self/goldens.js --update` with the diff read; `node tests/differential/goldens.js --update` for new positive cases; `std/` line pins regenerated (`grep std/<file>.ts:[0-9]` across `tests/link/*/expected.caps.json`, `tests/wordings/*.err` and `docs/reference/diagnostics/`); narrow `DECLARED` entries in `tests/nish-cmp.js` for any corpus program whose IR moves; `npm run lint:dead` and `node docs/check-links.mjs`; CI's nine `test` shards, `lint`, `bootstrap` and `nish-cmp` green on the head. Each bar is measured with the repo's interleaved method and stated in a `Measured:` trailer.
