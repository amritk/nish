---
name: WP41 reopened — a 64×64→128 high product with a wasm fallback
overview: Add a mulHigh(a, b) builtin over u64 that lowers to one hardware multiply on 64-bit targets and to today's four-product sequence on wasm32, plus a compile-time mulHighIsNative() so std keeps its narrow-limb code on wasm and Node. Then measure and, where the bar clears, move P-256, X25519 and Poly1305 onto it.
stages:
  - id: mul-high
    title: "feat(checker): a mulHigh builtin for the 64×64→128 high product"
    goal: mulHigh and mulHighIsNative exist as builtins with a native, wasm32 and TypeScript lowering, and P-256 and the JSON tokenizer use mulHigh in place of their hand-built four-product helpers
    verification: node tests/run.js mul_high && node tests/run.js p256 && node tests/run.js json && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/run.js self && node tests/nish-cmp.js && npm run check && npm run lint && npm run lint:dead && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs
    todos:
      - id: wp41-record
        content: Write docs/wp41-mul-high.md and docs/roadmap/wp41-mul-high.md and move WP41 out of the Not-built list in docs/roadmap/index.md — see Stage 1, Design record
      - id: builtin-check
        content: Add mulHigh and mulHighIsNative to src/builtins.ts and runtime/nish.d.ts beside ctSelect, u64 operands only, with a coded refusal for any other type — see Stage 1, The builtins
      - id: builtin-lower
        content: Lower mulHigh in src/emit-builtins.ts to a zext/mul i128/lshr on 64-bit targets and to the four 32×32 product sequence on wasm32, and mulHighIsNative to a constant i1 — see Stage 1, Lowering
      - id: builtin-ts
        content: Give both their TypeScript reading in runtime/nish.mjs (BigInt product shifted by 64, and false) and src/emit-ts — see Stage 1, TypeScript reading
      - id: drop-ins
        content: Replace p256FiatMulxU64Hi in std/crypto/p256.ts and jsonTokMulHigh in std/json-tokenizer.ts with mulHigh, measured against the Stage 1 bar — see Stage 1, Drop-ins and their bar
      - id: mul-high-tests
        content: Add tests/cases/mul_high_* goldens for x86-64, aarch64 and wasm32 with llvm-as and native round trips, a tests/link negative, an emit-ts fixture, regenerate goldens and pins, add nish-cmp DECLARED — see Tests
      - id: mul-high-docs
        content: Add the LANGUAGE.md rule, IR cookbook entry, guide section, BENCHMARKS.md rows with their commit, and update crypto-ecc.md and json.md — see Stage 1, Docs
  - id: x25519-fe51
    title: "perf(interop): X25519 on 51-bit limbs where the wide multiply is native"
    goal: std/crypto/x25519.ts gains a five-limb 51-bit field on mulHigh, chosen by mulHighIsNative, with the ten-limb field kept as the wasm32 and Node path, landed only if it clears its bar
    verification: node tests/run.js x25519 && node tests/run.js ct_asm && node tests/run.js secret && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js && npm run check && npm run lint && node scripts/gen-reference.mjs --check && node bench/crypto/run.mjs --only x25519,x25519-base
    todos:
      - id: fe51-baseline
        content: Measure x25519 and x25519-base natively and on wasm32 at the base SHA before any change, recording the noise band — see Stage 2, Bar
      - id: fe51-field
        content: Write the 51-bit field (mul, square, carry, reduce, invert) in std/crypto/x25519.ts on mulHigh and select it with mulHighIsNative, keeping Secret and wipe discipline — see Stage 2, The field
      - id: fe51-ct
        content: Re-point the x25519 constant-time disassembly fixtures at the new field and confirm tests/ct-asm.js reads mul or mulx as constant time — see Stage 2, Constant time
      - id: fe51-tests
        content: Run RFC 7748 vectors and the iterated 1000 check on both fields natively, on wasm32 and under Node, and a test that calls each field directly so both stay checked — see Tests
      - id: fe51-docs
        content: Record the measurement in BENCHMARKS.md and crypto-performance.md, update crypto-ecc.md, tick WP41 S2 — see Stage 2, Docs
  - id: poly1305-wide
    title: "perf(interop): Poly1305 on 64-bit limbs where the wide multiply is native"
    goal: Poly1305 in std/crypto/chacha20poly1305.ts gains a 64-bit-limb block function on mulHigh chosen by mulHighIsNative, with the 26-bit limbs kept for wasm32 and Node, landed only if it clears its bar
    verification: node tests/run.js chacha20 && node tests/run.js poly1305 && node tests/run.js ct_asm && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js && npm run check && npm run lint && node scripts/gen-reference.mjs --check && node bench/crypto/run.mjs --only aead
    todos:
      - id: poly-baseline
        content: Measure ChaCha20-Poly1305 seal and open natively and on wasm32 at the base SHA, recording the noise band — see Stage 3, Bar
      - id: poly-block
        content: Write the 64-bit-limb Poly1305 block and finalize in std/crypto/chacha20poly1305.ts on mulHigh, selected by mulHighIsNative — see Stage 3, The block function
      - id: poly-tests
        content: Run RFC 8439 vectors and the existing AEAD tests on both paths natively, on wasm32 and under Node — see Tests
      - id: poly-docs
        content: Record the measurement in BENCHMARKS.md, crypto-performance.md and wp38-simd.md's Poly1305 note, update crypto-aead.md and crypto-chacha20-hw.md, tick WP41 S3 — see Stage 3, Docs
