# WP38: SIMD

**State:** Landed · **Done:** 10 of 10 · **Design note:** [`docs/wp38-simd.md`](https://github.com/amritk/nish/blob/main/docs/wp38-simd.md)

## Stages

- [x] S0: the baselines ([#517](https://github.com/amritk/nish/pull/517))
- [x] S1: the `indexOfAny` kernel and its `std/text` surface
- [x] S2: `--cpu x86-64-v3` ([#660](https://github.com/amritk/nish/pull/660))
- [x] S3a and S3: the bar kernels measured, then `nish:simd` with its bar met ([#1064](https://github.com/amritk/nish/issues/1064))
- [x] S5: AES-GCM on AES-NI and PMULL
- [x] S6a and S6b: byte-run kernels for JSON and Eisel–Lemire in `numberF64`
- [x] S7: crediting an offset index from the test that bounds it
- [x] S9 and S10: SHA-256 on SHA-NI and ARMv8, ChaCha20 on AVX2 and NEON; CRC-32 on the same seam
- [x] S8: the SSSE3 and NEON Adler-32 kernels, measured past their bar ([#1079](https://github.com/amritk/nish/issues/1079))
- [x] `--cpu` levels for AArch64 and `x86-64-v4`, each on its own measurement: measured, not built ([#1432](https://github.com/amritk/nish/pull/1432))

## Next

Nothing is scheduled. Whether `--cpu` takes `x86-64-v4` is pending the owner's decision: it clears S2's bar against the baseline but gains nothing over `x86-64-v3` ([§7](https://github.com/amritk/nish/blob/main/docs/wp38-simd.md#7-stages-and-the-bar-each-must-clear)).

## Not planned

The lexer on `indexOfAny` (S4), the structural index (S6c) and per-value cuts (S6d), both measured out of reach, target intrinsics.

[All work packages](index.md)
