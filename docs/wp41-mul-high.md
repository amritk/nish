# WP41: a 64×64→128 high product with a wasm fallback

Nish has no 64×64→128 product. Before this package, std built the high half
of a `u64` product from four 32×32 products in two places:
`p256FiatMulxU64Hi` in `std/crypto/p256.ts` and `jsonTokMulHigh` in
`std/json-tokenizer.ts`. `docs/crypto-performance.md` names the missing
product as the larger lever for X25519 (ten 26/25-bit limbs and 100 products
per multiply, against fe51's 25) and for Poly1305.

State and stages: the parent issue
[#2046](https://github.com/amritk/nish/issues/2046), specified by
`.claude/plans/wp41-mul-high.plan.md`.

## The first measurement, and why it was declined

WP41 was first measured on Poly1305 with 64-bit limbs over a wide multiply. It
was 14% to 21% faster natively and 19% to 27% slower on wasm32, so it was
declined, and the roadmap recorded it in one line under "Not built".

The wasm32 loss came from changing the algorithm, not from the product. Wider
limbs halve the number of products only when the product is one instruction.
On wasm32, where it is four, the wider limbs cost more than the 26-bit
schedule they replace. The answer is to keep both algorithms in std and let
the build keep one. `mulHighIsNative()` is a compile-time constant, so LLVM
deletes the path a target does not take.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Surface | A global builtin `mulHigh(a: u64, b: u64): u64`, declared beside `ctSelect` in `runtime/nish.d.ts` | It follows the `ctSelect`/`ctEq` precedent: a pure function on `u64` with no import. LLVM needs no target intrinsic for it |
| Operands | `u64` only; anything else is NL2823 | The high half is defined for one width. A `u32` caller widens with `toU64` and says so |
| Native lowering | `zext` both operands to `i128`, then `mul`, `lshr 64` and `trunc` | This is portable IR. LLVM picks `mul` (baseline x86-64), `mulx` (where BMI2 is allowed) or `umulh` (AArch64) itself |
| wasm32 lowering | The four 32×32→64 product sequence std wrote by hand, emitted inline, with no `i128` and no `__multi3` | wasm has no wide multiply. Emitting it inline keeps wasm exactly as fast as the old helpers and links no compiler-rt |
| Algorithm fallback | A second builtin, `mulHighIsNative(): boolean`. It is a constant `true` on 64-bit native targets, and `false` on wasm32 and under Node | std keeps both algorithms and the build keeps one. A constant `i1` lets LLVM delete the unused path |
| TypeScript reading | `mulHigh` is `(a * b) >> 64n` over the BigInt that `runtime/nish.mjs` uses for `u64`, and `mulHighIsNative` is `false` | The answers are exact, and Node keeps running the narrow-limb code |
| Attributes | No new attribute in `src/attributes.ts` | The call is not a panic site, holds no index, and reads no memory |
| Capability | `CAP_NONE` | It touches nothing outside its operands |
| Constant time | `mulHigh` has no data-dependent branch on any lowering. x86 `mul`/`mulx` and AArch64 `umulh` are constant time on the CPUs the CT checker models | This is recorded in each security record a drop-in touches. `tests/ct-asm.js` already models `mulx` (CT-5) |
| Measured bars | Each std stage has a pre-registered bar. A stage that misses its bar lands its measurement and no std change | This has been the repo's rule since WP38: nothing ships on a hunch |
| Rolling freeze | `src/` may not call `mulHigh` until the next release, but std may use it in the same PR | CLAUDE.md |

## The bars

Each bar is measured interleaved, at the base SHA and at the head, on one
machine. "Beyond the band" means outside the spread that a byte-identical copy
of the base shows on the same run.

1. **S1 drop-ins (P-256, JSON tokenizer).**
   - P-256 verify and sign op/s natively at least 1.15x the base at the
     minimum, beyond the band.
   - canada.json tokenize not slower outside its band.
   - No wasm32 P-256 workload slower outside its band.

   A missed bar keeps the builtin and drops the drop-in that missed, with the
   measurement recorded.
2. **S2 X25519 fe51.**
   - x25519 op/s natively at least 1.4x the base at the minimum, beyond the
     band, in two runs.
   - wasm32 x25519 not slower outside its band.
3. **S3 Poly1305 on 64-bit limbs.**
   - ChaCha20-Poly1305 seal at 16 KiB and 1 MiB natively at least 10% faster
     than the base at the minimum, beyond the band, in two runs.
   - wasm32 not slower outside its band.

For S2 and S3, a missed bar lands no std change: the measurement is recorded
and the stage is marked "measured, not built".