---

# WP41 reopened: a 64×64→128 high product with a wasm fallback

## Context

- Nish has no 64×64→128 product. std builds the high half from four 32×32 products in two places: `p256FiatMulxU64Hi` ([std/crypto/p256.ts](std/crypto/p256.ts):240) and `jsonTokMulHigh` ([std/json-tokenizer.ts](std/json-tokenizer.ts):1815).
- [docs/crypto-performance.md](docs/crypto-performance.md) names the missing product as the larger lever for X25519 (ten 26/25-bit limbs, 100 products per multiply, against fe51's 25) and Poly1305.
- Measured gaps ([docs/BENCHMARKS.md](docs/BENCHMARKS.md), Nish 0.42.0): x25519 12.5k op/s, 2.0x behind go-purego and 2.3x behind openssl-portable; p256 verify 2.3x behind go-purego; ChaCha20-Poly1305 from 1350 B 2.3x to 2.5x behind openssl-portable, "mainly a Poly1305 floor".
- WP41 was declined in one line ([docs/roadmap/index.md](docs/roadmap/index.md) "Not built"): measured on Poly1305, 14% to 21% faster natively, 19% to 27% slower on wasm32. It has no design note. [docs/wp38-simd.md](docs/wp38-simd.md) (S6b) says a `mulHigh` builtin is "a separate, measured change".

## Approach

| Decision | Choice | Why |
| --- | --- | --- |
| Surface | a global builtin `mulHigh(a: u64, b: u64): u64`, declared beside `ctSelect` in [runtime/nish.d.ts](runtime/nish.d.ts) | Same precedent as `ctSelect`/`ctEq`: a pure function on `u64`, no import; LLVM needs no target intrinsic for it |
| Native lowering | `zext` both to `i128`, `mul`, `lshr 64`, `trunc` | Portable IR; LLVM picks `mul` (baseline x86-64), `mulx` (when BMI2 is allowed) or `umulh` (AArch64) itself |
| wasm32 lowering | the four 32×32→64 product sequence std writes by hand today, emitted inline, no `i128` and no `__multi3` | wasm has no wide multiply; inline keeps wasm exactly as fast as today's helpers and links no compiler-rt |
| Algorithm fallback | a second builtin `mulHighIsNative(): boolean`, a constant `true` on 64-bit native targets and `false` on wasm32 and under Node | WP41's wasm loss came from changing the algorithm (wider limbs), not from the product; std keeps both algorithms and the build keeps one. A constant `i1` lets LLVM delete the unused path |
| TypeScript reading | `mulHigh` is `(a * b) >> 64n` over the BigInt that `runtime/nish.mjs` uses for `u64`; `mulHighIsNative` is `false` | Class A: exact answers; Node keeps running today's narrow-limb code |
| Constant time | `mulHigh` has no data-dependent branch on any lowering; x86 `mul`/`mulx` and AArch64 `umulh` are constant time on the CPUs the CT checker models | Recorded in each touched security record; tests/ct-asm.js already models `mulx` (CT-5) |
| Measured bars | each std stage has a pre-registered bar; a stage that misses its bar lands its measurement and no std change | The repo's rule since WP38: nothing ships on a hunch |
| Rolling freeze | `src/` may not call `mulHigh` until the next release; std may use it in the same PR | CLAUDE.md |

## Stage 1: mul-high

**Owns:** `src/**`, `runtime/nish.d.ts`, `runtime/nish.mjs`, `runtime/core.mjs`, `runtime/core.d.ts`, `runtime/shim.mjs`, `std/crypto/p256.ts`, `std/json-tokenizer.ts`, `tests/run.js`, `tests/cases/mul_high_*`, `tests/link/**`, `tests/wordings/**`, `tests/emit-ts/**`, `tests/differential/**`, `tests/self/goldens/**`, `tests/nish-cmp.js`, `tests/shard-costs.json`, `tests/diagnostic-coverage.js`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `docs/guide/**`, `scalar.config.json`, `docs/reference/**`, `docs/security/crypto-ecc.md`, `docs/security/json.md`, `docs/security/README.md`, `docs/wp41-mul-high.md`, `docs/roadmap/wp41-mul-high.md`, `docs/roadmap/index.md`, `docs/BENCHMARKS.md`, `docs/crypto-performance.md`, `bench/**`, `docs/AI.md`, `llms.txt`

### Design record

`docs/wp41-mul-high.md`: the Approach table as decisions, the original Poly1305 measurement and why the fallback answers it, and the three bars. `docs/roadmap/wp41-mul-high.md`: S1 to S3, each ticked by the PR that lands it (or marked "measured, not built"). `docs/roadmap/index.md`: WP41 leaves "Not built" and gets a table row.

### The builtins

```ts
declare function mulHigh(a: u64, b: u64): u64;     // high 64 bits of the 128-bit product
declare function mulHighIsNative(): boolean;       // true where mulHigh is one instruction
```

Arguments other than `u64` (including an unsuffixed literal that does not fit or a `number`) are refused with a new code in [src/codes.ts](src/codes.ts) (next free number in its band) and a `tests/link/mul_high_*` negative. `CAP_NONE` in [src/capabilities.ts](src/capabilities.ts). Not a panic site.

### Lowering

- x86-64 and AArch64, Linux and macOS: the `i128` sequence. A golden `.ll` per target and an `llc` check that x86-64 emits one `mul` (no call) and AArch64 one `umulh`.
- wasm32-unknown-unknown and wasm32-wasi: the inline four-product sequence, in the same order `p256FiatMulxU64Hi` uses, so a wasm build of P-256 computes the same operations it does today.
- `mulHighIsNative()`: `i1 true` / `i1 false` by target. `src/attributes.ts` needs no new attribute; say so.

### TypeScript reading

`runtime/nish.mjs` installs `mulHigh` and `mulHighIsNative` as the prelude does for `ctSelect`; `--emit-ts` writes the call through. `runtime/nish.d.ts` entries get doc comments, `@param`, `@returns`.

### Drop-ins and their bar

`p256FiatMulxU64Hi` and `jsonTokMulHigh` become `mulHigh` calls (or are deleted for direct calls). **Bar**, measured interleaved at the base SHA and the head on one machine: p256 verify and sign op/s natively at least 1.15x faster at the minimum, beyond the band of a byte-identical copy; canada.json tokenize not slower outside its band; every wasm32 p256 workload not slower outside its band. A missed bar keeps the builtin and drops the drop-in that missed, with the measurement recorded.

### Docs

`docs/LANGUAGE.md` rule (with the TS reading and the wasm lowering) citing its tests; a cookbook snippet with the exact IR on x86-64 and wasm32; a section on the guide's numbers or arithmetic page; BENCHMARKS.md rows naming the commit; `crypto-ecc.md` and `json.md` note the changed helper and its constant-time argument.

## Stage 2: x25519-fe51

Starts after Stage 1 merges (it calls `mulHigh`).

**Owns:** `std/crypto/x25519.ts`, `tests/run.js`, `tests/cases/x25519_*`, `tests/ct-asm.js`, `tests/ct-asm-runtime.js`, `tests/link/**`, `tests/wordings/**`, `tests/self/goldens/**`, `tests/differential/**`, `tests/nish-cmp.js`, `tests/shard-costs.json`, `docs/reference/**`, `docs/security/crypto-ecc.md`, `docs/security/ct-verification.md`, `docs/security/README.md`, `docs/BENCHMARKS.md`, `docs/crypto-performance.md`, `docs/roadmap/wp41-mul-high.md`, `docs/roadmap/index.md`, `docs/wp41-mul-high.md`, `bench/**`

### The field

Five 51-bit limbs in `u64`, products accumulated as (high, low) pairs from `mulHigh` and the wrapping low product, carried at 51 bits, reduced by 19. `x25519`, `x25519Base` and the ladder call the 51-bit field when `mulHighIsNative()` and the ten-limb field otherwise; the ten-limb code is unchanged. The private scalar stays a `Secret`, computed inside `expose`, and every new intermediate is wiped before return.

### Constant time

The x25519 disassembly fixtures `tests/run.js` reads must cover the 51-bit field; a `mul`/`mulx`/`umulh` on secret data must be read as constant time (CT-5 already models `mulx`).

### Bar

x25519 op/s natively at least 1.4x the base SHA at the minimum, beyond the noise band of a byte-identical copy, in two runs; wasm32 x25519 not slower outside its band. Missed → no std change lands; the measurement is recorded and S2 marked measured, not built.

### Docs

BENCHMARKS.md rows with the commit, crypto-performance.md's X25519 section updated, crypto-ecc.md scope and findings, WP41 S2 ticked.

## Stage 3: poly1305-wide

Starts after Stage 2 merges (shares `tests/nish-cmp.js`, `docs/BENCHMARKS.md` and the WP41 pages).

**Owns:** `std/crypto/chacha20poly1305.ts`, `tests/run.js`, `tests/cases/chacha*`, `tests/cases/poly1305*`, `tests/ct-asm.js`, `tests/link/**`, `tests/wordings/**`, `tests/self/goldens/**`, `tests/differential/**`, `tests/nish-cmp.js`, `tests/shard-costs.json`, `docs/reference/**`, `docs/security/crypto-aead.md`, `docs/security/crypto-chacha20-hw.md`, `docs/security/ct-verification.md`, `docs/security/README.md`, `docs/BENCHMARKS.md`, `docs/crypto-performance.md`, `docs/wp38-simd.md`, `docs/roadmap/wp41-mul-high.md`, `docs/roadmap/index.md`, `docs/wp41-mul-high.md`, `bench/**`

### The block function

Poly1305's accumulator and `r` in 64-bit limbs (the 44-bit or 64-bit radix, the worker's measured choice), products via `mulHigh`, selected by `mulHighIsNative()`; the 26-bit code stays as the wasm32 and Node path. The ChaCha20 runtime kernel and its seam are untouched.

### Bar

ChaCha20-Poly1305 seal at 16 KiB and 1 MiB natively at least 10% faster than the base SHA at the minimum, beyond the band, in two runs (WP41 measured 14% to 21% on Poly1305 alone); wasm32 not slower outside its band. Missed → measurement recorded, no std change.

### Docs

BENCHMARKS.md, crypto-performance.md, the Poly1305 note in wp38-simd.md, crypto-aead.md and crypto-chacha20-hw.md, WP41 S3 ticked.

## Tests

- Stage 1: `tests/cases/mul_high_basic` (golden `.ll`, `llvm-as`, native round trip printing high products for 0, 1, 2^32, 2^64-1 pairs and 10^6 seeded random pairs checked against a BigInt reference), the same program built for wasm32-wasi with the same stdout and no `__multi3`, an aarch64 `--target` golden, an `--emit-ts` fixture agreeing under Node, `mulHighIsNative` printing true/false per target, and the `tests/link` negative. Existing p256 and JSON number tests pass unchanged.
- Stage 2: RFC 7748 §5.2 vectors and the 1,000-iteration check on both fields, natively, on wasm32 and under Node; a test that calls the ten-limb field directly in a native build so it stays checked where it is not selected.
- Stage 3: RFC 8439 §2.5.2 and §2.8.2 vectors and the existing AEAD tests on both block functions, natively, on wasm32 and under Node.

## Out of scope

- Ed25519 (its own field and its algorithmic gaps), P-384 and RSA (no hand-built high product today), SHA-512, AES-GCM small messages.
- A 128-bit integer type, or a `mulWide` returning both halves.
- `src/` calling `mulHigh` (rolling freeze).
- Any `.github/workflows/**` change.

## Verification

Each stage's `verification` line, `node tests/self/goldens.js --update` with the diff read, `node tests/differential/goldens.js --update` for new positive cases, `std/` line pins regenerated (`grep std/<file>.ts:[0-9]`), and CI's nine `test` shards, `lint`, `bootstrap`, `nish-cmp` green on the head. Each bar is measured with the repo's interleaved method and stated in a `Measured:` trailer.
