/**
 * `nish/crypto/p256` — ECDSA over NIST P-256 (secp256r1), with the
 * deterministic nonces of RFC 6979.
 *
 *     import { p256PublicKey, p256SignSha256, p256VerifySha256 } from "nish/crypto/p256";
 *     import { Secret, secret, wipe } from "nish:secret";
 *
 *     const raw: u8[] = new Array<u8>(32)
 *     crypto.getRandomValues(raw)                              // in [1, n) but for about one draw in 2^32
 *     const priv: Secret<u8[]> = secret(raw)
 *     const message: u8[] = [104, 105]
 *     const pub: u8[] | null = p256PublicKey(priv)             // 65 bytes, 0x04 || X || Y
 *     const sig: u8[] | null = p256SignSha256(priv, message)   // 64 bytes, r || s
 *     wipe(priv)
 *     if (pub !== null && sig !== null) {
 *       p256VerifySha256(pub, message, sig)                    // true
 *     }
 *
 * A private key is 32 big-endian bytes holding a scalar in [1, n); a public
 * key is the uncompressed SEC1 encoding of SEC 1 §2.3.3; a signature is `r`
 * and `s` as 32 big-endian bytes each. DER, which X.509 and TLS wrap a
 * signature in, is not this module's business. Anything of the wrong length,
 * a private key of 0 or n or more, a public key that is not on the curve, and
 * an `r` or `s` of 0 or n or more answer `null` from the signing side and
 * `false` from the verifying side, never a panic.
 *
 * Ported from fiat-crypto (https://github.com/mit-plv/fiat-crypto), fiat-c/src/p256_32.c and fiat-c/src/p256_scalar_32.c. Copyright (c) 2015-2020 the fiat-crypto authors (see the AUTHORS file). Used under the MIT licence; see std/crypto/LICENSE-fiat-crypto.
 *
 * Ported from libsecp256k1 (https://github.com/bitcoin-core/secp256k1), src/modinv32_impl.h. Copyright (c) 2020 Peter Dettman. Used under the MIT licence; see std/crypto/LICENSE-libsecp256k1.
 *
 * **What is ported and what is not.** The `p256Fiat*` functions are
 * fiat-crypto's generated, formally verified Montgomery arithmetic on eight
 * `u32` limbs with `u64` products — `mul`, `square`, `add`, `sub`, `selectznz`,
 * `nonzero` and `set_one` mod p, and `mul`, `add` and `set_one` mod n —
 * statement for statement, with fiat's variable names. Three things change in
 * the translation and nothing else does.
 *
 *  C's out-pointers become a `u64` answer: each of fiat's `addcarryx`,
 *  `subborrowx` and `mulx` helpers here answers its two outputs packed, the
 *  first in the low 32 bits and the second above them, and the caller splits
 *  them, declaring only the halves fiat goes on to read. And each function opens
 *  with a length guard, so that the literal indices after it compile with no
 *  bounds check.
 *
 *  And `square` reads its input's eight limbs into locals first, which changes
 *  no arithmetic; it kept the input's pointer from being spilled in a way the
 *  aarch64 disassembly check once misread (#334). The scalar functions use the
 *  field's four helpers, which fiat generates identically for both. The scalar
 *  inverse, `p256ScalarInverse`, and the field's, `p256FieldInvert`, are
 *  libsecp256k1's 32-bit safegcd (`modinv32`), function for function; the
 *  section that holds it says what changes. Everything else in this file — the
 *  curve, the encodings, the comb and ECDSA — is written for
 *  this module from the documents it names.
 *
 * **The curve** is `y^2 = x^3 - 3x + b` over GF(p),
 * p = 2^256 - 2^224 + 2^192 + 2^96 - 1, with the base point G and its order n from SEC 2 §2.4.2 (FIPS
 * 186-4 §D.1.2.3).
 *
 * Points are projective (X : Y : Z), Z = 0 the identity, and
 * are added and doubled with the complete formulas of J. Renes, C. Costello and
 * L. Batina, "Complete addition formulas for prime order elliptic curves"
 * (EUROCRYPT 2016), Algorithms 4 and 6 for a = -3. Complete means no input is
 * exceptional: P + P, P + (-P) and P + O all come out of the same straight line
 * of field operations, so there is no case to branch on.
 *
 * **Constant time where a secret is involved.** A private key and a nonce are
 * only ever multiplied by G, and that by `p256BaseMult`, a signed
 * all-bits-set comb (Hamburg, "Fast and compact elliptic-curve
 * cryptography", 2012) over a precomputed table: 11 combs of 6 teeth 4 bits
 * apart, 32 entries each, every entry the top tooth plus or minus each of the
 * five below it, as affine points in the Montgomery domain (`p256BaseTable`,
 * 22 KiB, written by `scripts/gen-p256-table.mjs`; ECC-7). The scalar is
 * recoded to m = (k + 2^264 - 1) / 2 mod n, so that every bit of m stands for
 * plus or minus its power of two; four rows of 11 mixed additions with a
 * doubling between rows replace the 256 doublings and 64 additions of a
 * window, whatever the scalar.
 *
 *  Every digit names an entry, none of them the identity, so every addition is
 *  kept. Each addition reads all 32 entries of its comb and keeps one by an
 *  all-ones mask from `ctEq` on the digit's low five bits (flipped when the top
 *  tooth is clear), ORing every entry's limbs under its mask, and negates its Y
 *  by fiat's conditional move on the top tooth, so neither a branch nor an
 *  address depends on the scalar.
 *  `p256ScalarMult`, a fixed 4-bit window over sixteen multiples of a point, is
 *  what ECDH multiplies the peer's key by, and the reference the comb is held
 *  to bit for bit (`tests/link/crypto_p256_agree`).
 *
 *  The signer inverts the nonce by Bernstein and Yang's safegcd,
 *  `p256ScalarInverse`: twenty batches of thirty divsteps, each a fixed run of
 *  masks and adds, whatever the scalar, so its loops count constants and no
 *  branch or address follows the nonce. Verification inverts its public s with
 *  the same function: a variable-time twin could stop once g is zero, but it
 *  would save at most the constant-time one's 33,620 Ir and add a second path
 *  to audit. Fermat's a^(n - 2), which both used before, is the reference the
 *  safegcd is held to bit for bit, in the test's seam
 *  (`tests/link/crypto_p256_inverse`). Every field inversion — of a Z that
 *  follows the key or the nonce in the public key, ECDH and signing — is the
 *  same safegcd modulo p, `p256FieldInvert`, on the same divstep and update
 *  functions.
 *
 *  The branches that remain are on public facts: a length, a limb or bit
 *  position, whether a received key or signature is in range, and — once in
 *  about 2^32 signatures — RFC 6979's retry when a candidate nonce is not below
 *  n.
 *
 * **What is verified by disassembly and what is discipline.**
 *
 *  `tests/cases/ct_asm_p256` holds copies of fiat's field multiply, square, add
 *  and subtract, its scalar multiply and its conditional move, the table read by
 *  a secret digit, the complete doubling and addition, one window step of
 *  `p256ScalarMult`, the comb's recoding (with fiat's scalar add), digit,
 *  masked entry move, signed entry read, mixed addition and one whole comb
 *  step, and safegcd's thirty divsteps and its two
 *  matrix updates, to the check of `tests/ct-asm.js`, which refuses any branch,
 *  call it cannot follow or secret-indexed access in them on x86-64 and aarch64,
 *  following each call into the field functions.
 *
 *  The copies of the point functions take coordinate arrays rather than points,
 *  the table reads' loops are written out there and their offsets computed with
 *  wrapping arithmetic, as that fixture's header says; its `main` runs RFC 6979
 *  A.2.5 through them, by the window and by the comb, and three inverses through
 *  the safegcd copies. The 64-window and 4-row loops, the table build, the
 *  inversions (safegcd's twenty-batch loop, its conversions, normalisation and
 *  limb loops among them), the recoding's byte read, the encodings and the nonce derivation are constant
 *  time by construction rather than by that proof.
 *
 * **Verification is variable time, on public values only.** `p256Verify`
 * computes u1 G + u2 Q in one interleaved pass, `p256DoubleMultPublic`: both
 * scalars recoded as width-5 wNAF, eight odd multiples of each point, the
 * doublings shared, and both the digits and the table reads follow the
 * scalars. Every input to it is the signature, the digest or the public key.
 * Nothing secret may be passed to it.
 *
 * **The private key is a `Secret`** (`nish:secret`, docs/LANGUAGE.md
 * "Secrets"). `p256PublicKey` and `p256Sign` read it only inside `expose` /
 * `exposeWith`, whose function the checker holds to reaching no I/O and no C,
 * and every intermediate the key or the nonce reaches is wiped before the
 * signature is returned (ECC-2, docs/security/crypto-ecc.md). That is why RFC
 * 6979's HMAC is written out over `Sha256` here (`p256Mac`) rather than taken
 * from `nish/crypto/hmac`: its key blocks and hasher state have to be this
 * module's to wipe.
 *
 * Private names carry the `p256` prefix because a `std/` module's private
 * functions share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 */
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret"
import { SHA256_BLOCK, SHA256_SIZE, Sha256, sha256 } from "nish/crypto/sha256"
import { timingSafeEqual } from "nish/crypto/ct"

/** The length in bytes of a private key: one scalar, big-endian. */
export const P256_SCALAR_SIZE: i32 = 32

/** The length in bytes of a public key: 0x04, then X and Y big-endian (SEC 1 §2.3.3). */
export const P256_POINT_SIZE: i32 = 65

/** The length in bytes of a signature: `r` then `s`, 32 big-endian bytes each. */
export const P256_SIGNATURE_SIZE: i32 = 64

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const P256_FROM: i32 = 0

/**
 * fiat's `addcarryx_u32`: `arg1 + arg2 + arg3` with `arg1` a carry of 0 or 1.
 * The sum is below 2^33, so its low 32 bits are fiat's `out1` and bit 32 its
 * `out2`.
 */
const p256FiatAddcarryxU32 = (arg1: u32, arg2: u32, arg3: u32): u64 => toU64(arg1) + toU64(arg2) + toU64(arg3)

/**
 * fiat's `subborrowx_u32`: `arg2 - arg1 - arg3` with `arg1` a borrow of 0 or 1.
 * The difference wraps modulo 2^64, so a negative one has every bit from 32 up
 * set; bit 32 alone is kept, which puts fiat's `out2` (1 on a borrow) where
 * `p256FiatAddcarryxU32` puts its carry.
 */
const p256FiatSubborrowxU32 = (arg1: u32, arg2: u32, arg3: u32): u64 =>
  (toU64(arg2) - toU64(arg1) - toU64(arg3)) & 0x1ffffffff

/** fiat's `mulx_u32`: the full 64-bit product, `out1` the low half and `out2` the high. */
const p256FiatMulxU32 = (arg1: u32, arg2: u32): u64 => toU64(arg1) * toU64(arg2)

/**
 * fiat's `cmovznz_u32`: `arg2` when `arg1` is zero and `arg3` otherwise. fiat
 * builds the mask from `!!arg1` behind a value barrier; `ctEq` builds it behind
 * the same kind of barrier, and `ctSelect` blends with it.
 */
const p256FiatCmovznzU32 = (arg1: u32, arg2: u32, arg3: u32): u32 => ctSelect(ctEq(arg1, 0), arg2, arg3)

/**
 * A `u64` from its two halves: how the 64-bit port writes fiat's constants
 * above 2^53, which no literal can.
 */
const p256FiatWord64 = (hi: u32, lo: u32): u64 => (toU64(hi) << 32) | toU64(lo)

/**
 * fiat's `addcarryx_u64`, its `out1`: `arg1 + arg2 + arg3` modulo 2^64, with
 * `arg1` a carry of 0 or 1. There is no 128-bit sum to take both outputs from,
 * so `out2` is `p256FiatAddcarryxU64Out2`.
 */
const p256FiatAddcarryxU64 = (arg1: u64, arg2: u64, arg3: u64): u64 => arg2 + arg3 + arg1

/**
 * fiat's `addcarryx_u64`, its `out2`: the carry out of `out1 = arg2 + arg3 +
 * c`, from the top bits alone. When `arg2` and `arg3` agree there, the carry is
 * that bit; when they differ, it is the carry into bit 63, the complement of
 * `out1`'s top bit.
 */
const p256FiatAddcarryxU64Out2 = (arg2: u64, arg3: u64, out1: u64): u64 =>
  ((arg2 & arg3) | ((arg2 | arg3) & ~out1)) >> 63

/** fiat's `subborrowx_u64`, its `out1`: `arg2 - arg1 - arg3` modulo 2^64, with `arg1` a borrow of 0 or 1. */
const p256FiatSubborrowxU64 = (arg1: u64, arg2: u64, arg3: u64): u64 => arg2 - arg3 - arg1

/**
 * fiat's `subborrowx_u64`, its `out2`: 1 on a borrow out of `out1 = arg2 -
 * arg3 - b`. `arg3` set where `arg2` is clear borrows; where they agree, the
 * borrow is the one into bit 63, which is `out1`'s top bit.
 */
const p256FiatSubborrowxU64Out2 = (arg2: u64, arg3: u64, out1: u64): u64 =>
  ((~arg2 & arg3) | (~(arg2 ^ arg3) & out1)) >> 63

/**
 * fiat's `mulx_u64`, its `out2`: the high half of the 128-bit product, from
 * four 32-by-32 products, since Nish has no wider integer. The low half,
 * fiat's `out1`, is the wrapping `arg1 * arg2`. `mid` is at most
 * 3 * (2^32 - 1), so it cannot wrap.
 */
const p256FiatMulxU64Hi = (arg1: u64, arg2: u64): u64 => {
  const a0: u64 = arg1 & 0xffffffff
  const a1: u64 = arg1 >> 32
  const b0: u64 = arg2 & 0xffffffff
  const b1: u64 = arg2 >> 32
  const p00: u64 = a0 * b0
  const p01: u64 = a0 * b1
  const p10: u64 = a1 * b0
  const p11: u64 = a1 * b1
  const mid: u64 = (p00 >> 32) + (p01 & 0xffffffff) + (p10 & 0xffffffff)
  return p11 + (p01 >> 32) + (p10 >> 32) + (mid >> 32)
}

/** fiat's `cmovznz_u64`: `arg2` when `arg1` is zero and `arg3` otherwise, as `p256FiatCmovznzU32` does. */
const p256FiatCmovznzU64 = (arg1: u64, arg2: u64, arg3: u64): u64 => ctSelect(ctEq(arg1, 0), arg2, arg3)

/** fiat's `fiat_p256_mul` (64-bit): multiplies two field elements in the Montgomery domain. */
const p256FiatMul = (out1: u32[], arg1: u32[], arg2: u32[]): void => {
  if (toI32(out1.length) < 8 || toI32(arg1.length) < 8 || toI32(arg2.length) < 8) {
    return
  }
  const arg1Limb0: u64 = toU64(arg1[0]) | (toU64(arg1[1]) << 32)
  const arg1Limb1: u64 = toU64(arg1[2]) | (toU64(arg1[3]) << 32)
  const arg1Limb2: u64 = toU64(arg1[4]) | (toU64(arg1[5]) << 32)
  const arg1Limb3: u64 = toU64(arg1[6]) | (toU64(arg1[7]) << 32)
  const arg2Limb0: u64 = toU64(arg2[0]) | (toU64(arg2[1]) << 32)
  const arg2Limb1: u64 = toU64(arg2[2]) | (toU64(arg2[3]) << 32)
  const arg2Limb2: u64 = toU64(arg2[4]) | (toU64(arg2[5]) << 32)
  const arg2Limb3: u64 = toU64(arg2[6]) | (toU64(arg2[7]) << 32)
  const x1: u64 = arg1Limb1
  const x2: u64 = arg1Limb2
  const x3: u64 = arg1Limb3
  const x4: u64 = arg1Limb0
  const x5: u64 = x4 * arg2Limb3
  const x6: u64 = p256FiatMulxU64Hi(x4, arg2Limb3)
  const x7: u64 = x4 * arg2Limb2
  const x8: u64 = p256FiatMulxU64Hi(x4, arg2Limb2)
  const x9: u64 = x4 * arg2Limb1
  const x10: u64 = p256FiatMulxU64Hi(x4, arg2Limb1)
  const x11: u64 = x4 * arg2Limb0
  const x12: u64 = p256FiatMulxU64Hi(x4, arg2Limb0)
  const x13: u64 = p256FiatAddcarryxU64(0x0, x12, x9)
  const x14: u64 = p256FiatAddcarryxU64Out2(x12, x9, x13)
  const x15: u64 = p256FiatAddcarryxU64(x14, x10, x7)
  const x16: u64 = p256FiatAddcarryxU64Out2(x10, x7, x15)
  const x17: u64 = p256FiatAddcarryxU64(x16, x8, x5)
  const x18: u64 = p256FiatAddcarryxU64Out2(x8, x5, x17)
  const x19: u64 = x18 + x6
  const x20: u64 = x11 * p256FiatWord64(0xffffffff, 0x1)
  const x21: u64 = p256FiatMulxU64Hi(x11, p256FiatWord64(0xffffffff, 0x1))
  const x22: u64 = x11 * 0xffffffff
  const x23: u64 = p256FiatMulxU64Hi(x11, 0xffffffff)
  const x24: u64 = x11 * p256FiatWord64(0xffffffff, 0xffffffff)
  const x25: u64 = p256FiatMulxU64Hi(x11, p256FiatWord64(0xffffffff, 0xffffffff))
  const x26: u64 = p256FiatAddcarryxU64(0x0, x25, x22)
  const x27: u64 = p256FiatAddcarryxU64Out2(x25, x22, x26)
  const x28: u64 = x27 + x23
  const x29: u64 = p256FiatAddcarryxU64(0x0, x11, x24)
  const x30: u64 = p256FiatAddcarryxU64Out2(x11, x24, x29)
  const x31: u64 = p256FiatAddcarryxU64(x30, x13, x26)
  const x32: u64 = p256FiatAddcarryxU64Out2(x13, x26, x31)
  const x33: u64 = p256FiatAddcarryxU64(x32, x15, x28)
  const x34: u64 = p256FiatAddcarryxU64Out2(x15, x28, x33)
  const x35: u64 = p256FiatAddcarryxU64(x34, x17, x20)
  const x36: u64 = p256FiatAddcarryxU64Out2(x17, x20, x35)
  const x37: u64 = p256FiatAddcarryxU64(x36, x19, x21)
  const x38: u64 = p256FiatAddcarryxU64Out2(x19, x21, x37)
  const x39: u64 = x1 * arg2Limb3
  const x40: u64 = p256FiatMulxU64Hi(x1, arg2Limb3)
  const x41: u64 = x1 * arg2Limb2
  const x42: u64 = p256FiatMulxU64Hi(x1, arg2Limb2)
  const x43: u64 = x1 * arg2Limb1
  const x44: u64 = p256FiatMulxU64Hi(x1, arg2Limb1)
  const x45: u64 = x1 * arg2Limb0
  const x46: u64 = p256FiatMulxU64Hi(x1, arg2Limb0)
  const x47: u64 = p256FiatAddcarryxU64(0x0, x46, x43)
  const x48: u64 = p256FiatAddcarryxU64Out2(x46, x43, x47)
  const x49: u64 = p256FiatAddcarryxU64(x48, x44, x41)
  const x50: u64 = p256FiatAddcarryxU64Out2(x44, x41, x49)
  const x51: u64 = p256FiatAddcarryxU64(x50, x42, x39)
  const x52: u64 = p256FiatAddcarryxU64Out2(x42, x39, x51)
  const x53: u64 = x52 + x40
  const x54: u64 = p256FiatAddcarryxU64(0x0, x31, x45)
  const x55: u64 = p256FiatAddcarryxU64Out2(x31, x45, x54)
  const x56: u64 = p256FiatAddcarryxU64(x55, x33, x47)
  const x57: u64 = p256FiatAddcarryxU64Out2(x33, x47, x56)
  const x58: u64 = p256FiatAddcarryxU64(x57, x35, x49)
  const x59: u64 = p256FiatAddcarryxU64Out2(x35, x49, x58)
  const x60: u64 = p256FiatAddcarryxU64(x59, x37, x51)
  const x61: u64 = p256FiatAddcarryxU64Out2(x37, x51, x60)
  const x62: u64 = p256FiatAddcarryxU64(x61, x38, x53)
  const x63: u64 = p256FiatAddcarryxU64Out2(x38, x53, x62)
  const x64: u64 = x54 * p256FiatWord64(0xffffffff, 0x1)
  const x65: u64 = p256FiatMulxU64Hi(x54, p256FiatWord64(0xffffffff, 0x1))
  const x66: u64 = x54 * 0xffffffff
  const x67: u64 = p256FiatMulxU64Hi(x54, 0xffffffff)
  const x68: u64 = x54 * p256FiatWord64(0xffffffff, 0xffffffff)
  const x69: u64 = p256FiatMulxU64Hi(x54, p256FiatWord64(0xffffffff, 0xffffffff))
  const x70: u64 = p256FiatAddcarryxU64(0x0, x69, x66)
  const x71: u64 = p256FiatAddcarryxU64Out2(x69, x66, x70)
  const x72: u64 = x71 + x67
  const x73: u64 = p256FiatAddcarryxU64(0x0, x54, x68)
  const x74: u64 = p256FiatAddcarryxU64Out2(x54, x68, x73)
  const x75: u64 = p256FiatAddcarryxU64(x74, x56, x70)
  const x76: u64 = p256FiatAddcarryxU64Out2(x56, x70, x75)
  const x77: u64 = p256FiatAddcarryxU64(x76, x58, x72)
  const x78: u64 = p256FiatAddcarryxU64Out2(x58, x72, x77)
  const x79: u64 = p256FiatAddcarryxU64(x78, x60, x64)
  const x80: u64 = p256FiatAddcarryxU64Out2(x60, x64, x79)
  const x81: u64 = p256FiatAddcarryxU64(x80, x62, x65)
  const x82: u64 = p256FiatAddcarryxU64Out2(x62, x65, x81)
  const x83: u64 = x82 + x63
  const x84: u64 = x2 * arg2Limb3
  const x85: u64 = p256FiatMulxU64Hi(x2, arg2Limb3)
  const x86: u64 = x2 * arg2Limb2
  const x87: u64 = p256FiatMulxU64Hi(x2, arg2Limb2)
  const x88: u64 = x2 * arg2Limb1
  const x89: u64 = p256FiatMulxU64Hi(x2, arg2Limb1)
  const x90: u64 = x2 * arg2Limb0
  const x91: u64 = p256FiatMulxU64Hi(x2, arg2Limb0)
  const x92: u64 = p256FiatAddcarryxU64(0x0, x91, x88)
  const x93: u64 = p256FiatAddcarryxU64Out2(x91, x88, x92)
  const x94: u64 = p256FiatAddcarryxU64(x93, x89, x86)
  const x95: u64 = p256FiatAddcarryxU64Out2(x89, x86, x94)
  const x96: u64 = p256FiatAddcarryxU64(x95, x87, x84)
  const x97: u64 = p256FiatAddcarryxU64Out2(x87, x84, x96)
  const x98: u64 = x97 + x85
  const x99: u64 = p256FiatAddcarryxU64(0x0, x75, x90)
  const x100: u64 = p256FiatAddcarryxU64Out2(x75, x90, x99)
  const x101: u64 = p256FiatAddcarryxU64(x100, x77, x92)
  const x102: u64 = p256FiatAddcarryxU64Out2(x77, x92, x101)
  const x103: u64 = p256FiatAddcarryxU64(x102, x79, x94)
  const x104: u64 = p256FiatAddcarryxU64Out2(x79, x94, x103)
  const x105: u64 = p256FiatAddcarryxU64(x104, x81, x96)
  const x106: u64 = p256FiatAddcarryxU64Out2(x81, x96, x105)
  const x107: u64 = p256FiatAddcarryxU64(x106, x83, x98)
  const x108: u64 = p256FiatAddcarryxU64Out2(x83, x98, x107)
  const x109: u64 = x99 * p256FiatWord64(0xffffffff, 0x1)
  const x110: u64 = p256FiatMulxU64Hi(x99, p256FiatWord64(0xffffffff, 0x1))
  const x111: u64 = x99 * 0xffffffff
  const x112: u64 = p256FiatMulxU64Hi(x99, 0xffffffff)
  const x113: u64 = x99 * p256FiatWord64(0xffffffff, 0xffffffff)
  const x114: u64 = p256FiatMulxU64Hi(x99, p256FiatWord64(0xffffffff, 0xffffffff))
  const x115: u64 = p256FiatAddcarryxU64(0x0, x114, x111)
  const x116: u64 = p256FiatAddcarryxU64Out2(x114, x111, x115)
  const x117: u64 = x116 + x112
  const x118: u64 = p256FiatAddcarryxU64(0x0, x99, x113)
  const x119: u64 = p256FiatAddcarryxU64Out2(x99, x113, x118)
  const x120: u64 = p256FiatAddcarryxU64(x119, x101, x115)
  const x121: u64 = p256FiatAddcarryxU64Out2(x101, x115, x120)
  const x122: u64 = p256FiatAddcarryxU64(x121, x103, x117)
  const x123: u64 = p256FiatAddcarryxU64Out2(x103, x117, x122)
  const x124: u64 = p256FiatAddcarryxU64(x123, x105, x109)
  const x125: u64 = p256FiatAddcarryxU64Out2(x105, x109, x124)
  const x126: u64 = p256FiatAddcarryxU64(x125, x107, x110)
  const x127: u64 = p256FiatAddcarryxU64Out2(x107, x110, x126)
  const x128: u64 = x127 + x108
  const x129: u64 = x3 * arg2Limb3
  const x130: u64 = p256FiatMulxU64Hi(x3, arg2Limb3)
  const x131: u64 = x3 * arg2Limb2
  const x132: u64 = p256FiatMulxU64Hi(x3, arg2Limb2)
  const x133: u64 = x3 * arg2Limb1
  const x134: u64 = p256FiatMulxU64Hi(x3, arg2Limb1)
  const x135: u64 = x3 * arg2Limb0
  const x136: u64 = p256FiatMulxU64Hi(x3, arg2Limb0)
  const x137: u64 = p256FiatAddcarryxU64(0x0, x136, x133)
  const x138: u64 = p256FiatAddcarryxU64Out2(x136, x133, x137)
  const x139: u64 = p256FiatAddcarryxU64(x138, x134, x131)
  const x140: u64 = p256FiatAddcarryxU64Out2(x134, x131, x139)
  const x141: u64 = p256FiatAddcarryxU64(x140, x132, x129)
  const x142: u64 = p256FiatAddcarryxU64Out2(x132, x129, x141)
  const x143: u64 = x142 + x130
  const x144: u64 = p256FiatAddcarryxU64(0x0, x120, x135)
  const x145: u64 = p256FiatAddcarryxU64Out2(x120, x135, x144)
  const x146: u64 = p256FiatAddcarryxU64(x145, x122, x137)
  const x147: u64 = p256FiatAddcarryxU64Out2(x122, x137, x146)
  const x148: u64 = p256FiatAddcarryxU64(x147, x124, x139)
  const x149: u64 = p256FiatAddcarryxU64Out2(x124, x139, x148)
  const x150: u64 = p256FiatAddcarryxU64(x149, x126, x141)
  const x151: u64 = p256FiatAddcarryxU64Out2(x126, x141, x150)
  const x152: u64 = p256FiatAddcarryxU64(x151, x128, x143)
  const x153: u64 = p256FiatAddcarryxU64Out2(x128, x143, x152)
  const x154: u64 = x144 * p256FiatWord64(0xffffffff, 0x1)
  const x155: u64 = p256FiatMulxU64Hi(x144, p256FiatWord64(0xffffffff, 0x1))
  const x156: u64 = x144 * 0xffffffff
  const x157: u64 = p256FiatMulxU64Hi(x144, 0xffffffff)
  const x158: u64 = x144 * p256FiatWord64(0xffffffff, 0xffffffff)
  const x159: u64 = p256FiatMulxU64Hi(x144, p256FiatWord64(0xffffffff, 0xffffffff))
  const x160: u64 = p256FiatAddcarryxU64(0x0, x159, x156)
  const x161: u64 = p256FiatAddcarryxU64Out2(x159, x156, x160)
  const x162: u64 = x161 + x157
  const x163: u64 = p256FiatAddcarryxU64(0x0, x144, x158)
  const x164: u64 = p256FiatAddcarryxU64Out2(x144, x158, x163)
  const x165: u64 = p256FiatAddcarryxU64(x164, x146, x160)
  const x166: u64 = p256FiatAddcarryxU64Out2(x146, x160, x165)
  const x167: u64 = p256FiatAddcarryxU64(x166, x148, x162)
  const x168: u64 = p256FiatAddcarryxU64Out2(x148, x162, x167)
  const x169: u64 = p256FiatAddcarryxU64(x168, x150, x154)
  const x170: u64 = p256FiatAddcarryxU64Out2(x150, x154, x169)
  const x171: u64 = p256FiatAddcarryxU64(x170, x152, x155)
  const x172: u64 = p256FiatAddcarryxU64Out2(x152, x155, x171)
  const x173: u64 = x172 + x153
  const x174: u64 = p256FiatSubborrowxU64(0x0, x165, p256FiatWord64(0xffffffff, 0xffffffff))
  const x175: u64 = p256FiatSubborrowxU64Out2(x165, p256FiatWord64(0xffffffff, 0xffffffff), x174)
  const x176: u64 = p256FiatSubborrowxU64(x175, x167, 0xffffffff)
  const x177: u64 = p256FiatSubborrowxU64Out2(x167, 0xffffffff, x176)
  const x178: u64 = p256FiatSubborrowxU64(x177, x169, 0x0)
  const x179: u64 = p256FiatSubborrowxU64Out2(x169, 0x0, x178)
  const x180: u64 = p256FiatSubborrowxU64(x179, x171, p256FiatWord64(0xffffffff, 0x1))
  const x181: u64 = p256FiatSubborrowxU64Out2(x171, p256FiatWord64(0xffffffff, 0x1), x180)
  const x182: u64 = p256FiatSubborrowxU64(x181, x173, 0x0)
  const x183: u64 = p256FiatSubborrowxU64Out2(x173, 0x0, x182)
  const x184: u64 = p256FiatCmovznzU64(x183, x174, x165)
  const x185: u64 = p256FiatCmovznzU64(x183, x176, x167)
  const x186: u64 = p256FiatCmovznzU64(x183, x178, x169)
  const x187: u64 = p256FiatCmovznzU64(x183, x180, x171)
  out1[0] = toU32(x184)
  out1[1] = toU32(x184 >> 32)
  out1[2] = toU32(x185)
  out1[3] = toU32(x185 >> 32)
  out1[4] = toU32(x186)
  out1[5] = toU32(x186 >> 32)
  out1[6] = toU32(x187)
  out1[7] = toU32(x187 >> 32)
}

/** fiat's `fiat_p256_square` (64-bit): squares a field element in the Montgomery domain. */
const p256FiatSquare = (out1: u32[], arg1: u32[]): void => {
  if (toI32(out1.length) < 8 || toI32(arg1.length) < 8) {
    return
  }
  const arg1Limb0: u64 = toU64(arg1[0]) | (toU64(arg1[1]) << 32)
  const arg1Limb1: u64 = toU64(arg1[2]) | (toU64(arg1[3]) << 32)
  const arg1Limb2: u64 = toU64(arg1[4]) | (toU64(arg1[5]) << 32)
  const arg1Limb3: u64 = toU64(arg1[6]) | (toU64(arg1[7]) << 32)
  const x1: u64 = arg1Limb1
  const x2: u64 = arg1Limb2
  const x3: u64 = arg1Limb3
  const x4: u64 = arg1Limb0
  const x5: u64 = x4 * arg1Limb3
  const x6: u64 = p256FiatMulxU64Hi(x4, arg1Limb3)
  const x7: u64 = x4 * arg1Limb2
  const x8: u64 = p256FiatMulxU64Hi(x4, arg1Limb2)
  const x9: u64 = x4 * arg1Limb1
  const x10: u64 = p256FiatMulxU64Hi(x4, arg1Limb1)
  const x11: u64 = x4 * arg1Limb0
  const x12: u64 = p256FiatMulxU64Hi(x4, arg1Limb0)
  const x13: u64 = p256FiatAddcarryxU64(0x0, x12, x9)
  const x14: u64 = p256FiatAddcarryxU64Out2(x12, x9, x13)
  const x15: u64 = p256FiatAddcarryxU64(x14, x10, x7)
  const x16: u64 = p256FiatAddcarryxU64Out2(x10, x7, x15)
  const x17: u64 = p256FiatAddcarryxU64(x16, x8, x5)
  const x18: u64 = p256FiatAddcarryxU64Out2(x8, x5, x17)
  const x19: u64 = x18 + x6
  const x20: u64 = x11 * p256FiatWord64(0xffffffff, 0x1)
  const x21: u64 = p256FiatMulxU64Hi(x11, p256FiatWord64(0xffffffff, 0x1))
  const x22: u64 = x11 * 0xffffffff
  const x23: u64 = p256FiatMulxU64Hi(x11, 0xffffffff)
  const x24: u64 = x11 * p256FiatWord64(0xffffffff, 0xffffffff)
  const x25: u64 = p256FiatMulxU64Hi(x11, p256FiatWord64(0xffffffff, 0xffffffff))
  const x26: u64 = p256FiatAddcarryxU64(0x0, x25, x22)
  const x27: u64 = p256FiatAddcarryxU64Out2(x25, x22, x26)
  const x28: u64 = x27 + x23
  const x29: u64 = p256FiatAddcarryxU64(0x0, x11, x24)
  const x30: u64 = p256FiatAddcarryxU64Out2(x11, x24, x29)
  const x31: u64 = p256FiatAddcarryxU64(x30, x13, x26)
  const x32: u64 = p256FiatAddcarryxU64Out2(x13, x26, x31)
  const x33: u64 = p256FiatAddcarryxU64(x32, x15, x28)
  const x34: u64 = p256FiatAddcarryxU64Out2(x15, x28, x33)
  const x35: u64 = p256FiatAddcarryxU64(x34, x17, x20)
  const x36: u64 = p256FiatAddcarryxU64Out2(x17, x20, x35)
  const x37: u64 = p256FiatAddcarryxU64(x36, x19, x21)
  const x38: u64 = p256FiatAddcarryxU64Out2(x19, x21, x37)
  const x39: u64 = x1 * arg1Limb3
  const x40: u64 = p256FiatMulxU64Hi(x1, arg1Limb3)
  const x41: u64 = x1 * arg1Limb2
  const x42: u64 = p256FiatMulxU64Hi(x1, arg1Limb2)
  const x43: u64 = x1 * arg1Limb1
  const x44: u64 = p256FiatMulxU64Hi(x1, arg1Limb1)
  const x45: u64 = x1 * arg1Limb0
  const x46: u64 = p256FiatMulxU64Hi(x1, arg1Limb0)
  const x47: u64 = p256FiatAddcarryxU64(0x0, x46, x43)
  const x48: u64 = p256FiatAddcarryxU64Out2(x46, x43, x47)
  const x49: u64 = p256FiatAddcarryxU64(x48, x44, x41)
  const x50: u64 = p256FiatAddcarryxU64Out2(x44, x41, x49)
  const x51: u64 = p256FiatAddcarryxU64(x50, x42, x39)
  const x52: u64 = p256FiatAddcarryxU64Out2(x42, x39, x51)
  const x53: u64 = x52 + x40
  const x54: u64 = p256FiatAddcarryxU64(0x0, x31, x45)
  const x55: u64 = p256FiatAddcarryxU64Out2(x31, x45, x54)
  const x56: u64 = p256FiatAddcarryxU64(x55, x33, x47)
  const x57: u64 = p256FiatAddcarryxU64Out2(x33, x47, x56)
  const x58: u64 = p256FiatAddcarryxU64(x57, x35, x49)
  const x59: u64 = p256FiatAddcarryxU64Out2(x35, x49, x58)
  const x60: u64 = p256FiatAddcarryxU64(x59, x37, x51)
  const x61: u64 = p256FiatAddcarryxU64Out2(x37, x51, x60)
  const x62: u64 = p256FiatAddcarryxU64(x61, x38, x53)
  const x63: u64 = p256FiatAddcarryxU64Out2(x38, x53, x62)
  const x64: u64 = x54 * p256FiatWord64(0xffffffff, 0x1)
  const x65: u64 = p256FiatMulxU64Hi(x54, p256FiatWord64(0xffffffff, 0x1))
  const x66: u64 = x54 * 0xffffffff
  const x67: u64 = p256FiatMulxU64Hi(x54, 0xffffffff)
  const x68: u64 = x54 * p256FiatWord64(0xffffffff, 0xffffffff)
  const x69: u64 = p256FiatMulxU64Hi(x54, p256FiatWord64(0xffffffff, 0xffffffff))
  const x70: u64 = p256FiatAddcarryxU64(0x0, x69, x66)
  const x71: u64 = p256FiatAddcarryxU64Out2(x69, x66, x70)
  const x72: u64 = x71 + x67
  const x73: u64 = p256FiatAddcarryxU64(0x0, x54, x68)
  const x74: u64 = p256FiatAddcarryxU64Out2(x54, x68, x73)
  const x75: u64 = p256FiatAddcarryxU64(x74, x56, x70)
  const x76: u64 = p256FiatAddcarryxU64Out2(x56, x70, x75)
  const x77: u64 = p256FiatAddcarryxU64(x76, x58, x72)
  const x78: u64 = p256FiatAddcarryxU64Out2(x58, x72, x77)
  const x79: u64 = p256FiatAddcarryxU64(x78, x60, x64)
  const x80: u64 = p256FiatAddcarryxU64Out2(x60, x64, x79)
  const x81: u64 = p256FiatAddcarryxU64(x80, x62, x65)
  const x82: u64 = p256FiatAddcarryxU64Out2(x62, x65, x81)
  const x83: u64 = x82 + x63
  const x84: u64 = x2 * arg1Limb3
  const x85: u64 = p256FiatMulxU64Hi(x2, arg1Limb3)
  const x86: u64 = x2 * arg1Limb2
  const x87: u64 = p256FiatMulxU64Hi(x2, arg1Limb2)
  const x88: u64 = x2 * arg1Limb1
  const x89: u64 = p256FiatMulxU64Hi(x2, arg1Limb1)
  const x90: u64 = x2 * arg1Limb0
  const x91: u64 = p256FiatMulxU64Hi(x2, arg1Limb0)
  const x92: u64 = p256FiatAddcarryxU64(0x0, x91, x88)
  const x93: u64 = p256FiatAddcarryxU64Out2(x91, x88, x92)
  const x94: u64 = p256FiatAddcarryxU64(x93, x89, x86)
  const x95: u64 = p256FiatAddcarryxU64Out2(x89, x86, x94)
  const x96: u64 = p256FiatAddcarryxU64(x95, x87, x84)
  const x97: u64 = p256FiatAddcarryxU64Out2(x87, x84, x96)
  const x98: u64 = x97 + x85
  const x99: u64 = p256FiatAddcarryxU64(0x0, x75, x90)
  const x100: u64 = p256FiatAddcarryxU64Out2(x75, x90, x99)
  const x101: u64 = p256FiatAddcarryxU64(x100, x77, x92)
  const x102: u64 = p256FiatAddcarryxU64Out2(x77, x92, x101)
  const x103: u64 = p256FiatAddcarryxU64(x102, x79, x94)
  const x104: u64 = p256FiatAddcarryxU64Out2(x79, x94, x103)
  const x105: u64 = p256FiatAddcarryxU64(x104, x81, x96)
  const x106: u64 = p256FiatAddcarryxU64Out2(x81, x96, x105)
  const x107: u64 = p256FiatAddcarryxU64(x106, x83, x98)
  const x108: u64 = p256FiatAddcarryxU64Out2(x83, x98, x107)
  const x109: u64 = x99 * p256FiatWord64(0xffffffff, 0x1)
  const x110: u64 = p256FiatMulxU64Hi(x99, p256FiatWord64(0xffffffff, 0x1))
  const x111: u64 = x99 * 0xffffffff
  const x112: u64 = p256FiatMulxU64Hi(x99, 0xffffffff)
  const x113: u64 = x99 * p256FiatWord64(0xffffffff, 0xffffffff)
  const x114: u64 = p256FiatMulxU64Hi(x99, p256FiatWord64(0xffffffff, 0xffffffff))
  const x115: u64 = p256FiatAddcarryxU64(0x0, x114, x111)
  const x116: u64 = p256FiatAddcarryxU64Out2(x114, x111, x115)
  const x117: u64 = x116 + x112
  const x118: u64 = p256FiatAddcarryxU64(0x0, x99, x113)
  const x119: u64 = p256FiatAddcarryxU64Out2(x99, x113, x118)
  const x120: u64 = p256FiatAddcarryxU64(x119, x101, x115)
  const x121: u64 = p256FiatAddcarryxU64Out2(x101, x115, x120)
  const x122: u64 = p256FiatAddcarryxU64(x121, x103, x117)
  const x123: u64 = p256FiatAddcarryxU64Out2(x103, x117, x122)
  const x124: u64 = p256FiatAddcarryxU64(x123, x105, x109)
  const x125: u64 = p256FiatAddcarryxU64Out2(x105, x109, x124)
  const x126: u64 = p256FiatAddcarryxU64(x125, x107, x110)
  const x127: u64 = p256FiatAddcarryxU64Out2(x107, x110, x126)
  const x128: u64 = x127 + x108
  const x129: u64 = x3 * arg1Limb3
  const x130: u64 = p256FiatMulxU64Hi(x3, arg1Limb3)
  const x131: u64 = x3 * arg1Limb2
  const x132: u64 = p256FiatMulxU64Hi(x3, arg1Limb2)
  const x133: u64 = x3 * arg1Limb1
  const x134: u64 = p256FiatMulxU64Hi(x3, arg1Limb1)
  const x135: u64 = x3 * arg1Limb0
  const x136: u64 = p256FiatMulxU64Hi(x3, arg1Limb0)
  const x137: u64 = p256FiatAddcarryxU64(0x0, x136, x133)
  const x138: u64 = p256FiatAddcarryxU64Out2(x136, x133, x137)
  const x139: u64 = p256FiatAddcarryxU64(x138, x134, x131)
  const x140: u64 = p256FiatAddcarryxU64Out2(x134, x131, x139)
  const x141: u64 = p256FiatAddcarryxU64(x140, x132, x129)
  const x142: u64 = p256FiatAddcarryxU64Out2(x132, x129, x141)
  const x143: u64 = x142 + x130
  const x144: u64 = p256FiatAddcarryxU64(0x0, x120, x135)
  const x145: u64 = p256FiatAddcarryxU64Out2(x120, x135, x144)
  const x146: u64 = p256FiatAddcarryxU64(x145, x122, x137)
  const x147: u64 = p256FiatAddcarryxU64Out2(x122, x137, x146)
  const x148: u64 = p256FiatAddcarryxU64(x147, x124, x139)
  const x149: u64 = p256FiatAddcarryxU64Out2(x124, x139, x148)
  const x150: u64 = p256FiatAddcarryxU64(x149, x126, x141)
  const x151: u64 = p256FiatAddcarryxU64Out2(x126, x141, x150)
  const x152: u64 = p256FiatAddcarryxU64(x151, x128, x143)
  const x153: u64 = p256FiatAddcarryxU64Out2(x128, x143, x152)
  const x154: u64 = x144 * p256FiatWord64(0xffffffff, 0x1)
  const x155: u64 = p256FiatMulxU64Hi(x144, p256FiatWord64(0xffffffff, 0x1))
  const x156: u64 = x144 * 0xffffffff
  const x157: u64 = p256FiatMulxU64Hi(x144, 0xffffffff)
  const x158: u64 = x144 * p256FiatWord64(0xffffffff, 0xffffffff)
  const x159: u64 = p256FiatMulxU64Hi(x144, p256FiatWord64(0xffffffff, 0xffffffff))
  const x160: u64 = p256FiatAddcarryxU64(0x0, x159, x156)
  const x161: u64 = p256FiatAddcarryxU64Out2(x159, x156, x160)
  const x162: u64 = x161 + x157
  const x163: u64 = p256FiatAddcarryxU64(0x0, x144, x158)
  const x164: u64 = p256FiatAddcarryxU64Out2(x144, x158, x163)
  const x165: u64 = p256FiatAddcarryxU64(x164, x146, x160)
  const x166: u64 = p256FiatAddcarryxU64Out2(x146, x160, x165)
  const x167: u64 = p256FiatAddcarryxU64(x166, x148, x162)
  const x168: u64 = p256FiatAddcarryxU64Out2(x148, x162, x167)
  const x169: u64 = p256FiatAddcarryxU64(x168, x150, x154)
  const x170: u64 = p256FiatAddcarryxU64Out2(x150, x154, x169)
  const x171: u64 = p256FiatAddcarryxU64(x170, x152, x155)
  const x172: u64 = p256FiatAddcarryxU64Out2(x152, x155, x171)
  const x173: u64 = x172 + x153
  const x174: u64 = p256FiatSubborrowxU64(0x0, x165, p256FiatWord64(0xffffffff, 0xffffffff))
  const x175: u64 = p256FiatSubborrowxU64Out2(x165, p256FiatWord64(0xffffffff, 0xffffffff), x174)
  const x176: u64 = p256FiatSubborrowxU64(x175, x167, 0xffffffff)
  const x177: u64 = p256FiatSubborrowxU64Out2(x167, 0xffffffff, x176)
  const x178: u64 = p256FiatSubborrowxU64(x177, x169, 0x0)
  const x179: u64 = p256FiatSubborrowxU64Out2(x169, 0x0, x178)
  const x180: u64 = p256FiatSubborrowxU64(x179, x171, p256FiatWord64(0xffffffff, 0x1))
  const x181: u64 = p256FiatSubborrowxU64Out2(x171, p256FiatWord64(0xffffffff, 0x1), x180)
  const x182: u64 = p256FiatSubborrowxU64(x181, x173, 0x0)
  const x183: u64 = p256FiatSubborrowxU64Out2(x173, 0x0, x182)
  const x184: u64 = p256FiatCmovznzU64(x183, x174, x165)
  const x185: u64 = p256FiatCmovznzU64(x183, x176, x167)
  const x186: u64 = p256FiatCmovznzU64(x183, x178, x169)
  const x187: u64 = p256FiatCmovznzU64(x183, x180, x171)
  out1[0] = toU32(x184)
  out1[1] = toU32(x184 >> 32)
  out1[2] = toU32(x185)
  out1[3] = toU32(x185 >> 32)
  out1[4] = toU32(x186)
  out1[5] = toU32(x186 >> 32)
  out1[6] = toU32(x187)
  out1[7] = toU32(x187 >> 32)
}

/** fiat's `fiat_p256_add` (64-bit): adds two field elements in the Montgomery domain. */
const p256FiatAdd = (out1: u32[], arg1: u32[], arg2: u32[]): void => {
  if (toI32(out1.length) < 8 || toI32(arg1.length) < 8 || toI32(arg2.length) < 8) {
    return
  }
  const arg1Limb0: u64 = toU64(arg1[0]) | (toU64(arg1[1]) << 32)
  const arg1Limb1: u64 = toU64(arg1[2]) | (toU64(arg1[3]) << 32)
  const arg1Limb2: u64 = toU64(arg1[4]) | (toU64(arg1[5]) << 32)
  const arg1Limb3: u64 = toU64(arg1[6]) | (toU64(arg1[7]) << 32)
  const arg2Limb0: u64 = toU64(arg2[0]) | (toU64(arg2[1]) << 32)
  const arg2Limb1: u64 = toU64(arg2[2]) | (toU64(arg2[3]) << 32)
  const arg2Limb2: u64 = toU64(arg2[4]) | (toU64(arg2[5]) << 32)
  const arg2Limb3: u64 = toU64(arg2[6]) | (toU64(arg2[7]) << 32)
  const x1: u64 = p256FiatAddcarryxU64(0x0, arg1Limb0, arg2Limb0)
  const x2: u64 = p256FiatAddcarryxU64Out2(arg1Limb0, arg2Limb0, x1)
  const x3: u64 = p256FiatAddcarryxU64(x2, arg1Limb1, arg2Limb1)
  const x4: u64 = p256FiatAddcarryxU64Out2(arg1Limb1, arg2Limb1, x3)
  const x5: u64 = p256FiatAddcarryxU64(x4, arg1Limb2, arg2Limb2)
  const x6: u64 = p256FiatAddcarryxU64Out2(arg1Limb2, arg2Limb2, x5)
  const x7: u64 = p256FiatAddcarryxU64(x6, arg1Limb3, arg2Limb3)
  const x8: u64 = p256FiatAddcarryxU64Out2(arg1Limb3, arg2Limb3, x7)
  const x9: u64 = p256FiatSubborrowxU64(0x0, x1, p256FiatWord64(0xffffffff, 0xffffffff))
  const x10: u64 = p256FiatSubborrowxU64Out2(x1, p256FiatWord64(0xffffffff, 0xffffffff), x9)
  const x11: u64 = p256FiatSubborrowxU64(x10, x3, 0xffffffff)
  const x12: u64 = p256FiatSubborrowxU64Out2(x3, 0xffffffff, x11)
  const x13: u64 = p256FiatSubborrowxU64(x12, x5, 0x0)
  const x14: u64 = p256FiatSubborrowxU64Out2(x5, 0x0, x13)
  const x15: u64 = p256FiatSubborrowxU64(x14, x7, p256FiatWord64(0xffffffff, 0x1))
  const x16: u64 = p256FiatSubborrowxU64Out2(x7, p256FiatWord64(0xffffffff, 0x1), x15)
  const x17: u64 = p256FiatSubborrowxU64(x16, x8, 0x0)
  const x18: u64 = p256FiatSubborrowxU64Out2(x8, 0x0, x17)
  const x19: u64 = p256FiatCmovznzU64(x18, x9, x1)
  const x20: u64 = p256FiatCmovznzU64(x18, x11, x3)
  const x21: u64 = p256FiatCmovznzU64(x18, x13, x5)
  const x22: u64 = p256FiatCmovznzU64(x18, x15, x7)
  out1[0] = toU32(x19)
  out1[1] = toU32(x19 >> 32)
  out1[2] = toU32(x20)
  out1[3] = toU32(x20 >> 32)
  out1[4] = toU32(x21)
  out1[5] = toU32(x21 >> 32)
  out1[6] = toU32(x22)
  out1[7] = toU32(x22 >> 32)
}

/** fiat's `fiat_p256_sub` (64-bit): subtracts two field elements in the Montgomery domain. */
const p256FiatSub = (out1: u32[], arg1: u32[], arg2: u32[]): void => {
  if (toI32(out1.length) < 8 || toI32(arg1.length) < 8 || toI32(arg2.length) < 8) {
    return
  }
  const arg1Limb0: u64 = toU64(arg1[0]) | (toU64(arg1[1]) << 32)
  const arg1Limb1: u64 = toU64(arg1[2]) | (toU64(arg1[3]) << 32)
  const arg1Limb2: u64 = toU64(arg1[4]) | (toU64(arg1[5]) << 32)
  const arg1Limb3: u64 = toU64(arg1[6]) | (toU64(arg1[7]) << 32)
  const arg2Limb0: u64 = toU64(arg2[0]) | (toU64(arg2[1]) << 32)
  const arg2Limb1: u64 = toU64(arg2[2]) | (toU64(arg2[3]) << 32)
  const arg2Limb2: u64 = toU64(arg2[4]) | (toU64(arg2[5]) << 32)
  const arg2Limb3: u64 = toU64(arg2[6]) | (toU64(arg2[7]) << 32)
  const x1: u64 = p256FiatSubborrowxU64(0x0, arg1Limb0, arg2Limb0)
  const x2: u64 = p256FiatSubborrowxU64Out2(arg1Limb0, arg2Limb0, x1)
  const x3: u64 = p256FiatSubborrowxU64(x2, arg1Limb1, arg2Limb1)
  const x4: u64 = p256FiatSubborrowxU64Out2(arg1Limb1, arg2Limb1, x3)
  const x5: u64 = p256FiatSubborrowxU64(x4, arg1Limb2, arg2Limb2)
  const x6: u64 = p256FiatSubborrowxU64Out2(arg1Limb2, arg2Limb2, x5)
  const x7: u64 = p256FiatSubborrowxU64(x6, arg1Limb3, arg2Limb3)
  const x8: u64 = p256FiatSubborrowxU64Out2(arg1Limb3, arg2Limb3, x7)
  const x9: u64 = p256FiatCmovznzU64(x8, 0x0, p256FiatWord64(0xffffffff, 0xffffffff))
  const x10: u64 = p256FiatAddcarryxU64(0x0, x1, x9)
  const x11: u64 = p256FiatAddcarryxU64Out2(x1, x9, x10)
  const x12: u64 = p256FiatAddcarryxU64(x11, x3, x9 & 0xffffffff)
  const x13: u64 = p256FiatAddcarryxU64Out2(x3, x9 & 0xffffffff, x12)
  const x14: u64 = p256FiatAddcarryxU64(x13, x5, 0x0)
  const x15: u64 = p256FiatAddcarryxU64Out2(x5, 0x0, x14)
  const x16: u64 = p256FiatAddcarryxU64(x15, x7, x9 & p256FiatWord64(0xffffffff, 0x1))
  out1[0] = toU32(x10)
  out1[1] = toU32(x10 >> 32)
  out1[2] = toU32(x12)
  out1[3] = toU32(x12 >> 32)
  out1[4] = toU32(x14)
  out1[5] = toU32(x14 >> 32)
  out1[6] = toU32(x16)
  out1[7] = toU32(x16 >> 32)
}

/** fiat's `fiat_p256_nonzero`: outputs a single non-zero word if the input is non-zero and zero otherwise. */
const p256FiatNonzero = (arg1: u32[]): u32 => {
  if (toI32(arg1.length) < 8) {
    return 0
  }
  const x1: u32 = arg1[0] | (arg1[1] | (arg1[2] | (arg1[3] | (arg1[4] | (arg1[5] | (arg1[6] | arg1[7]))))))
  return x1
}

/** fiat's `fiat_p256_selectznz`: is a multi-limb conditional select. */
const p256FiatSelectznz = (out1: u32[], arg1: u32, arg2: u32[], arg3: u32[]): void => {
  if (toI32(out1.length) < 8 || toI32(arg2.length) < 8 || toI32(arg3.length) < 8) {
    return
  }
  const x1: u32 = p256FiatCmovznzU32(arg1, arg2[0], arg3[0])
  const x2: u32 = p256FiatCmovznzU32(arg1, arg2[1], arg3[1])
  const x3: u32 = p256FiatCmovznzU32(arg1, arg2[2], arg3[2])
  const x4: u32 = p256FiatCmovznzU32(arg1, arg2[3], arg3[3])
  const x5: u32 = p256FiatCmovznzU32(arg1, arg2[4], arg3[4])
  const x6: u32 = p256FiatCmovznzU32(arg1, arg2[5], arg3[5])
  const x7: u32 = p256FiatCmovznzU32(arg1, arg2[6], arg3[6])
  const x8: u32 = p256FiatCmovznzU32(arg1, arg2[7], arg3[7])
  out1[0] = x1
  out1[1] = x2
  out1[2] = x3
  out1[3] = x4
  out1[4] = x5
  out1[5] = x6
  out1[6] = x7
  out1[7] = x8
}

/** fiat's `fiat_p256_set_one`: returns the field element one in the Montgomery domain. */
const p256FiatSetOne = (out1: u32[]): void => {
  if (toI32(out1.length) < 8) {
    return
  }
  out1[0] = 0x1
  out1[1] = 0x0
  out1[2] = 0x0
  out1[3] = 0xffffffff
  out1[4] = 0xffffffff
  out1[5] = 0xffffffff
  out1[6] = 0xfffffffe
  out1[7] = 0x0
}
/** fiat's `fiat_p256_scalar_mul`: multiplies two field elements in the Montgomery domain. */
const p256FiatScalarMul = (out1: u32[], arg1: u32[], arg2: u32[]): void => {
  if (toI32(out1.length) < 8 || toI32(arg1.length) < 8 || toI32(arg2.length) < 8) {
    return
  }
  const x1: u32 = arg1[1]
  const x2: u32 = arg1[2]
  const x3: u32 = arg1[3]
  const x4: u32 = arg1[4]
  const x5: u32 = arg1[5]
  const x6: u32 = arg1[6]
  const x7: u32 = arg1[7]
  const x8: u32 = arg1[0]
  const w9: u64 = p256FiatMulxU32(x8, arg2[7])
  const x9: u32 = toU32(w9)
  const x10: u32 = toU32(w9 >> 32)
  const w11: u64 = p256FiatMulxU32(x8, arg2[6])
  const x11: u32 = toU32(w11)
  const x12: u32 = toU32(w11 >> 32)
  const w13: u64 = p256FiatMulxU32(x8, arg2[5])
  const x13: u32 = toU32(w13)
  const x14: u32 = toU32(w13 >> 32)
  const w15: u64 = p256FiatMulxU32(x8, arg2[4])
  const x15: u32 = toU32(w15)
  const x16: u32 = toU32(w15 >> 32)
  const w17: u64 = p256FiatMulxU32(x8, arg2[3])
  const x17: u32 = toU32(w17)
  const x18: u32 = toU32(w17 >> 32)
  const w19: u64 = p256FiatMulxU32(x8, arg2[2])
  const x19: u32 = toU32(w19)
  const x20: u32 = toU32(w19 >> 32)
  const w21: u64 = p256FiatMulxU32(x8, arg2[1])
  const x21: u32 = toU32(w21)
  const x22: u32 = toU32(w21 >> 32)
  const w23: u64 = p256FiatMulxU32(x8, arg2[0])
  const x23: u32 = toU32(w23)
  const x24: u32 = toU32(w23 >> 32)
  const w25: u64 = p256FiatAddcarryxU32(0x0, x24, x21)
  const x25: u32 = toU32(w25)
  const x26: u32 = toU32(w25 >> 32)
  const w27: u64 = p256FiatAddcarryxU32(x26, x22, x19)
  const x27: u32 = toU32(w27)
  const x28: u32 = toU32(w27 >> 32)
  const w29: u64 = p256FiatAddcarryxU32(x28, x20, x17)
  const x29: u32 = toU32(w29)
  const x30: u32 = toU32(w29 >> 32)
  const w31: u64 = p256FiatAddcarryxU32(x30, x18, x15)
  const x31: u32 = toU32(w31)
  const x32: u32 = toU32(w31 >> 32)
  const w33: u64 = p256FiatAddcarryxU32(x32, x16, x13)
  const x33: u32 = toU32(w33)
  const x34: u32 = toU32(w33 >> 32)
  const w35: u64 = p256FiatAddcarryxU32(x34, x14, x11)
  const x35: u32 = toU32(w35)
  const x36: u32 = toU32(w35 >> 32)
  const w37: u64 = p256FiatAddcarryxU32(x36, x12, x9)
  const x37: u32 = toU32(w37)
  const x38: u32 = toU32(w37 >> 32)
  const x39: u32 = x38 + x10
  const w40: u64 = p256FiatMulxU32(x23, 0xee00bc4f)
  const x40: u32 = toU32(w40)
  const w42: u64 = p256FiatMulxU32(x40, 0xffffffff)
  const x42: u32 = toU32(w42)
  const x43: u32 = toU32(w42 >> 32)
  const w44: u64 = p256FiatMulxU32(x40, 0xffffffff)
  const x44: u32 = toU32(w44)
  const x45: u32 = toU32(w44 >> 32)
  const w46: u64 = p256FiatMulxU32(x40, 0xffffffff)
  const x46: u32 = toU32(w46)
  const x47: u32 = toU32(w46 >> 32)
  const w48: u64 = p256FiatMulxU32(x40, 0xbce6faad)
  const x48: u32 = toU32(w48)
  const x49: u32 = toU32(w48 >> 32)
  const w50: u64 = p256FiatMulxU32(x40, 0xa7179e84)
  const x50: u32 = toU32(w50)
  const x51: u32 = toU32(w50 >> 32)
  const w52: u64 = p256FiatMulxU32(x40, 0xf3b9cac2)
  const x52: u32 = toU32(w52)
  const x53: u32 = toU32(w52 >> 32)
  const w54: u64 = p256FiatMulxU32(x40, 0xfc632551)
  const x54: u32 = toU32(w54)
  const x55: u32 = toU32(w54 >> 32)
  const w56: u64 = p256FiatAddcarryxU32(0x0, x55, x52)
  const x56: u32 = toU32(w56)
  const x57: u32 = toU32(w56 >> 32)
  const w58: u64 = p256FiatAddcarryxU32(x57, x53, x50)
  const x58: u32 = toU32(w58)
  const x59: u32 = toU32(w58 >> 32)
  const w60: u64 = p256FiatAddcarryxU32(x59, x51, x48)
  const x60: u32 = toU32(w60)
  const x61: u32 = toU32(w60 >> 32)
  const w62: u64 = p256FiatAddcarryxU32(x61, x49, x46)
  const x62: u32 = toU32(w62)
  const x63: u32 = toU32(w62 >> 32)
  const w64: u64 = p256FiatAddcarryxU32(x63, x47, x44)
  const x64: u32 = toU32(w64)
  const x65: u32 = toU32(w64 >> 32)
  const x66: u32 = x65 + x45
  const w67: u64 = p256FiatAddcarryxU32(0x0, x23, x54)
  const x68: u32 = toU32(w67 >> 32)
  const w69: u64 = p256FiatAddcarryxU32(x68, x25, x56)
  const x69: u32 = toU32(w69)
  const x70: u32 = toU32(w69 >> 32)
  const w71: u64 = p256FiatAddcarryxU32(x70, x27, x58)
  const x71: u32 = toU32(w71)
  const x72: u32 = toU32(w71 >> 32)
  const w73: u64 = p256FiatAddcarryxU32(x72, x29, x60)
  const x73: u32 = toU32(w73)
  const x74: u32 = toU32(w73 >> 32)
  const w75: u64 = p256FiatAddcarryxU32(x74, x31, x62)
  const x75: u32 = toU32(w75)
  const x76: u32 = toU32(w75 >> 32)
  const w77: u64 = p256FiatAddcarryxU32(x76, x33, x64)
  const x77: u32 = toU32(w77)
  const x78: u32 = toU32(w77 >> 32)
  const w79: u64 = p256FiatAddcarryxU32(x78, x35, x66)
  const x79: u32 = toU32(w79)
  const x80: u32 = toU32(w79 >> 32)
  const w81: u64 = p256FiatAddcarryxU32(x80, x37, x42)
  const x81: u32 = toU32(w81)
  const x82: u32 = toU32(w81 >> 32)
  const w83: u64 = p256FiatAddcarryxU32(x82, x39, x43)
  const x83: u32 = toU32(w83)
  const x84: u32 = toU32(w83 >> 32)
  const w85: u64 = p256FiatMulxU32(x1, arg2[7])
  const x85: u32 = toU32(w85)
  const x86: u32 = toU32(w85 >> 32)
  const w87: u64 = p256FiatMulxU32(x1, arg2[6])
  const x87: u32 = toU32(w87)
  const x88: u32 = toU32(w87 >> 32)
  const w89: u64 = p256FiatMulxU32(x1, arg2[5])
  const x89: u32 = toU32(w89)
  const x90: u32 = toU32(w89 >> 32)
  const w91: u64 = p256FiatMulxU32(x1, arg2[4])
  const x91: u32 = toU32(w91)
  const x92: u32 = toU32(w91 >> 32)
  const w93: u64 = p256FiatMulxU32(x1, arg2[3])
  const x93: u32 = toU32(w93)
  const x94: u32 = toU32(w93 >> 32)
  const w95: u64 = p256FiatMulxU32(x1, arg2[2])
  const x95: u32 = toU32(w95)
  const x96: u32 = toU32(w95 >> 32)
  const w97: u64 = p256FiatMulxU32(x1, arg2[1])
  const x97: u32 = toU32(w97)
  const x98: u32 = toU32(w97 >> 32)
  const w99: u64 = p256FiatMulxU32(x1, arg2[0])
  const x99: u32 = toU32(w99)
  const x100: u32 = toU32(w99 >> 32)
  const w101: u64 = p256FiatAddcarryxU32(0x0, x100, x97)
  const x101: u32 = toU32(w101)
  const x102: u32 = toU32(w101 >> 32)
  const w103: u64 = p256FiatAddcarryxU32(x102, x98, x95)
  const x103: u32 = toU32(w103)
  const x104: u32 = toU32(w103 >> 32)
  const w105: u64 = p256FiatAddcarryxU32(x104, x96, x93)
  const x105: u32 = toU32(w105)
  const x106: u32 = toU32(w105 >> 32)
  const w107: u64 = p256FiatAddcarryxU32(x106, x94, x91)
  const x107: u32 = toU32(w107)
  const x108: u32 = toU32(w107 >> 32)
  const w109: u64 = p256FiatAddcarryxU32(x108, x92, x89)
  const x109: u32 = toU32(w109)
  const x110: u32 = toU32(w109 >> 32)
  const w111: u64 = p256FiatAddcarryxU32(x110, x90, x87)
  const x111: u32 = toU32(w111)
  const x112: u32 = toU32(w111 >> 32)
  const w113: u64 = p256FiatAddcarryxU32(x112, x88, x85)
  const x113: u32 = toU32(w113)
  const x114: u32 = toU32(w113 >> 32)
  const x115: u32 = x114 + x86
  const w116: u64 = p256FiatAddcarryxU32(0x0, x69, x99)
  const x116: u32 = toU32(w116)
  const x117: u32 = toU32(w116 >> 32)
  const w118: u64 = p256FiatAddcarryxU32(x117, x71, x101)
  const x118: u32 = toU32(w118)
  const x119: u32 = toU32(w118 >> 32)
  const w120: u64 = p256FiatAddcarryxU32(x119, x73, x103)
  const x120: u32 = toU32(w120)
  const x121: u32 = toU32(w120 >> 32)
  const w122: u64 = p256FiatAddcarryxU32(x121, x75, x105)
  const x122: u32 = toU32(w122)
  const x123: u32 = toU32(w122 >> 32)
  const w124: u64 = p256FiatAddcarryxU32(x123, x77, x107)
  const x124: u32 = toU32(w124)
  const x125: u32 = toU32(w124 >> 32)
  const w126: u64 = p256FiatAddcarryxU32(x125, x79, x109)
  const x126: u32 = toU32(w126)
  const x127: u32 = toU32(w126 >> 32)
  const w128: u64 = p256FiatAddcarryxU32(x127, x81, x111)
  const x128: u32 = toU32(w128)
  const x129: u32 = toU32(w128 >> 32)
  const w130: u64 = p256FiatAddcarryxU32(x129, x83, x113)
  const x130: u32 = toU32(w130)
  const x131: u32 = toU32(w130 >> 32)
  const w132: u64 = p256FiatAddcarryxU32(x131, x84, x115)
  const x132: u32 = toU32(w132)
  const x133: u32 = toU32(w132 >> 32)
  const w134: u64 = p256FiatMulxU32(x116, 0xee00bc4f)
  const x134: u32 = toU32(w134)
  const w136: u64 = p256FiatMulxU32(x134, 0xffffffff)
  const x136: u32 = toU32(w136)
  const x137: u32 = toU32(w136 >> 32)
  const w138: u64 = p256FiatMulxU32(x134, 0xffffffff)
  const x138: u32 = toU32(w138)
  const x139: u32 = toU32(w138 >> 32)
  const w140: u64 = p256FiatMulxU32(x134, 0xffffffff)
  const x140: u32 = toU32(w140)
  const x141: u32 = toU32(w140 >> 32)
  const w142: u64 = p256FiatMulxU32(x134, 0xbce6faad)
  const x142: u32 = toU32(w142)
  const x143: u32 = toU32(w142 >> 32)
  const w144: u64 = p256FiatMulxU32(x134, 0xa7179e84)
  const x144: u32 = toU32(w144)
  const x145: u32 = toU32(w144 >> 32)
  const w146: u64 = p256FiatMulxU32(x134, 0xf3b9cac2)
  const x146: u32 = toU32(w146)
  const x147: u32 = toU32(w146 >> 32)
  const w148: u64 = p256FiatMulxU32(x134, 0xfc632551)
  const x148: u32 = toU32(w148)
  const x149: u32 = toU32(w148 >> 32)
  const w150: u64 = p256FiatAddcarryxU32(0x0, x149, x146)
  const x150: u32 = toU32(w150)
  const x151: u32 = toU32(w150 >> 32)
  const w152: u64 = p256FiatAddcarryxU32(x151, x147, x144)
  const x152: u32 = toU32(w152)
  const x153: u32 = toU32(w152 >> 32)
  const w154: u64 = p256FiatAddcarryxU32(x153, x145, x142)
  const x154: u32 = toU32(w154)
  const x155: u32 = toU32(w154 >> 32)
  const w156: u64 = p256FiatAddcarryxU32(x155, x143, x140)
  const x156: u32 = toU32(w156)
  const x157: u32 = toU32(w156 >> 32)
  const w158: u64 = p256FiatAddcarryxU32(x157, x141, x138)
  const x158: u32 = toU32(w158)
  const x159: u32 = toU32(w158 >> 32)
  const x160: u32 = x159 + x139
  const w161: u64 = p256FiatAddcarryxU32(0x0, x116, x148)
  const x162: u32 = toU32(w161 >> 32)
  const w163: u64 = p256FiatAddcarryxU32(x162, x118, x150)
  const x163: u32 = toU32(w163)
  const x164: u32 = toU32(w163 >> 32)
  const w165: u64 = p256FiatAddcarryxU32(x164, x120, x152)
  const x165: u32 = toU32(w165)
  const x166: u32 = toU32(w165 >> 32)
  const w167: u64 = p256FiatAddcarryxU32(x166, x122, x154)
  const x167: u32 = toU32(w167)
  const x168: u32 = toU32(w167 >> 32)
  const w169: u64 = p256FiatAddcarryxU32(x168, x124, x156)
  const x169: u32 = toU32(w169)
  const x170: u32 = toU32(w169 >> 32)
  const w171: u64 = p256FiatAddcarryxU32(x170, x126, x158)
  const x171: u32 = toU32(w171)
  const x172: u32 = toU32(w171 >> 32)
  const w173: u64 = p256FiatAddcarryxU32(x172, x128, x160)
  const x173: u32 = toU32(w173)
  const x174: u32 = toU32(w173 >> 32)
  const w175: u64 = p256FiatAddcarryxU32(x174, x130, x136)
  const x175: u32 = toU32(w175)
  const x176: u32 = toU32(w175 >> 32)
  const w177: u64 = p256FiatAddcarryxU32(x176, x132, x137)
  const x177: u32 = toU32(w177)
  const x178: u32 = toU32(w177 >> 32)
  const x179: u32 = x178 + x133
  const w180: u64 = p256FiatMulxU32(x2, arg2[7])
  const x180: u32 = toU32(w180)
  const x181: u32 = toU32(w180 >> 32)
  const w182: u64 = p256FiatMulxU32(x2, arg2[6])
  const x182: u32 = toU32(w182)
  const x183: u32 = toU32(w182 >> 32)
  const w184: u64 = p256FiatMulxU32(x2, arg2[5])
  const x184: u32 = toU32(w184)
  const x185: u32 = toU32(w184 >> 32)
  const w186: u64 = p256FiatMulxU32(x2, arg2[4])
  const x186: u32 = toU32(w186)
  const x187: u32 = toU32(w186 >> 32)
  const w188: u64 = p256FiatMulxU32(x2, arg2[3])
  const x188: u32 = toU32(w188)
  const x189: u32 = toU32(w188 >> 32)
  const w190: u64 = p256FiatMulxU32(x2, arg2[2])
  const x190: u32 = toU32(w190)
  const x191: u32 = toU32(w190 >> 32)
  const w192: u64 = p256FiatMulxU32(x2, arg2[1])
  const x192: u32 = toU32(w192)
  const x193: u32 = toU32(w192 >> 32)
  const w194: u64 = p256FiatMulxU32(x2, arg2[0])
  const x194: u32 = toU32(w194)
  const x195: u32 = toU32(w194 >> 32)
  const w196: u64 = p256FiatAddcarryxU32(0x0, x195, x192)
  const x196: u32 = toU32(w196)
  const x197: u32 = toU32(w196 >> 32)
  const w198: u64 = p256FiatAddcarryxU32(x197, x193, x190)
  const x198: u32 = toU32(w198)
  const x199: u32 = toU32(w198 >> 32)
  const w200: u64 = p256FiatAddcarryxU32(x199, x191, x188)
  const x200: u32 = toU32(w200)
  const x201: u32 = toU32(w200 >> 32)
  const w202: u64 = p256FiatAddcarryxU32(x201, x189, x186)
  const x202: u32 = toU32(w202)
  const x203: u32 = toU32(w202 >> 32)
  const w204: u64 = p256FiatAddcarryxU32(x203, x187, x184)
  const x204: u32 = toU32(w204)
  const x205: u32 = toU32(w204 >> 32)
  const w206: u64 = p256FiatAddcarryxU32(x205, x185, x182)
  const x206: u32 = toU32(w206)
  const x207: u32 = toU32(w206 >> 32)
  const w208: u64 = p256FiatAddcarryxU32(x207, x183, x180)
  const x208: u32 = toU32(w208)
  const x209: u32 = toU32(w208 >> 32)
  const x210: u32 = x209 + x181
  const w211: u64 = p256FiatAddcarryxU32(0x0, x163, x194)
  const x211: u32 = toU32(w211)
  const x212: u32 = toU32(w211 >> 32)
  const w213: u64 = p256FiatAddcarryxU32(x212, x165, x196)
  const x213: u32 = toU32(w213)
  const x214: u32 = toU32(w213 >> 32)
  const w215: u64 = p256FiatAddcarryxU32(x214, x167, x198)
  const x215: u32 = toU32(w215)
  const x216: u32 = toU32(w215 >> 32)
  const w217: u64 = p256FiatAddcarryxU32(x216, x169, x200)
  const x217: u32 = toU32(w217)
  const x218: u32 = toU32(w217 >> 32)
  const w219: u64 = p256FiatAddcarryxU32(x218, x171, x202)
  const x219: u32 = toU32(w219)
  const x220: u32 = toU32(w219 >> 32)
  const w221: u64 = p256FiatAddcarryxU32(x220, x173, x204)
  const x221: u32 = toU32(w221)
  const x222: u32 = toU32(w221 >> 32)
  const w223: u64 = p256FiatAddcarryxU32(x222, x175, x206)
  const x223: u32 = toU32(w223)
  const x224: u32 = toU32(w223 >> 32)
  const w225: u64 = p256FiatAddcarryxU32(x224, x177, x208)
  const x225: u32 = toU32(w225)
  const x226: u32 = toU32(w225 >> 32)
  const w227: u64 = p256FiatAddcarryxU32(x226, x179, x210)
  const x227: u32 = toU32(w227)
  const x228: u32 = toU32(w227 >> 32)
  const w229: u64 = p256FiatMulxU32(x211, 0xee00bc4f)
  const x229: u32 = toU32(w229)
  const w231: u64 = p256FiatMulxU32(x229, 0xffffffff)
  const x231: u32 = toU32(w231)
  const x232: u32 = toU32(w231 >> 32)
  const w233: u64 = p256FiatMulxU32(x229, 0xffffffff)
  const x233: u32 = toU32(w233)
  const x234: u32 = toU32(w233 >> 32)
  const w235: u64 = p256FiatMulxU32(x229, 0xffffffff)
  const x235: u32 = toU32(w235)
  const x236: u32 = toU32(w235 >> 32)
  const w237: u64 = p256FiatMulxU32(x229, 0xbce6faad)
  const x237: u32 = toU32(w237)
  const x238: u32 = toU32(w237 >> 32)
  const w239: u64 = p256FiatMulxU32(x229, 0xa7179e84)
  const x239: u32 = toU32(w239)
  const x240: u32 = toU32(w239 >> 32)
  const w241: u64 = p256FiatMulxU32(x229, 0xf3b9cac2)
  const x241: u32 = toU32(w241)
  const x242: u32 = toU32(w241 >> 32)
  const w243: u64 = p256FiatMulxU32(x229, 0xfc632551)
  const x243: u32 = toU32(w243)
  const x244: u32 = toU32(w243 >> 32)
  const w245: u64 = p256FiatAddcarryxU32(0x0, x244, x241)
  const x245: u32 = toU32(w245)
  const x246: u32 = toU32(w245 >> 32)
  const w247: u64 = p256FiatAddcarryxU32(x246, x242, x239)
  const x247: u32 = toU32(w247)
  const x248: u32 = toU32(w247 >> 32)
  const w249: u64 = p256FiatAddcarryxU32(x248, x240, x237)
  const x249: u32 = toU32(w249)
  const x250: u32 = toU32(w249 >> 32)
  const w251: u64 = p256FiatAddcarryxU32(x250, x238, x235)
  const x251: u32 = toU32(w251)
  const x252: u32 = toU32(w251 >> 32)
  const w253: u64 = p256FiatAddcarryxU32(x252, x236, x233)
  const x253: u32 = toU32(w253)
  const x254: u32 = toU32(w253 >> 32)
  const x255: u32 = x254 + x234
  const w256: u64 = p256FiatAddcarryxU32(0x0, x211, x243)
  const x257: u32 = toU32(w256 >> 32)
  const w258: u64 = p256FiatAddcarryxU32(x257, x213, x245)
  const x258: u32 = toU32(w258)
  const x259: u32 = toU32(w258 >> 32)
  const w260: u64 = p256FiatAddcarryxU32(x259, x215, x247)
  const x260: u32 = toU32(w260)
  const x261: u32 = toU32(w260 >> 32)
  const w262: u64 = p256FiatAddcarryxU32(x261, x217, x249)
  const x262: u32 = toU32(w262)
  const x263: u32 = toU32(w262 >> 32)
  const w264: u64 = p256FiatAddcarryxU32(x263, x219, x251)
  const x264: u32 = toU32(w264)
  const x265: u32 = toU32(w264 >> 32)
  const w266: u64 = p256FiatAddcarryxU32(x265, x221, x253)
  const x266: u32 = toU32(w266)
  const x267: u32 = toU32(w266 >> 32)
  const w268: u64 = p256FiatAddcarryxU32(x267, x223, x255)
  const x268: u32 = toU32(w268)
  const x269: u32 = toU32(w268 >> 32)
  const w270: u64 = p256FiatAddcarryxU32(x269, x225, x231)
  const x270: u32 = toU32(w270)
  const x271: u32 = toU32(w270 >> 32)
  const w272: u64 = p256FiatAddcarryxU32(x271, x227, x232)
  const x272: u32 = toU32(w272)
  const x273: u32 = toU32(w272 >> 32)
  const x274: u32 = x273 + x228
  const w275: u64 = p256FiatMulxU32(x3, arg2[7])
  const x275: u32 = toU32(w275)
  const x276: u32 = toU32(w275 >> 32)
  const w277: u64 = p256FiatMulxU32(x3, arg2[6])
  const x277: u32 = toU32(w277)
  const x278: u32 = toU32(w277 >> 32)
  const w279: u64 = p256FiatMulxU32(x3, arg2[5])
  const x279: u32 = toU32(w279)
  const x280: u32 = toU32(w279 >> 32)
  const w281: u64 = p256FiatMulxU32(x3, arg2[4])
  const x281: u32 = toU32(w281)
  const x282: u32 = toU32(w281 >> 32)
  const w283: u64 = p256FiatMulxU32(x3, arg2[3])
  const x283: u32 = toU32(w283)
  const x284: u32 = toU32(w283 >> 32)
  const w285: u64 = p256FiatMulxU32(x3, arg2[2])
  const x285: u32 = toU32(w285)
  const x286: u32 = toU32(w285 >> 32)
  const w287: u64 = p256FiatMulxU32(x3, arg2[1])
  const x287: u32 = toU32(w287)
  const x288: u32 = toU32(w287 >> 32)
  const w289: u64 = p256FiatMulxU32(x3, arg2[0])
  const x289: u32 = toU32(w289)
  const x290: u32 = toU32(w289 >> 32)
  const w291: u64 = p256FiatAddcarryxU32(0x0, x290, x287)
  const x291: u32 = toU32(w291)
  const x292: u32 = toU32(w291 >> 32)
  const w293: u64 = p256FiatAddcarryxU32(x292, x288, x285)
  const x293: u32 = toU32(w293)
  const x294: u32 = toU32(w293 >> 32)
  const w295: u64 = p256FiatAddcarryxU32(x294, x286, x283)
  const x295: u32 = toU32(w295)
  const x296: u32 = toU32(w295 >> 32)
  const w297: u64 = p256FiatAddcarryxU32(x296, x284, x281)
  const x297: u32 = toU32(w297)
  const x298: u32 = toU32(w297 >> 32)
  const w299: u64 = p256FiatAddcarryxU32(x298, x282, x279)
  const x299: u32 = toU32(w299)
  const x300: u32 = toU32(w299 >> 32)
  const w301: u64 = p256FiatAddcarryxU32(x300, x280, x277)
  const x301: u32 = toU32(w301)
  const x302: u32 = toU32(w301 >> 32)
  const w303: u64 = p256FiatAddcarryxU32(x302, x278, x275)
  const x303: u32 = toU32(w303)
  const x304: u32 = toU32(w303 >> 32)
  const x305: u32 = x304 + x276
  const w306: u64 = p256FiatAddcarryxU32(0x0, x258, x289)
  const x306: u32 = toU32(w306)
  const x307: u32 = toU32(w306 >> 32)
  const w308: u64 = p256FiatAddcarryxU32(x307, x260, x291)
  const x308: u32 = toU32(w308)
  const x309: u32 = toU32(w308 >> 32)
  const w310: u64 = p256FiatAddcarryxU32(x309, x262, x293)
  const x310: u32 = toU32(w310)
  const x311: u32 = toU32(w310 >> 32)
  const w312: u64 = p256FiatAddcarryxU32(x311, x264, x295)
  const x312: u32 = toU32(w312)
  const x313: u32 = toU32(w312 >> 32)
  const w314: u64 = p256FiatAddcarryxU32(x313, x266, x297)
  const x314: u32 = toU32(w314)
  const x315: u32 = toU32(w314 >> 32)
  const w316: u64 = p256FiatAddcarryxU32(x315, x268, x299)
  const x316: u32 = toU32(w316)
  const x317: u32 = toU32(w316 >> 32)
  const w318: u64 = p256FiatAddcarryxU32(x317, x270, x301)
  const x318: u32 = toU32(w318)
  const x319: u32 = toU32(w318 >> 32)
  const w320: u64 = p256FiatAddcarryxU32(x319, x272, x303)
  const x320: u32 = toU32(w320)
  const x321: u32 = toU32(w320 >> 32)
  const w322: u64 = p256FiatAddcarryxU32(x321, x274, x305)
  const x322: u32 = toU32(w322)
  const x323: u32 = toU32(w322 >> 32)
  const w324: u64 = p256FiatMulxU32(x306, 0xee00bc4f)
  const x324: u32 = toU32(w324)
  const w326: u64 = p256FiatMulxU32(x324, 0xffffffff)
  const x326: u32 = toU32(w326)
  const x327: u32 = toU32(w326 >> 32)
  const w328: u64 = p256FiatMulxU32(x324, 0xffffffff)
  const x328: u32 = toU32(w328)
  const x329: u32 = toU32(w328 >> 32)
  const w330: u64 = p256FiatMulxU32(x324, 0xffffffff)
  const x330: u32 = toU32(w330)
  const x331: u32 = toU32(w330 >> 32)
  const w332: u64 = p256FiatMulxU32(x324, 0xbce6faad)
  const x332: u32 = toU32(w332)
  const x333: u32 = toU32(w332 >> 32)
  const w334: u64 = p256FiatMulxU32(x324, 0xa7179e84)
  const x334: u32 = toU32(w334)
  const x335: u32 = toU32(w334 >> 32)
  const w336: u64 = p256FiatMulxU32(x324, 0xf3b9cac2)
  const x336: u32 = toU32(w336)
  const x337: u32 = toU32(w336 >> 32)
  const w338: u64 = p256FiatMulxU32(x324, 0xfc632551)
  const x338: u32 = toU32(w338)
  const x339: u32 = toU32(w338 >> 32)
  const w340: u64 = p256FiatAddcarryxU32(0x0, x339, x336)
  const x340: u32 = toU32(w340)
  const x341: u32 = toU32(w340 >> 32)
  const w342: u64 = p256FiatAddcarryxU32(x341, x337, x334)
  const x342: u32 = toU32(w342)
  const x343: u32 = toU32(w342 >> 32)
  const w344: u64 = p256FiatAddcarryxU32(x343, x335, x332)
  const x344: u32 = toU32(w344)
  const x345: u32 = toU32(w344 >> 32)
  const w346: u64 = p256FiatAddcarryxU32(x345, x333, x330)
  const x346: u32 = toU32(w346)
  const x347: u32 = toU32(w346 >> 32)
  const w348: u64 = p256FiatAddcarryxU32(x347, x331, x328)
  const x348: u32 = toU32(w348)
  const x349: u32 = toU32(w348 >> 32)
  const x350: u32 = x349 + x329
  const w351: u64 = p256FiatAddcarryxU32(0x0, x306, x338)
  const x352: u32 = toU32(w351 >> 32)
  const w353: u64 = p256FiatAddcarryxU32(x352, x308, x340)
  const x353: u32 = toU32(w353)
  const x354: u32 = toU32(w353 >> 32)
  const w355: u64 = p256FiatAddcarryxU32(x354, x310, x342)
  const x355: u32 = toU32(w355)
  const x356: u32 = toU32(w355 >> 32)
  const w357: u64 = p256FiatAddcarryxU32(x356, x312, x344)
  const x357: u32 = toU32(w357)
  const x358: u32 = toU32(w357 >> 32)
  const w359: u64 = p256FiatAddcarryxU32(x358, x314, x346)
  const x359: u32 = toU32(w359)
  const x360: u32 = toU32(w359 >> 32)
  const w361: u64 = p256FiatAddcarryxU32(x360, x316, x348)
  const x361: u32 = toU32(w361)
  const x362: u32 = toU32(w361 >> 32)
  const w363: u64 = p256FiatAddcarryxU32(x362, x318, x350)
  const x363: u32 = toU32(w363)
  const x364: u32 = toU32(w363 >> 32)
  const w365: u64 = p256FiatAddcarryxU32(x364, x320, x326)
  const x365: u32 = toU32(w365)
  const x366: u32 = toU32(w365 >> 32)
  const w367: u64 = p256FiatAddcarryxU32(x366, x322, x327)
  const x367: u32 = toU32(w367)
  const x368: u32 = toU32(w367 >> 32)
  const x369: u32 = x368 + x323
  const w370: u64 = p256FiatMulxU32(x4, arg2[7])
  const x370: u32 = toU32(w370)
  const x371: u32 = toU32(w370 >> 32)
  const w372: u64 = p256FiatMulxU32(x4, arg2[6])
  const x372: u32 = toU32(w372)
  const x373: u32 = toU32(w372 >> 32)
  const w374: u64 = p256FiatMulxU32(x4, arg2[5])
  const x374: u32 = toU32(w374)
  const x375: u32 = toU32(w374 >> 32)
  const w376: u64 = p256FiatMulxU32(x4, arg2[4])
  const x376: u32 = toU32(w376)
  const x377: u32 = toU32(w376 >> 32)
  const w378: u64 = p256FiatMulxU32(x4, arg2[3])
  const x378: u32 = toU32(w378)
  const x379: u32 = toU32(w378 >> 32)
  const w380: u64 = p256FiatMulxU32(x4, arg2[2])
  const x380: u32 = toU32(w380)
  const x381: u32 = toU32(w380 >> 32)
  const w382: u64 = p256FiatMulxU32(x4, arg2[1])
  const x382: u32 = toU32(w382)
  const x383: u32 = toU32(w382 >> 32)
  const w384: u64 = p256FiatMulxU32(x4, arg2[0])
  const x384: u32 = toU32(w384)
  const x385: u32 = toU32(w384 >> 32)
  const w386: u64 = p256FiatAddcarryxU32(0x0, x385, x382)
  const x386: u32 = toU32(w386)
  const x387: u32 = toU32(w386 >> 32)
  const w388: u64 = p256FiatAddcarryxU32(x387, x383, x380)
  const x388: u32 = toU32(w388)
  const x389: u32 = toU32(w388 >> 32)
  const w390: u64 = p256FiatAddcarryxU32(x389, x381, x378)
  const x390: u32 = toU32(w390)
  const x391: u32 = toU32(w390 >> 32)
  const w392: u64 = p256FiatAddcarryxU32(x391, x379, x376)
  const x392: u32 = toU32(w392)
  const x393: u32 = toU32(w392 >> 32)
  const w394: u64 = p256FiatAddcarryxU32(x393, x377, x374)
  const x394: u32 = toU32(w394)
  const x395: u32 = toU32(w394 >> 32)
  const w396: u64 = p256FiatAddcarryxU32(x395, x375, x372)
  const x396: u32 = toU32(w396)
  const x397: u32 = toU32(w396 >> 32)
  const w398: u64 = p256FiatAddcarryxU32(x397, x373, x370)
  const x398: u32 = toU32(w398)
  const x399: u32 = toU32(w398 >> 32)
  const x400: u32 = x399 + x371
  const w401: u64 = p256FiatAddcarryxU32(0x0, x353, x384)
  const x401: u32 = toU32(w401)
  const x402: u32 = toU32(w401 >> 32)
  const w403: u64 = p256FiatAddcarryxU32(x402, x355, x386)
  const x403: u32 = toU32(w403)
  const x404: u32 = toU32(w403 >> 32)
  const w405: u64 = p256FiatAddcarryxU32(x404, x357, x388)
  const x405: u32 = toU32(w405)
  const x406: u32 = toU32(w405 >> 32)
  const w407: u64 = p256FiatAddcarryxU32(x406, x359, x390)
  const x407: u32 = toU32(w407)
  const x408: u32 = toU32(w407 >> 32)
  const w409: u64 = p256FiatAddcarryxU32(x408, x361, x392)
  const x409: u32 = toU32(w409)
  const x410: u32 = toU32(w409 >> 32)
  const w411: u64 = p256FiatAddcarryxU32(x410, x363, x394)
  const x411: u32 = toU32(w411)
  const x412: u32 = toU32(w411 >> 32)
  const w413: u64 = p256FiatAddcarryxU32(x412, x365, x396)
  const x413: u32 = toU32(w413)
  const x414: u32 = toU32(w413 >> 32)
  const w415: u64 = p256FiatAddcarryxU32(x414, x367, x398)
  const x415: u32 = toU32(w415)
  const x416: u32 = toU32(w415 >> 32)
  const w417: u64 = p256FiatAddcarryxU32(x416, x369, x400)
  const x417: u32 = toU32(w417)
  const x418: u32 = toU32(w417 >> 32)
  const w419: u64 = p256FiatMulxU32(x401, 0xee00bc4f)
  const x419: u32 = toU32(w419)
  const w421: u64 = p256FiatMulxU32(x419, 0xffffffff)
  const x421: u32 = toU32(w421)
  const x422: u32 = toU32(w421 >> 32)
  const w423: u64 = p256FiatMulxU32(x419, 0xffffffff)
  const x423: u32 = toU32(w423)
  const x424: u32 = toU32(w423 >> 32)
  const w425: u64 = p256FiatMulxU32(x419, 0xffffffff)
  const x425: u32 = toU32(w425)
  const x426: u32 = toU32(w425 >> 32)
  const w427: u64 = p256FiatMulxU32(x419, 0xbce6faad)
  const x427: u32 = toU32(w427)
  const x428: u32 = toU32(w427 >> 32)
  const w429: u64 = p256FiatMulxU32(x419, 0xa7179e84)
  const x429: u32 = toU32(w429)
  const x430: u32 = toU32(w429 >> 32)
  const w431: u64 = p256FiatMulxU32(x419, 0xf3b9cac2)
  const x431: u32 = toU32(w431)
  const x432: u32 = toU32(w431 >> 32)
  const w433: u64 = p256FiatMulxU32(x419, 0xfc632551)
  const x433: u32 = toU32(w433)
  const x434: u32 = toU32(w433 >> 32)
  const w435: u64 = p256FiatAddcarryxU32(0x0, x434, x431)
  const x435: u32 = toU32(w435)
  const x436: u32 = toU32(w435 >> 32)
  const w437: u64 = p256FiatAddcarryxU32(x436, x432, x429)
  const x437: u32 = toU32(w437)
  const x438: u32 = toU32(w437 >> 32)
  const w439: u64 = p256FiatAddcarryxU32(x438, x430, x427)
  const x439: u32 = toU32(w439)
  const x440: u32 = toU32(w439 >> 32)
  const w441: u64 = p256FiatAddcarryxU32(x440, x428, x425)
  const x441: u32 = toU32(w441)
  const x442: u32 = toU32(w441 >> 32)
  const w443: u64 = p256FiatAddcarryxU32(x442, x426, x423)
  const x443: u32 = toU32(w443)
  const x444: u32 = toU32(w443 >> 32)
  const x445: u32 = x444 + x424
  const w446: u64 = p256FiatAddcarryxU32(0x0, x401, x433)
  const x447: u32 = toU32(w446 >> 32)
  const w448: u64 = p256FiatAddcarryxU32(x447, x403, x435)
  const x448: u32 = toU32(w448)
  const x449: u32 = toU32(w448 >> 32)
  const w450: u64 = p256FiatAddcarryxU32(x449, x405, x437)
  const x450: u32 = toU32(w450)
  const x451: u32 = toU32(w450 >> 32)
  const w452: u64 = p256FiatAddcarryxU32(x451, x407, x439)
  const x452: u32 = toU32(w452)
  const x453: u32 = toU32(w452 >> 32)
  const w454: u64 = p256FiatAddcarryxU32(x453, x409, x441)
  const x454: u32 = toU32(w454)
  const x455: u32 = toU32(w454 >> 32)
  const w456: u64 = p256FiatAddcarryxU32(x455, x411, x443)
  const x456: u32 = toU32(w456)
  const x457: u32 = toU32(w456 >> 32)
  const w458: u64 = p256FiatAddcarryxU32(x457, x413, x445)
  const x458: u32 = toU32(w458)
  const x459: u32 = toU32(w458 >> 32)
  const w460: u64 = p256FiatAddcarryxU32(x459, x415, x421)
  const x460: u32 = toU32(w460)
  const x461: u32 = toU32(w460 >> 32)
  const w462: u64 = p256FiatAddcarryxU32(x461, x417, x422)
  const x462: u32 = toU32(w462)
  const x463: u32 = toU32(w462 >> 32)
  const x464: u32 = x463 + x418
  const w465: u64 = p256FiatMulxU32(x5, arg2[7])
  const x465: u32 = toU32(w465)
  const x466: u32 = toU32(w465 >> 32)
  const w467: u64 = p256FiatMulxU32(x5, arg2[6])
  const x467: u32 = toU32(w467)
  const x468: u32 = toU32(w467 >> 32)
  const w469: u64 = p256FiatMulxU32(x5, arg2[5])
  const x469: u32 = toU32(w469)
  const x470: u32 = toU32(w469 >> 32)
  const w471: u64 = p256FiatMulxU32(x5, arg2[4])
  const x471: u32 = toU32(w471)
  const x472: u32 = toU32(w471 >> 32)
  const w473: u64 = p256FiatMulxU32(x5, arg2[3])
  const x473: u32 = toU32(w473)
  const x474: u32 = toU32(w473 >> 32)
  const w475: u64 = p256FiatMulxU32(x5, arg2[2])
  const x475: u32 = toU32(w475)
  const x476: u32 = toU32(w475 >> 32)
  const w477: u64 = p256FiatMulxU32(x5, arg2[1])
  const x477: u32 = toU32(w477)
  const x478: u32 = toU32(w477 >> 32)
  const w479: u64 = p256FiatMulxU32(x5, arg2[0])
  const x479: u32 = toU32(w479)
  const x480: u32 = toU32(w479 >> 32)
  const w481: u64 = p256FiatAddcarryxU32(0x0, x480, x477)
  const x481: u32 = toU32(w481)
  const x482: u32 = toU32(w481 >> 32)
  const w483: u64 = p256FiatAddcarryxU32(x482, x478, x475)
  const x483: u32 = toU32(w483)
  const x484: u32 = toU32(w483 >> 32)
  const w485: u64 = p256FiatAddcarryxU32(x484, x476, x473)
  const x485: u32 = toU32(w485)
  const x486: u32 = toU32(w485 >> 32)
  const w487: u64 = p256FiatAddcarryxU32(x486, x474, x471)
  const x487: u32 = toU32(w487)
  const x488: u32 = toU32(w487 >> 32)
  const w489: u64 = p256FiatAddcarryxU32(x488, x472, x469)
  const x489: u32 = toU32(w489)
  const x490: u32 = toU32(w489 >> 32)
  const w491: u64 = p256FiatAddcarryxU32(x490, x470, x467)
  const x491: u32 = toU32(w491)
  const x492: u32 = toU32(w491 >> 32)
  const w493: u64 = p256FiatAddcarryxU32(x492, x468, x465)
  const x493: u32 = toU32(w493)
  const x494: u32 = toU32(w493 >> 32)
  const x495: u32 = x494 + x466
  const w496: u64 = p256FiatAddcarryxU32(0x0, x448, x479)
  const x496: u32 = toU32(w496)
  const x497: u32 = toU32(w496 >> 32)
  const w498: u64 = p256FiatAddcarryxU32(x497, x450, x481)
  const x498: u32 = toU32(w498)
  const x499: u32 = toU32(w498 >> 32)
  const w500: u64 = p256FiatAddcarryxU32(x499, x452, x483)
  const x500: u32 = toU32(w500)
  const x501: u32 = toU32(w500 >> 32)
  const w502: u64 = p256FiatAddcarryxU32(x501, x454, x485)
  const x502: u32 = toU32(w502)
  const x503: u32 = toU32(w502 >> 32)
  const w504: u64 = p256FiatAddcarryxU32(x503, x456, x487)
  const x504: u32 = toU32(w504)
  const x505: u32 = toU32(w504 >> 32)
  const w506: u64 = p256FiatAddcarryxU32(x505, x458, x489)
  const x506: u32 = toU32(w506)
  const x507: u32 = toU32(w506 >> 32)
  const w508: u64 = p256FiatAddcarryxU32(x507, x460, x491)
  const x508: u32 = toU32(w508)
  const x509: u32 = toU32(w508 >> 32)
  const w510: u64 = p256FiatAddcarryxU32(x509, x462, x493)
  const x510: u32 = toU32(w510)
  const x511: u32 = toU32(w510 >> 32)
  const w512: u64 = p256FiatAddcarryxU32(x511, x464, x495)
  const x512: u32 = toU32(w512)
  const x513: u32 = toU32(w512 >> 32)
  const w514: u64 = p256FiatMulxU32(x496, 0xee00bc4f)
  const x514: u32 = toU32(w514)
  const w516: u64 = p256FiatMulxU32(x514, 0xffffffff)
  const x516: u32 = toU32(w516)
  const x517: u32 = toU32(w516 >> 32)
  const w518: u64 = p256FiatMulxU32(x514, 0xffffffff)
  const x518: u32 = toU32(w518)
  const x519: u32 = toU32(w518 >> 32)
  const w520: u64 = p256FiatMulxU32(x514, 0xffffffff)
  const x520: u32 = toU32(w520)
  const x521: u32 = toU32(w520 >> 32)
  const w522: u64 = p256FiatMulxU32(x514, 0xbce6faad)
  const x522: u32 = toU32(w522)
  const x523: u32 = toU32(w522 >> 32)
  const w524: u64 = p256FiatMulxU32(x514, 0xa7179e84)
  const x524: u32 = toU32(w524)
  const x525: u32 = toU32(w524 >> 32)
  const w526: u64 = p256FiatMulxU32(x514, 0xf3b9cac2)
  const x526: u32 = toU32(w526)
  const x527: u32 = toU32(w526 >> 32)
  const w528: u64 = p256FiatMulxU32(x514, 0xfc632551)
  const x528: u32 = toU32(w528)
  const x529: u32 = toU32(w528 >> 32)
  const w530: u64 = p256FiatAddcarryxU32(0x0, x529, x526)
  const x530: u32 = toU32(w530)
  const x531: u32 = toU32(w530 >> 32)
  const w532: u64 = p256FiatAddcarryxU32(x531, x527, x524)
  const x532: u32 = toU32(w532)
  const x533: u32 = toU32(w532 >> 32)
  const w534: u64 = p256FiatAddcarryxU32(x533, x525, x522)
  const x534: u32 = toU32(w534)
  const x535: u32 = toU32(w534 >> 32)
  const w536: u64 = p256FiatAddcarryxU32(x535, x523, x520)
  const x536: u32 = toU32(w536)
  const x537: u32 = toU32(w536 >> 32)
  const w538: u64 = p256FiatAddcarryxU32(x537, x521, x518)
  const x538: u32 = toU32(w538)
  const x539: u32 = toU32(w538 >> 32)
  const x540: u32 = x539 + x519
  const w541: u64 = p256FiatAddcarryxU32(0x0, x496, x528)
  const x542: u32 = toU32(w541 >> 32)
  const w543: u64 = p256FiatAddcarryxU32(x542, x498, x530)
  const x543: u32 = toU32(w543)
  const x544: u32 = toU32(w543 >> 32)
  const w545: u64 = p256FiatAddcarryxU32(x544, x500, x532)
  const x545: u32 = toU32(w545)
  const x546: u32 = toU32(w545 >> 32)
  const w547: u64 = p256FiatAddcarryxU32(x546, x502, x534)
  const x547: u32 = toU32(w547)
  const x548: u32 = toU32(w547 >> 32)
  const w549: u64 = p256FiatAddcarryxU32(x548, x504, x536)
  const x549: u32 = toU32(w549)
  const x550: u32 = toU32(w549 >> 32)
  const w551: u64 = p256FiatAddcarryxU32(x550, x506, x538)
  const x551: u32 = toU32(w551)
  const x552: u32 = toU32(w551 >> 32)
  const w553: u64 = p256FiatAddcarryxU32(x552, x508, x540)
  const x553: u32 = toU32(w553)
  const x554: u32 = toU32(w553 >> 32)
  const w555: u64 = p256FiatAddcarryxU32(x554, x510, x516)
  const x555: u32 = toU32(w555)
  const x556: u32 = toU32(w555 >> 32)
  const w557: u64 = p256FiatAddcarryxU32(x556, x512, x517)
  const x557: u32 = toU32(w557)
  const x558: u32 = toU32(w557 >> 32)
  const x559: u32 = x558 + x513
  const w560: u64 = p256FiatMulxU32(x6, arg2[7])
  const x560: u32 = toU32(w560)
  const x561: u32 = toU32(w560 >> 32)
  const w562: u64 = p256FiatMulxU32(x6, arg2[6])
  const x562: u32 = toU32(w562)
  const x563: u32 = toU32(w562 >> 32)
  const w564: u64 = p256FiatMulxU32(x6, arg2[5])
  const x564: u32 = toU32(w564)
  const x565: u32 = toU32(w564 >> 32)
  const w566: u64 = p256FiatMulxU32(x6, arg2[4])
  const x566: u32 = toU32(w566)
  const x567: u32 = toU32(w566 >> 32)
  const w568: u64 = p256FiatMulxU32(x6, arg2[3])
  const x568: u32 = toU32(w568)
  const x569: u32 = toU32(w568 >> 32)
  const w570: u64 = p256FiatMulxU32(x6, arg2[2])
  const x570: u32 = toU32(w570)
  const x571: u32 = toU32(w570 >> 32)
  const w572: u64 = p256FiatMulxU32(x6, arg2[1])
  const x572: u32 = toU32(w572)
  const x573: u32 = toU32(w572 >> 32)
  const w574: u64 = p256FiatMulxU32(x6, arg2[0])
  const x574: u32 = toU32(w574)
  const x575: u32 = toU32(w574 >> 32)
  const w576: u64 = p256FiatAddcarryxU32(0x0, x575, x572)
  const x576: u32 = toU32(w576)
  const x577: u32 = toU32(w576 >> 32)
  const w578: u64 = p256FiatAddcarryxU32(x577, x573, x570)
  const x578: u32 = toU32(w578)
  const x579: u32 = toU32(w578 >> 32)
  const w580: u64 = p256FiatAddcarryxU32(x579, x571, x568)
  const x580: u32 = toU32(w580)
  const x581: u32 = toU32(w580 >> 32)
  const w582: u64 = p256FiatAddcarryxU32(x581, x569, x566)
  const x582: u32 = toU32(w582)
  const x583: u32 = toU32(w582 >> 32)
  const w584: u64 = p256FiatAddcarryxU32(x583, x567, x564)
  const x584: u32 = toU32(w584)
  const x585: u32 = toU32(w584 >> 32)
  const w586: u64 = p256FiatAddcarryxU32(x585, x565, x562)
  const x586: u32 = toU32(w586)
  const x587: u32 = toU32(w586 >> 32)
  const w588: u64 = p256FiatAddcarryxU32(x587, x563, x560)
  const x588: u32 = toU32(w588)
  const x589: u32 = toU32(w588 >> 32)
  const x590: u32 = x589 + x561
  const w591: u64 = p256FiatAddcarryxU32(0x0, x543, x574)
  const x591: u32 = toU32(w591)
  const x592: u32 = toU32(w591 >> 32)
  const w593: u64 = p256FiatAddcarryxU32(x592, x545, x576)
  const x593: u32 = toU32(w593)
  const x594: u32 = toU32(w593 >> 32)
  const w595: u64 = p256FiatAddcarryxU32(x594, x547, x578)
  const x595: u32 = toU32(w595)
  const x596: u32 = toU32(w595 >> 32)
  const w597: u64 = p256FiatAddcarryxU32(x596, x549, x580)
  const x597: u32 = toU32(w597)
  const x598: u32 = toU32(w597 >> 32)
  const w599: u64 = p256FiatAddcarryxU32(x598, x551, x582)
  const x599: u32 = toU32(w599)
  const x600: u32 = toU32(w599 >> 32)
  const w601: u64 = p256FiatAddcarryxU32(x600, x553, x584)
  const x601: u32 = toU32(w601)
  const x602: u32 = toU32(w601 >> 32)
  const w603: u64 = p256FiatAddcarryxU32(x602, x555, x586)
  const x603: u32 = toU32(w603)
  const x604: u32 = toU32(w603 >> 32)
  const w605: u64 = p256FiatAddcarryxU32(x604, x557, x588)
  const x605: u32 = toU32(w605)
  const x606: u32 = toU32(w605 >> 32)
  const w607: u64 = p256FiatAddcarryxU32(x606, x559, x590)
  const x607: u32 = toU32(w607)
  const x608: u32 = toU32(w607 >> 32)
  const w609: u64 = p256FiatMulxU32(x591, 0xee00bc4f)
  const x609: u32 = toU32(w609)
  const w611: u64 = p256FiatMulxU32(x609, 0xffffffff)
  const x611: u32 = toU32(w611)
  const x612: u32 = toU32(w611 >> 32)
  const w613: u64 = p256FiatMulxU32(x609, 0xffffffff)
  const x613: u32 = toU32(w613)
  const x614: u32 = toU32(w613 >> 32)
  const w615: u64 = p256FiatMulxU32(x609, 0xffffffff)
  const x615: u32 = toU32(w615)
  const x616: u32 = toU32(w615 >> 32)
  const w617: u64 = p256FiatMulxU32(x609, 0xbce6faad)
  const x617: u32 = toU32(w617)
  const x618: u32 = toU32(w617 >> 32)
  const w619: u64 = p256FiatMulxU32(x609, 0xa7179e84)
  const x619: u32 = toU32(w619)
  const x620: u32 = toU32(w619 >> 32)
  const w621: u64 = p256FiatMulxU32(x609, 0xf3b9cac2)
  const x621: u32 = toU32(w621)
  const x622: u32 = toU32(w621 >> 32)
  const w623: u64 = p256FiatMulxU32(x609, 0xfc632551)
  const x623: u32 = toU32(w623)
  const x624: u32 = toU32(w623 >> 32)
  const w625: u64 = p256FiatAddcarryxU32(0x0, x624, x621)
  const x625: u32 = toU32(w625)
  const x626: u32 = toU32(w625 >> 32)
  const w627: u64 = p256FiatAddcarryxU32(x626, x622, x619)
  const x627: u32 = toU32(w627)
  const x628: u32 = toU32(w627 >> 32)
  const w629: u64 = p256FiatAddcarryxU32(x628, x620, x617)
  const x629: u32 = toU32(w629)
  const x630: u32 = toU32(w629 >> 32)
  const w631: u64 = p256FiatAddcarryxU32(x630, x618, x615)
  const x631: u32 = toU32(w631)
  const x632: u32 = toU32(w631 >> 32)
  const w633: u64 = p256FiatAddcarryxU32(x632, x616, x613)
  const x633: u32 = toU32(w633)
  const x634: u32 = toU32(w633 >> 32)
  const x635: u32 = x634 + x614
  const w636: u64 = p256FiatAddcarryxU32(0x0, x591, x623)
  const x637: u32 = toU32(w636 >> 32)
  const w638: u64 = p256FiatAddcarryxU32(x637, x593, x625)
  const x638: u32 = toU32(w638)
  const x639: u32 = toU32(w638 >> 32)
  const w640: u64 = p256FiatAddcarryxU32(x639, x595, x627)
  const x640: u32 = toU32(w640)
  const x641: u32 = toU32(w640 >> 32)
  const w642: u64 = p256FiatAddcarryxU32(x641, x597, x629)
  const x642: u32 = toU32(w642)
  const x643: u32 = toU32(w642 >> 32)
  const w644: u64 = p256FiatAddcarryxU32(x643, x599, x631)
  const x644: u32 = toU32(w644)
  const x645: u32 = toU32(w644 >> 32)
  const w646: u64 = p256FiatAddcarryxU32(x645, x601, x633)
  const x646: u32 = toU32(w646)
  const x647: u32 = toU32(w646 >> 32)
  const w648: u64 = p256FiatAddcarryxU32(x647, x603, x635)
  const x648: u32 = toU32(w648)
  const x649: u32 = toU32(w648 >> 32)
  const w650: u64 = p256FiatAddcarryxU32(x649, x605, x611)
  const x650: u32 = toU32(w650)
  const x651: u32 = toU32(w650 >> 32)
  const w652: u64 = p256FiatAddcarryxU32(x651, x607, x612)
  const x652: u32 = toU32(w652)
  const x653: u32 = toU32(w652 >> 32)
  const x654: u32 = x653 + x608
  const w655: u64 = p256FiatMulxU32(x7, arg2[7])
  const x655: u32 = toU32(w655)
  const x656: u32 = toU32(w655 >> 32)
  const w657: u64 = p256FiatMulxU32(x7, arg2[6])
  const x657: u32 = toU32(w657)
  const x658: u32 = toU32(w657 >> 32)
  const w659: u64 = p256FiatMulxU32(x7, arg2[5])
  const x659: u32 = toU32(w659)
  const x660: u32 = toU32(w659 >> 32)
  const w661: u64 = p256FiatMulxU32(x7, arg2[4])
  const x661: u32 = toU32(w661)
  const x662: u32 = toU32(w661 >> 32)
  const w663: u64 = p256FiatMulxU32(x7, arg2[3])
  const x663: u32 = toU32(w663)
  const x664: u32 = toU32(w663 >> 32)
  const w665: u64 = p256FiatMulxU32(x7, arg2[2])
  const x665: u32 = toU32(w665)
  const x666: u32 = toU32(w665 >> 32)
  const w667: u64 = p256FiatMulxU32(x7, arg2[1])
  const x667: u32 = toU32(w667)
  const x668: u32 = toU32(w667 >> 32)
  const w669: u64 = p256FiatMulxU32(x7, arg2[0])
  const x669: u32 = toU32(w669)
  const x670: u32 = toU32(w669 >> 32)
  const w671: u64 = p256FiatAddcarryxU32(0x0, x670, x667)
  const x671: u32 = toU32(w671)
  const x672: u32 = toU32(w671 >> 32)
  const w673: u64 = p256FiatAddcarryxU32(x672, x668, x665)
  const x673: u32 = toU32(w673)
  const x674: u32 = toU32(w673 >> 32)
  const w675: u64 = p256FiatAddcarryxU32(x674, x666, x663)
  const x675: u32 = toU32(w675)
  const x676: u32 = toU32(w675 >> 32)
  const w677: u64 = p256FiatAddcarryxU32(x676, x664, x661)
  const x677: u32 = toU32(w677)
  const x678: u32 = toU32(w677 >> 32)
  const w679: u64 = p256FiatAddcarryxU32(x678, x662, x659)
  const x679: u32 = toU32(w679)
  const x680: u32 = toU32(w679 >> 32)
  const w681: u64 = p256FiatAddcarryxU32(x680, x660, x657)
  const x681: u32 = toU32(w681)
  const x682: u32 = toU32(w681 >> 32)
  const w683: u64 = p256FiatAddcarryxU32(x682, x658, x655)
  const x683: u32 = toU32(w683)
  const x684: u32 = toU32(w683 >> 32)
  const x685: u32 = x684 + x656
  const w686: u64 = p256FiatAddcarryxU32(0x0, x638, x669)
  const x686: u32 = toU32(w686)
  const x687: u32 = toU32(w686 >> 32)
  const w688: u64 = p256FiatAddcarryxU32(x687, x640, x671)
  const x688: u32 = toU32(w688)
  const x689: u32 = toU32(w688 >> 32)
  const w690: u64 = p256FiatAddcarryxU32(x689, x642, x673)
  const x690: u32 = toU32(w690)
  const x691: u32 = toU32(w690 >> 32)
  const w692: u64 = p256FiatAddcarryxU32(x691, x644, x675)
  const x692: u32 = toU32(w692)
  const x693: u32 = toU32(w692 >> 32)
  const w694: u64 = p256FiatAddcarryxU32(x693, x646, x677)
  const x694: u32 = toU32(w694)
  const x695: u32 = toU32(w694 >> 32)
  const w696: u64 = p256FiatAddcarryxU32(x695, x648, x679)
  const x696: u32 = toU32(w696)
  const x697: u32 = toU32(w696 >> 32)
  const w698: u64 = p256FiatAddcarryxU32(x697, x650, x681)
  const x698: u32 = toU32(w698)
  const x699: u32 = toU32(w698 >> 32)
  const w700: u64 = p256FiatAddcarryxU32(x699, x652, x683)
  const x700: u32 = toU32(w700)
  const x701: u32 = toU32(w700 >> 32)
  const w702: u64 = p256FiatAddcarryxU32(x701, x654, x685)
  const x702: u32 = toU32(w702)
  const x703: u32 = toU32(w702 >> 32)
  const w704: u64 = p256FiatMulxU32(x686, 0xee00bc4f)
  const x704: u32 = toU32(w704)
  const w706: u64 = p256FiatMulxU32(x704, 0xffffffff)
  const x706: u32 = toU32(w706)
  const x707: u32 = toU32(w706 >> 32)
  const w708: u64 = p256FiatMulxU32(x704, 0xffffffff)
  const x708: u32 = toU32(w708)
  const x709: u32 = toU32(w708 >> 32)
  const w710: u64 = p256FiatMulxU32(x704, 0xffffffff)
  const x710: u32 = toU32(w710)
  const x711: u32 = toU32(w710 >> 32)
  const w712: u64 = p256FiatMulxU32(x704, 0xbce6faad)
  const x712: u32 = toU32(w712)
  const x713: u32 = toU32(w712 >> 32)
  const w714: u64 = p256FiatMulxU32(x704, 0xa7179e84)
  const x714: u32 = toU32(w714)
  const x715: u32 = toU32(w714 >> 32)
  const w716: u64 = p256FiatMulxU32(x704, 0xf3b9cac2)
  const x716: u32 = toU32(w716)
  const x717: u32 = toU32(w716 >> 32)
  const w718: u64 = p256FiatMulxU32(x704, 0xfc632551)
  const x718: u32 = toU32(w718)
  const x719: u32 = toU32(w718 >> 32)
  const w720: u64 = p256FiatAddcarryxU32(0x0, x719, x716)
  const x720: u32 = toU32(w720)
  const x721: u32 = toU32(w720 >> 32)
  const w722: u64 = p256FiatAddcarryxU32(x721, x717, x714)
  const x722: u32 = toU32(w722)
  const x723: u32 = toU32(w722 >> 32)
  const w724: u64 = p256FiatAddcarryxU32(x723, x715, x712)
  const x724: u32 = toU32(w724)
  const x725: u32 = toU32(w724 >> 32)
  const w726: u64 = p256FiatAddcarryxU32(x725, x713, x710)
  const x726: u32 = toU32(w726)
  const x727: u32 = toU32(w726 >> 32)
  const w728: u64 = p256FiatAddcarryxU32(x727, x711, x708)
  const x728: u32 = toU32(w728)
  const x729: u32 = toU32(w728 >> 32)
  const x730: u32 = x729 + x709
  const w731: u64 = p256FiatAddcarryxU32(0x0, x686, x718)
  const x732: u32 = toU32(w731 >> 32)
  const w733: u64 = p256FiatAddcarryxU32(x732, x688, x720)
  const x733: u32 = toU32(w733)
  const x734: u32 = toU32(w733 >> 32)
  const w735: u64 = p256FiatAddcarryxU32(x734, x690, x722)
  const x735: u32 = toU32(w735)
  const x736: u32 = toU32(w735 >> 32)
  const w737: u64 = p256FiatAddcarryxU32(x736, x692, x724)
  const x737: u32 = toU32(w737)
  const x738: u32 = toU32(w737 >> 32)
  const w739: u64 = p256FiatAddcarryxU32(x738, x694, x726)
  const x739: u32 = toU32(w739)
  const x740: u32 = toU32(w739 >> 32)
  const w741: u64 = p256FiatAddcarryxU32(x740, x696, x728)
  const x741: u32 = toU32(w741)
  const x742: u32 = toU32(w741 >> 32)
  const w743: u64 = p256FiatAddcarryxU32(x742, x698, x730)
  const x743: u32 = toU32(w743)
  const x744: u32 = toU32(w743 >> 32)
  const w745: u64 = p256FiatAddcarryxU32(x744, x700, x706)
  const x745: u32 = toU32(w745)
  const x746: u32 = toU32(w745 >> 32)
  const w747: u64 = p256FiatAddcarryxU32(x746, x702, x707)
  const x747: u32 = toU32(w747)
  const x748: u32 = toU32(w747 >> 32)
  const x749: u32 = x748 + x703
  const w750: u64 = p256FiatSubborrowxU32(0x0, x733, 0xfc632551)
  const x750: u32 = toU32(w750)
  const x751: u32 = toU32(w750 >> 32)
  const w752: u64 = p256FiatSubborrowxU32(x751, x735, 0xf3b9cac2)
  const x752: u32 = toU32(w752)
  const x753: u32 = toU32(w752 >> 32)
  const w754: u64 = p256FiatSubborrowxU32(x753, x737, 0xa7179e84)
  const x754: u32 = toU32(w754)
  const x755: u32 = toU32(w754 >> 32)
  const w756: u64 = p256FiatSubborrowxU32(x755, x739, 0xbce6faad)
  const x756: u32 = toU32(w756)
  const x757: u32 = toU32(w756 >> 32)
  const w758: u64 = p256FiatSubborrowxU32(x757, x741, 0xffffffff)
  const x758: u32 = toU32(w758)
  const x759: u32 = toU32(w758 >> 32)
  const w760: u64 = p256FiatSubborrowxU32(x759, x743, 0xffffffff)
  const x760: u32 = toU32(w760)
  const x761: u32 = toU32(w760 >> 32)
  const w762: u64 = p256FiatSubborrowxU32(x761, x745, 0x0)
  const x762: u32 = toU32(w762)
  const x763: u32 = toU32(w762 >> 32)
  const w764: u64 = p256FiatSubborrowxU32(x763, x747, 0xffffffff)
  const x764: u32 = toU32(w764)
  const x765: u32 = toU32(w764 >> 32)
  const w766: u64 = p256FiatSubborrowxU32(x765, x749, 0x0)
  const x767: u32 = toU32(w766 >> 32)
  const x768: u32 = p256FiatCmovznzU32(x767, x750, x733)
  const x769: u32 = p256FiatCmovznzU32(x767, x752, x735)
  const x770: u32 = p256FiatCmovznzU32(x767, x754, x737)
  const x771: u32 = p256FiatCmovznzU32(x767, x756, x739)
  const x772: u32 = p256FiatCmovznzU32(x767, x758, x741)
  const x773: u32 = p256FiatCmovznzU32(x767, x760, x743)
  const x774: u32 = p256FiatCmovznzU32(x767, x762, x745)
  const x775: u32 = p256FiatCmovznzU32(x767, x764, x747)
  out1[0] = x768
  out1[1] = x769
  out1[2] = x770
  out1[3] = x771
  out1[4] = x772
  out1[5] = x773
  out1[6] = x774
  out1[7] = x775
}

/** fiat's `fiat_p256_scalar_add`: adds two field elements in the Montgomery domain. */
const p256FiatScalarAdd = (out1: u32[], arg1: u32[], arg2: u32[]): void => {
  if (toI32(out1.length) < 8 || toI32(arg1.length) < 8 || toI32(arg2.length) < 8) {
    return
  }
  const w1: u64 = p256FiatAddcarryxU32(0x0, arg1[0], arg2[0])
  const x1: u32 = toU32(w1)
  const x2: u32 = toU32(w1 >> 32)
  const w3: u64 = p256FiatAddcarryxU32(x2, arg1[1], arg2[1])
  const x3: u32 = toU32(w3)
  const x4: u32 = toU32(w3 >> 32)
  const w5: u64 = p256FiatAddcarryxU32(x4, arg1[2], arg2[2])
  const x5: u32 = toU32(w5)
  const x6: u32 = toU32(w5 >> 32)
  const w7: u64 = p256FiatAddcarryxU32(x6, arg1[3], arg2[3])
  const x7: u32 = toU32(w7)
  const x8: u32 = toU32(w7 >> 32)
  const w9: u64 = p256FiatAddcarryxU32(x8, arg1[4], arg2[4])
  const x9: u32 = toU32(w9)
  const x10: u32 = toU32(w9 >> 32)
  const w11: u64 = p256FiatAddcarryxU32(x10, arg1[5], arg2[5])
  const x11: u32 = toU32(w11)
  const x12: u32 = toU32(w11 >> 32)
  const w13: u64 = p256FiatAddcarryxU32(x12, arg1[6], arg2[6])
  const x13: u32 = toU32(w13)
  const x14: u32 = toU32(w13 >> 32)
  const w15: u64 = p256FiatAddcarryxU32(x14, arg1[7], arg2[7])
  const x15: u32 = toU32(w15)
  const x16: u32 = toU32(w15 >> 32)
  const w17: u64 = p256FiatSubborrowxU32(0x0, x1, 0xfc632551)
  const x17: u32 = toU32(w17)
  const x18: u32 = toU32(w17 >> 32)
  const w19: u64 = p256FiatSubborrowxU32(x18, x3, 0xf3b9cac2)
  const x19: u32 = toU32(w19)
  const x20: u32 = toU32(w19 >> 32)
  const w21: u64 = p256FiatSubborrowxU32(x20, x5, 0xa7179e84)
  const x21: u32 = toU32(w21)
  const x22: u32 = toU32(w21 >> 32)
  const w23: u64 = p256FiatSubborrowxU32(x22, x7, 0xbce6faad)
  const x23: u32 = toU32(w23)
  const x24: u32 = toU32(w23 >> 32)
  const w25: u64 = p256FiatSubborrowxU32(x24, x9, 0xffffffff)
  const x25: u32 = toU32(w25)
  const x26: u32 = toU32(w25 >> 32)
  const w27: u64 = p256FiatSubborrowxU32(x26, x11, 0xffffffff)
  const x27: u32 = toU32(w27)
  const x28: u32 = toU32(w27 >> 32)
  const w29: u64 = p256FiatSubborrowxU32(x28, x13, 0x0)
  const x29: u32 = toU32(w29)
  const x30: u32 = toU32(w29 >> 32)
  const w31: u64 = p256FiatSubborrowxU32(x30, x15, 0xffffffff)
  const x31: u32 = toU32(w31)
  const x32: u32 = toU32(w31 >> 32)
  const w33: u64 = p256FiatSubborrowxU32(x32, x16, 0x0)
  const x34: u32 = toU32(w33 >> 32)
  const x35: u32 = p256FiatCmovznzU32(x34, x17, x1)
  const x36: u32 = p256FiatCmovznzU32(x34, x19, x3)
  const x37: u32 = p256FiatCmovznzU32(x34, x21, x5)
  const x38: u32 = p256FiatCmovznzU32(x34, x23, x7)
  const x39: u32 = p256FiatCmovznzU32(x34, x25, x9)
  const x40: u32 = p256FiatCmovznzU32(x34, x27, x11)
  const x41: u32 = p256FiatCmovznzU32(x34, x29, x13)
  const x42: u32 = p256FiatCmovznzU32(x34, x31, x15)
  out1[0] = x35
  out1[1] = x36
  out1[2] = x37
  out1[3] = x38
  out1[4] = x39
  out1[5] = x40
  out1[6] = x41
  out1[7] = x42
}

/** The eight limbs `l0` (least significant) to `l7` written into `out`. */
const p256SetLimbs = (
  out: u32[],
  l0: u32,
  l1: u32,
  l2: u32,
  l3: u32,
  l4: u32,
  l5: u32,
  l6: u32,
  l7: u32
): void => {
  if (toI32(out.length) < 8) {
    return
  }
  out[0] = l0
  out[1] = l1
  out[2] = l2
  out[3] = l3
  out[4] = l4
  out[5] = l5
  out[6] = l6
  out[7] = l7
}

/** `out = 0`, limb by limb. */
const p256SetZero = (out: u32[]): void => {
  if (toI32(out.length) < 8) {
    return
  }
  for (let i: i32 = 0; i < 8; i++) {
    out[i] = 0
  }
}

/** A fresh eight-limb array, zero. */
const p256Limbs = (): u32[] => new Array<u32>(8)

/** The field prime p = 2^256 - 2^224 + 2^192 + 2^96 - 1, as plain limbs. */
const p256Prime = (): u32[] => {
  const out: u32[] = p256Limbs()
  p256SetLimbs(out, 0xffffffff, 0xffffffff, 0xffffffff, 0, 0, 0, 1, 0xffffffff)
  return out
}

/** `out` = the group order n (SEC 2 §2.4.2), as plain limbs. */
const p256SetOrder = (out: u32[]): void => {
  p256SetLimbs(out, 0xfc632551, 0xf3b9cac2, 0xa7179e84, 0xbce6faad, 0xffffffff, 0xffffffff, 0, 0xffffffff)
}

/** The group order n (SEC 2 §2.4.2), as plain limbs. */
const p256Order = (): u32[] => {
  const out: u32[] = p256Limbs()
  p256SetOrder(out)
  return out
}

/**
 * R^2 mod p for R = 2^256: a Montgomery multiply by it takes a plain element
 * into the Montgomery domain, which is all fiat's `to_montgomery` does.
 */
const p256FieldR2 = (): u32[] => {
  const out: u32[] = p256Limbs()
  p256SetLimbs(out, 3, 0, 0xffffffff, 0xfffffffb, 0xfffffffe, 0xffffffff, 0xfffffffd, 4)
  return out
}

/** R^2 mod n, which does for the scalars what `p256FieldR2` does for the field. */
const p256ScalarR2 = (): u32[] => {
  const out: u32[] = p256Limbs()
  p256SetLimbs(
    out,
    0xbe79eea2,
    0x83244c95,
    0x49bd6fa6,
    0x4699799c,
    0x2b6bec59,
    0x2845b239,
    0xf3d95620,
    0x66e12d94
  )
  return out
}

/** The curve's `b` (SEC 2 §2.4.2) times R mod p: `b` in the Montgomery domain. */
const p256CurveB = (): u32[] => {
  const out: u32[] = p256Limbs()
  p256SetLimbs(
    out,
    0x29c4bddf,
    0xd89cdf62,
    0x78843090,
    0xacf005cd,
    0xf7212ed6,
    0xe5a220ab,
    0x04874834,
    0xdc30061d
  )
  return out
}

/**
 * The plain 1, `[1, 0, …, 0]`. A Montgomery multiply by it divides by R, which
 * takes an element out of the Montgomery domain: fiat's `from_montgomery`.
 */
const p256PlainOne = (): u32[] => {
  const out: u32[] = p256Limbs()
  out[0] = 1
  return out
}

/** `out = a`, limb by limb. */
const p256Copy = (out: u32[], a: u32[]): void => {
  if (toI32(out.length) < 8 || toI32(a.length) < 8) {
    return
  }
  for (let i: i32 = 0; i < 8; i++) {
    out[i] = a[i]
  }
}

/**
 * The plain limbs of the 32 big-endian bytes `bytes[at .. at + 32)`, limb 0
 * the least significant. A window outside `bytes` leaves `out` as it was;
 * every caller has checked the length first.
 */
const p256LimbsFromBytes = (out: u32[], bytes: u8[], at: i32): void => {
  const length: i32 = toI32(bytes.length)
  if (toI32(out.length) < 8 || at < 0 || at > length - 32) {
    return
  }
  for (let i: i32 = 0; i < 8; i++) {
    let limb: u32 = 0
    for (let b: i32 = 0; b < 4; b++) {
      const j: i32 = at + 28 - 4 * i + b
      if (j >= 0 && j < length) {
        limb = (limb << 8) | toU32(bytes[j])
      }
    }
    out[i] = limb
  }
}

/** The plain limbs `a` as 32 big-endian bytes at `out[at .. at + 32)`. */
const p256LimbsToBytes = (out: u8[], at: i32, a: u32[]): void => {
  const length: i32 = toI32(out.length)
  if (toI32(a.length) < 8 || at < 0 || at > length - 32) {
    return
  }
  for (let i: i32 = 0; i < 8; i++) {
    const limb: u32 = a[i]
    for (let b: i32 = 0; b < 4; b++) {
      const j: i32 = at + 31 - 4 * i - b
      if (j >= 0 && j < length) {
        out[j] = toU8(limb >> toU32(8 * b))
      }
    }
  }
}

/**
 * `d = a - m` modulo 2^256 for plain limbs, answering the borrow out of the
 * top limb: 1 when `a` is below `m` and 0 otherwise. Every limb is subtracted
 * whatever the values, so the answer takes no comparison a secret could steer.
 */
const p256SubBorrow = (d: u32[], a: u32[], m: u32[]): u32 => {
  if (toI32(d.length) < 8 || toI32(a.length) < 8 || toI32(m.length) < 8) {
    return 0
  }
  let borrow: u32 = 0
  for (let i: i32 = 0; i < 8; i++) {
    const w: u64 = p256FiatSubborrowxU32(borrow, a[i], m[i])
    d[i] = toU32(w)
    borrow = toU32(w >> 32)
  }
  return borrow
}

/**
 * 1 when the plain value `a` is below `m` and 0 otherwise: the borrow out of
 * `a - m`, carried through every limb, so the answer takes no comparison a
 * secret could steer.
 */
const p256Below = (a: u32[], m: u32[]): u32 => p256SubBorrow(new Array<u32>(8), a, m)

/**
 * `out = a mod m` for a plain `a` below 2m: `a - m` is computed whatever `a`
 * is, and fiat's conditional move keeps it when there was no borrow. That is
 * how an x-coordinate (below p < 2n) and a 256-bit digest are taken mod n.
 */
const p256ReduceOnce = (out: u32[], a: u32[], m: u32[]): void => {
  const d: u32[] = new Array<u32>(8)
  p256FiatSelectznz(out, p256SubBorrow(d, a, m), d, a)
}

// ---- The nonce's and the field's inverses by safegcd -------------------------
//
// Bernstein and Yang's constant-time inversion ("Fast constant-time gcd
// computation and modular inversion", 2019), as libsecp256k1's modinv32 writes
// it for 32-bit targets (MIT, std/crypto/LICENSE-libsecp256k1): the functions
// below are its secp256k1_modinv32_divsteps_30, _update_de_30, _update_fg_30,
// _normalize_30 and secp256k1_modinv32, with its scalar_8x32 conversions to and
// from signed-30, ported to Nish for the two moduli n and p. A value is nine limbs
// of 30 bits each, limb 8 carrying the sign, held as the u32 bit patterns of
// the C's int32_t: `u32` arithmetic wraps where the C's never overflows, so the
// low bits agree, and the arithmetic shifts go through `i32` and `i64`.

/** The 32-bit pattern `a` read as an `int32_t`, widened to 64 bits with its sign. */
const p256Wide = (a: u32): u64 => toU64(toI64(toI32(a)))

/** `c >> 30` on `c` read as an `int64_t`: the carry into the next limb. */
const p256Carry30 = (c: u64): u64 => toU64(toI64(c) >> 30)

/** `a >> 30` on `a` read as an `int32_t`. */
const p256Shift30 = (a: u32): u32 => toU32(toI32(a) >> 30)

/** All ones when `a`, read as an `int32_t`, is negative; zero otherwise. */
const p256SignMask = (a: u32): u32 => toU32(toI32(a) >> 31)

/** n in nine signed-30 limbs, limb 0 the least significant. */
const p256Order30 = (): u32[] => {
  const out: u32[] = new Array<u32>(9)
  out[0] = 0x3c632551
  out[1] = 0x0ee72b0b
  out[2] = 0x3179e84f
  out[3] = 0x39beab69
  out[4] = 0x3fffffbc
  out[5] = 0x3fffffff
  out[6] = 0x00000fff
  out[7] = 0x3fffc000
  out[8] = 0x0000ffff
  return out
}

/**
 * R^3 mod n. A Montgomery multiply by it takes `(a R)^-1`, what safegcd
 * answers for an input in the Montgomery domain, to `a^-1 R`.
 */
const p256ScalarR3 = (): u32[] => {
  const out: u32[] = p256Limbs()
  p256SetLimbs(
    out,
    0x0b65a624,
    0xac8ebec9,
    0x0c0555c9,
    0x111f28ae,
    0x6ba5e93f,
    0x2543b924,
    0x6407be65,
    0x503a54e7
  )
  return out
}

/** The eight 32-bit limbs `a`, below 2^256, as nine signed-30 limbs (`secp256k1_scalar_to_signed30`). */
const p256ToSigned30 = (out: u32[], a: u32[]): void => {
  if (toI32(out.length) < 9 || toI32(a.length) < 8) {
    return
  }
  out[0] = a[0] & 0x3fffffff
  out[1] = ((a[0] >> 30) | (a[1] << 2)) & 0x3fffffff
  out[2] = ((a[1] >> 28) | (a[2] << 4)) & 0x3fffffff
  out[3] = ((a[2] >> 26) | (a[3] << 6)) & 0x3fffffff
  out[4] = ((a[3] >> 24) | (a[4] << 8)) & 0x3fffffff
  out[5] = ((a[4] >> 22) | (a[5] << 10)) & 0x3fffffff
  out[6] = ((a[5] >> 20) | (a[6] << 12)) & 0x3fffffff
  out[7] = ((a[6] >> 18) | (a[7] << 14)) & 0x3fffffff
  out[8] = a[7] >> 16
}

/** Nine normalised signed-30 limbs, in [0, n), as eight 32-bit limbs (`secp256k1_scalar_from_signed30`). */
const p256FromSigned30 = (out: u32[], a: u32[]): void => {
  if (toI32(out.length) < 8 || toI32(a.length) < 9) {
    return
  }
  out[0] = a[0] | (a[1] << 30)
  out[1] = (a[1] >> 2) | (a[2] << 28)
  out[2] = (a[2] >> 4) | (a[3] << 26)
  out[3] = (a[3] >> 6) | (a[4] << 24)
  out[4] = (a[4] >> 8) | (a[5] << 22)
  out[5] = (a[5] >> 10) | (a[6] << 20)
  out[6] = (a[6] >> 12) | (a[7] << 18)
  out[7] = (a[7] >> 14) | (a[8] << 16)
}

/**
 * Thirty divsteps on the low limbs `f0` (odd) and `g0`, from `zeta` =
 * -(delta + 1/2): the steps' product as a 2x2 matrix `[u, v; q, r]` in `t`,
 * each entry in [-2^30, 2^30] as a 32-bit pattern, and the new zeta returned.
 * Every step does the same operations: whether g is odd and whether zeta is
 * negative become masks, never a branch (`secp256k1_modinv32_divsteps_30`).
 */
const p256Divsteps30 = (zeta: u32, f0: u32, g0: u32, t: u32[]): u32 => {
  if (toI32(t.length) < 4) {
    return zeta
  }
  const zero: u32 = 0
  let z: u32 = zeta
  let f: u32 = f0
  let g: u32 = g0
  let u: u32 = 1
  let v: u32 = 0
  let q: u32 = 0
  let r: u32 = 1
  for (let i: i32 = 0; i < 30; i++) {
    // Masks for zeta < 0 and for g odd.
    let mask1: u32 = p256SignMask(z)
    const mask2: u32 = zero - (g & 1)
    // f, u and v, negated when zeta < 0, added to g, q and r when g is odd.
    g = g + (((f ^ mask1) - mask1) & mask2)
    q = q + (((u ^ mask1) - mask1) & mask2)
    r = r + (((v ^ mask1) - mask1) & mask2)
    // When both hold, zeta becomes -zeta - 2 and the new g, q and r are added
    // to f, u and v (the swap); otherwise zeta becomes zeta - 1.
    mask1 = mask1 & mask2
    z = (z ^ mask1) - 1
    f = f + (g & mask1)
    u = u + (q & mask1)
    v = v + (r & mask1)
    g = g >> 1
    u = u << 1
    v = v << 1
  }
  t[0] = u
  t[1] = v
  t[2] = q
  t[3] = r
  return z
}

/**
 * `[d, e] = (t [d, e] + n [md, me]) / 2^30` for the modulus `n` (n or p),
 * with `md` and `me` chosen so that the division is exact: d and e stay in
 * (-2n, n) and keep tracking f and g modulo n
 * (`secp256k1_modinv32_update_de_30`). `inverse30` is n^-1 mod 2^30, which
 * makes the sum's bottom 30 bits zero. The products are 32 by 32 bits into 64.
 */
const p256UpdateDe30 = (d: u32[], e: u32[], t: u32[], n: u32[], inverse30: u32): void => {
  if (toI32(d.length) < 9 || toI32(e.length) < 9 || toI32(t.length) < 4 || toI32(n.length) < 9) {
    return
  }
  const u: u64 = p256Wide(t[0])
  const v: u64 = p256Wide(t[1])
  const q: u64 = p256Wide(t[2])
  const r: u64 = p256Wide(t[3])
  // [md, me] start as [u, q] if d is negative plus [v, r] if e is.
  const sd: u32 = p256SignMask(d[8])
  const se: u32 = p256SignMask(e[8])
  let md: u32 = (t[0] & sd) + (t[1] & se)
  let me: u32 = (t[2] & sd) + (t[3] & se)
  const d0: u64 = p256Wide(d[0])
  const e0: u64 = p256Wide(e[0])
  let cd: u64 = u * d0 + v * e0
  let ce: u64 = q * d0 + r * e0
  // Correct md and me so that the bottom 30 bits of the sum are zero.
  md = md - ((inverse30 * toU32(cd) + md) & 0x3fffffff)
  me = me - ((inverse30 * toU32(ce) + me) & 0x3fffffff)
  const mdWide: u64 = p256Wide(md)
  const meWide: u64 = p256Wide(me)
  cd = p256Carry30(cd + p256Wide(n[0]) * mdWide)
  ce = p256Carry30(ce + p256Wide(n[0]) * meWide)
  for (let i: i32 = 1; i < 9; i++) {
    const di: u64 = p256Wide(d[i])
    const ei: u64 = p256Wide(e[i])
    const ni: u64 = p256Wide(n[i])
    cd = cd + u * di + v * ei + ni * mdWide
    ce = ce + q * di + r * ei + ni * meWide
    d[i - 1] = toU32(cd) & 0x3fffffff
    e[i - 1] = toU32(ce) & 0x3fffffff
    cd = p256Carry30(cd)
    ce = p256Carry30(ce)
  }
  d[8] = toU32(cd)
  e[8] = toU32(ce)
}

/** `[f, g] = t [f, g] / 2^30`, which the divsteps made exact (`secp256k1_modinv32_update_fg_30`). */
const p256UpdateFg30 = (f: u32[], g: u32[], t: u32[]): void => {
  if (toI32(f.length) < 9 || toI32(g.length) < 9 || toI32(t.length) < 4) {
    return
  }
  const u: u64 = p256Wide(t[0])
  const v: u64 = p256Wide(t[1])
  const q: u64 = p256Wide(t[2])
  const r: u64 = p256Wide(t[3])
  const f0: u64 = p256Wide(f[0])
  const g0: u64 = p256Wide(g[0])
  let cf: u64 = p256Carry30(u * f0 + v * g0)
  let cg: u64 = p256Carry30(q * f0 + r * g0)
  for (let i: i32 = 1; i < 9; i++) {
    const fi: u64 = p256Wide(f[i])
    const gi: u64 = p256Wide(g[i])
    cf = cf + u * fi + v * gi
    cg = cg + q * fi + r * gi
    f[i - 1] = toU32(cf) & 0x3fffffff
    g[i - 1] = toU32(cg) & 0x3fffffff
    cf = p256Carry30(cf)
    cg = p256Carry30(cg)
  }
  f[8] = toU32(cf)
  g[8] = toU32(cg)
}

/** Add the modulus `n` to the signed-30 `a` when `mask` is all ones, then carry so every limb but the last is in [0, 2^30). */
const p256AddModulus30 = (a: u32[], n: u32[], mask: u32, negate: u32): void => {
  if (toI32(a.length) < 9 || toI32(n.length) < 9) {
    return
  }
  for (let i: i32 = 0; i < 9; i++) {
    a[i] = ((a[i] + (n[i] & mask)) ^ negate) - negate
  }
  for (let i: i32 = 1; i < 9; i++) {
    a[i] = a[i] + p256Shift30(a[i - 1])
    a[i - 1] = a[i - 1] & 0x3fffffff
  }
}

/**
 * `d` in (-2n, n) to [0, n) for the modulus `n`, negated first when `sign`'s
 * top bit is set: f ended as -1 rather than 1
 * (`secp256k1_modinv32_normalize_30`).
 */
const p256Normalize30 = (d: u32[], sign: u32, n: u32[]): void => {
  if (toI32(d.length) < 9) {
    return
  }
  const zero: u32 = 0
  p256AddModulus30(d, n, p256SignMask(d[8]), p256SignMask(sign))
  p256AddModulus30(d, n, p256SignMask(d[8]), zero)
}

/**
 * `out = 1 / a` mod `m` for the plain limbs `a`, below m, and the odd
 * modulus `m` in signed-30 limbs (n or p), with `inverse30` = m^-1 mod 2^30;
 * zero for an `a` that is zero mod `m`. Twenty batches of thirty divsteps
 * each: 600, past the 590 that bound any 256-bit input, so the count never
 * depends on `a`, and every step and update runs the same instructions on any
 * value. f, g, d, e and the matrix are wiped before it returns (ECC-2).
 */
const p256Safegcd = (out: u32[], a: u32[], m: u32[], inverse30: u32): void => {
  const d: u32[] = new Array<u32>(9)
  const e: u32[] = new Array<u32>(9)
  const f: u32[] = new Array<u32>(9)
  const g: u32[] = new Array<u32>(9)
  const t: u32[] = new Array<u32>(4)
  if (toI32(m.length) < 9) {
    return
  }
  for (let i: i32 = 0; i < 9; i++) {
    f[i] = m[i]
  }
  e[0] = 1
  p256ToSigned30(g, a)
  // zeta = -(delta + 1/2), delta starting at 1/2.
  let zeta: u32 = 0xffffffff
  for (let i: i32 = 0; i < 20; i++) {
    zeta = p256Divsteps30(zeta, f[0], g[0], t)
    p256UpdateDe30(d, e, t, m, inverse30)
    p256UpdateFg30(f, g, t)
  }
  // g is now 0 and f is 1 or -1, with d the inverse up to that sign; for a
  // zero `a`, f is m and d stays 0.
  p256Normalize30(d, f[8], m)
  p256FromSigned30(out, d)
  wipe(d)
  wipe(e)
  wipe(f)
  wipe(g)
  wipe(t)
}

/**
 * `out = 1 / a` mod n for `a` in the Montgomery domain, zero for a zero `a`:
 * the signing paths' inversion of the nonce and verification's of s, by
 * `p256Safegcd`. The divsteps invert `a R` as a plain number; one Montgomery
 * multiply by R^3 takes `(a R)^-1` to `a^-1 R`.
 */
const p256ScalarInverse = (out: u32[], a: u32[]): void => {
  p256Safegcd(out, a, p256Order30(), 0x11ff43b1)
  p256FiatScalarMul(out, out, p256ScalarR3())
}

/** p in nine signed-30 limbs, limb 0 the least significant. */
const p256Prime30 = (): u32[] => {
  const out: u32[] = new Array<u32>(9)
  out[0] = 0x3fffffff
  out[1] = 0x3fffffff
  out[2] = 0x3fffffff
  out[3] = 0x0000003f
  out[4] = 0
  out[5] = 0
  out[6] = 0x00001000
  out[7] = 0x3fffc000
  out[8] = 0x0000ffff
  return out
}

/** R^3 mod p, which does for `p256FieldInvert` what `p256ScalarR3` does for the scalars. */
const p256FieldR3 = (): u32[] => {
  const out: u32[] = p256Limbs()
  p256SetLimbs(out, 0xa, 0xfffffffd, 0xfffffff7, 0xffffffed, 0xfffffffc, 0x5, 0x1, 0x18)
  return out
}

/**
 * `out = 1 / a` in the field for `a` in the Montgomery domain, zero for a
 * zero `a`, by `p256Safegcd` modulo p (p^-1 mod 2^30 is 2^30 - 1, as p is
 * -1 mod 2^96) and a Montgomery multiply by R^3. Constant time: what it
 * inverts is a Z that follows a secret scalar in signing, ECDH and the public
 * key. `out` may be `a`.
 */
const p256FieldInvert = (out: u32[], a: u32[]): void => {
  p256Safegcd(out, a, p256Prime30(), 0x3fffffff)
  p256FiatMul(out, out, p256FieldR3())
}

/**
 * A point in projective coordinates (X : Y : Z), each coordinate a field
 * element in the Montgomery domain. It stands for the affine (X/Z, Y/Z), and
 * Z = 0 is the identity, which the complete formulas take like any other point.
 */
class P256ProjectivePoint {
  /** @internal Read and written by this module's point functions; the class is not exported. */
  x: u32[]
  /** @internal Read and written by this module's point functions; the class is not exported. */
  y: u32[]
  /** @internal Read and written by this module's point functions; the class is not exported. */
  z: u32[]

  /** The identity, (0 : 1 : 0). */
  constructor() {
    this.x = p256Limbs()
    this.y = p256Limbs()
    this.z = p256Limbs()
    p256FiatSetOne(this.y)
  }
}

/**
 * The temporaries of one addition or doubling, allocated once per scalar
 * multiplication rather than once per step, the table entry a multiplication
 * selects into, and the curve's `b`, which the formulas multiply by.
 */
class P256PointScratch {
  /** @internal Read and written by this module's point functions; the class is not exported. */
  t0: u32[]
  /** @internal Read and written by this module's point functions; the class is not exported. */
  t1: u32[]
  /** @internal Read and written by this module's point functions; the class is not exported. */
  t2: u32[]
  /** @internal Read and written by this module's point functions; the class is not exported. */
  t3: u32[]
  /** @internal Read and written by this module's point functions; the class is not exported. */
  t4: u32[]
  /** @internal Read and written by this module's point functions; the class is not exported. */
  sum: P256ProjectivePoint
  /** @internal Read and written by this module's point functions; the class is not exported. */
  entry: P256ProjectivePoint
  /** @internal Read and written by this module's point functions; the class is not exported. */
  comb: u32[]
  /** @internal Read and written by this module's point functions; the class is not exported. */
  b: u32[]

  constructor() {
    this.t0 = p256Limbs()
    this.t1 = p256Limbs()
    this.t2 = p256Limbs()
    this.t3 = p256Limbs()
    this.t4 = p256Limbs()
    this.sum = new P256ProjectivePoint()
    this.entry = new P256ProjectivePoint()
    this.comb = p256Limbs()
    this.b = p256CurveB()
  }
}

/** Zero `p`'s three coordinates, with the store `nish:secret` keeps from the optimiser (ECC-2). */
const p256WipePoint = (p: P256ProjectivePoint): void => {
  wipe(p.x)
  wipe(p.y)
  wipe(p.z)
}

/** Zero every temporary a point operation left in `s`; `b` is the curve's public constant. */
const p256WipeScratch = (s: P256PointScratch): void => {
  wipe(s.t0)
  wipe(s.t1)
  wipe(s.t2)
  wipe(s.t3)
  wipe(s.t4)
  p256WipePoint(s.sum)
  p256WipePoint(s.entry)
  wipe(s.comb)
}

/** `out = p`, coordinate by coordinate. */
const p256PointCopy = (out: P256ProjectivePoint, p: P256ProjectivePoint): void => {
  p256Copy(out.x, p.x)
  p256Copy(out.y, p.y)
  p256Copy(out.z, p.z)
}

/** `p = (0 : 1 : 0)`, the identity, in place: what `new P256ProjectivePoint()` makes. */
const p256SetIdentity = (p: P256ProjectivePoint): void => {
  p256SetZero(p.x)
  p256FiatSetOne(p.y)
  p256SetZero(p.z)
}

/**
 * `out = p + q`, by Renes, Costello and Batina's Algorithm 4 (complete
 * addition for a = -3), step for step in the paper's order and with its names.
 * `out` may be `p` or `q`: the sum is built in the scratch and copied out.
 */
const p256PointAdd = (
  out: P256ProjectivePoint,
  p: P256ProjectivePoint,
  q: P256ProjectivePoint,
  s: P256PointScratch
): void => {
  const t0: u32[] = s.t0
  const t1: u32[] = s.t1
  const t2: u32[] = s.t2
  const t3: u32[] = s.t3
  const t4: u32[] = s.t4
  const x3: u32[] = s.sum.x
  const y3: u32[] = s.sum.y
  const z3: u32[] = s.sum.z
  p256FiatMul(t0, p.x, q.x) // 1
  p256FiatMul(t1, p.y, q.y)
  p256FiatMul(t2, p.z, q.z)
  p256FiatAdd(t3, p.x, p.y)
  p256FiatAdd(t4, q.x, q.y) // 5
  p256FiatMul(t3, t3, t4)
  p256FiatAdd(t4, t0, t1)
  p256FiatSub(t3, t3, t4)
  p256FiatAdd(t4, p.y, p.z)
  p256FiatAdd(x3, q.y, q.z) // 10
  p256FiatMul(t4, t4, x3)
  p256FiatAdd(x3, t1, t2)
  p256FiatSub(t4, t4, x3)
  p256FiatAdd(x3, p.x, p.z)
  p256FiatAdd(y3, q.x, q.z) // 15
  p256FiatMul(x3, x3, y3)
  p256FiatAdd(y3, t0, t2)
  p256FiatSub(y3, x3, y3)
  p256FiatMul(z3, s.b, t2)
  p256FiatSub(x3, y3, z3) // 20
  p256FiatAdd(z3, x3, x3)
  p256FiatAdd(x3, x3, z3)
  p256FiatSub(z3, t1, x3)
  p256FiatAdd(x3, t1, x3)
  p256FiatMul(y3, s.b, y3) // 25
  p256FiatAdd(t1, t2, t2)
  p256FiatAdd(t2, t1, t2)
  p256FiatSub(y3, y3, t2)
  p256FiatSub(y3, y3, t0)
  p256FiatAdd(t1, y3, y3) // 30
  p256FiatAdd(y3, t1, y3)
  p256FiatAdd(t1, t0, t0)
  p256FiatAdd(t0, t1, t0)
  p256FiatSub(t0, t0, t2)
  p256FiatMul(t1, t4, y3) // 35
  p256FiatMul(t2, t0, y3)
  p256FiatMul(y3, x3, z3)
  p256FiatAdd(y3, y3, t2)
  p256FiatMul(x3, t3, x3)
  p256FiatSub(x3, x3, t1) // 40
  p256FiatMul(z3, t4, z3)
  p256FiatMul(t1, t3, t0)
  p256FiatAdd(z3, z3, t1)
  p256PointCopy(out, s.sum)
}

/**
 * `out = 2p`, by Renes, Costello and Batina's Algorithm 6 (exception-free
 * doubling for a = -3), step for step. `out` may be `p`.
 */
const p256PointDouble = (out: P256ProjectivePoint, p: P256ProjectivePoint, s: P256PointScratch): void => {
  const t0: u32[] = s.t0
  const t1: u32[] = s.t1
  const t2: u32[] = s.t2
  const t3: u32[] = s.t3
  const x3: u32[] = s.sum.x
  const y3: u32[] = s.sum.y
  const z3: u32[] = s.sum.z
  p256FiatSquare(t0, p.x) // 1
  p256FiatSquare(t1, p.y)
  p256FiatSquare(t2, p.z)
  p256FiatMul(t3, p.x, p.y)
  p256FiatAdd(t3, t3, t3) // 5
  p256FiatMul(z3, p.x, p.z)
  p256FiatAdd(z3, z3, z3)
  p256FiatMul(y3, s.b, t2)
  p256FiatSub(y3, y3, z3)
  p256FiatAdd(x3, y3, y3) // 10
  p256FiatAdd(y3, x3, y3)
  p256FiatSub(x3, t1, y3)
  p256FiatAdd(y3, t1, y3)
  p256FiatMul(y3, x3, y3)
  p256FiatMul(x3, x3, t3) // 15
  p256FiatAdd(t3, t2, t2)
  p256FiatAdd(t2, t2, t3)
  p256FiatMul(z3, s.b, z3)
  p256FiatSub(z3, z3, t2)
  p256FiatSub(z3, z3, t0) // 20
  p256FiatAdd(t3, z3, z3)
  p256FiatAdd(z3, z3, t3)
  p256FiatAdd(t3, t0, t0)
  p256FiatAdd(t0, t3, t0)
  p256FiatSub(t0, t0, t2) // 25
  p256FiatMul(t0, t0, z3)
  p256FiatAdd(y3, y3, t0)
  p256FiatMul(t0, p.y, p.z)
  p256FiatAdd(t0, t0, t0)
  p256FiatMul(z3, t0, z3) // 30
  p256FiatSub(x3, x3, z3)
  p256FiatMul(z3, t0, t1)
  p256FiatAdd(z3, z3, z3)
  p256FiatAdd(z3, z3, z3)
  p256PointCopy(out, s.sum)
}

/** The limbs one table entry takes: X, Y and Z, eight each. */
const P256_ENTRY: i32 = 24

/** `table[at .. at + 8) = a`. */
const p256TableStore = (table: u32[], at: i32, a: u32[]): void => {
  if (toI32(a.length) < 8 || at < 0 || at > toI32(table.length) - 8) {
    return
  }
  for (let i: i32 = 0; i < 8; i++) {
    table[at + i] = a[i]
  }
}

/** Table entry `i` (limbs `24i` to `24i + 23`, X then Y then Z) = `p`. */
const p256TableStorePoint = (table: u32[], i: i32, p: P256ProjectivePoint): void => {
  p256TableStore(table, i * P256_ENTRY, p.x)
  p256TableStore(table, i * P256_ENTRY + 8, p.y)
  p256TableStore(table, i * P256_ENTRY + 16, p.z)
}

/**
 * The window table: entry `i` is `i * p`, for `i` from 0 to 15. Built from
 * `p`, which is public here (G or a received key) and a secret only in that
 * it is about to be multiplied. Entry 0 is the identity and entry 1 is `p`;
 * each later one adds `p` to the one before, in `acc`, which the caller owns.
 */
const p256TableBuild = (
  table: u32[],
  p: P256ProjectivePoint,
  s: P256PointScratch,
  acc: P256ProjectivePoint
): void => {
  p256SetIdentity(acc)
  p256TableStorePoint(table, 0, acc)
  p256PointCopy(acc, p)
  p256TableStorePoint(table, 1, acc)
  for (let i: i32 = 2; i < 16; i++) {
    p256PointAdd(acc, acc, p, s)
    p256TableStorePoint(table, i, acc)
  }
}

/**
 * `out = table[at .. at + 8)` when `hit` is 1, and `out` unchanged when it is
 * 0, by fiat's conditional move on every limb: the eight loads happen either
 * way, at an offset that is the caller's loop position, never the secret.
 */
const p256TableMove = (out: u32[], table: u32[], at: i32, hit: u32): void => {
  const p: u32 = toU32(at)
  if (toI32(out.length) < 8 || at < 0 || at > toI32(table.length) - 8) {
    return
  }
  out[0] = p256FiatCmovznzU32(hit, out[0], table[p])
  out[1] = p256FiatCmovznzU32(hit, out[1], table[p + 1])
  out[2] = p256FiatCmovznzU32(hit, out[2], table[p + 2])
  out[3] = p256FiatCmovznzU32(hit, out[3], table[p + 3])
  out[4] = p256FiatCmovznzU32(hit, out[4], table[p + 4])
  out[5] = p256FiatCmovznzU32(hit, out[5], table[p + 5])
  out[6] = p256FiatCmovznzU32(hit, out[6], table[p + 6])
  out[7] = p256FiatCmovznzU32(hit, out[7], table[p + 7])
}

/**
 * The table entry `digit` into `out`, without indexing by `digit`: all
 * sixteen entries are read, and `p256TableMove` keeps entry `i` when `ctEq`
 * says `i` is the digit. The loop runs over public positions; the digit only
 * ever reaches the mask.
 */
const p256TableSelect = (out: P256ProjectivePoint, table: u32[], digit: u32): void => {
  p256SetZero(out.x)
  p256SetZero(out.y)
  p256SetZero(out.z)
  for (let i: i32 = 0; i < 16; i++) {
    const hit: u32 = ctEq(toU32(i), digit) & 1
    p256TableMove(out.x, table, i * P256_ENTRY, hit)
    p256TableMove(out.y, table, i * P256_ENTRY + 8, hit)
    p256TableMove(out.z, table, i * P256_ENTRY + 16, hit)
  }
}

/**
 * `out = k * p` for 32 big-endian bytes `k`, in constant time: the fixed
 * 4-bit window described in the module's header. The 64 digits are read from
 * the top nibble down; their positions are public, their values reach only
 * `p256TableSelect`. Every window does four doublings, one table read and one
 * complete addition, so a zero digit or a leading run of zeros costs what any
 * other digit does.
 */
const p256ScalarMult = (
  out: P256ProjectivePoint,
  k: u8[],
  p: P256ProjectivePoint,
  s: P256PointScratch
): void => {
  // The accumulator, the selected entry and the table follow the scalar's
  // digits, so all three are wiped before it returns.
  const table: u32[] = new Array<u32>(384)
  const acc = new P256ProjectivePoint()
  const entry: P256ProjectivePoint = s.entry
  const kLength: i32 = toI32(k.length)
  if (kLength < 32) {
    return
  }
  p256TableBuild(table, p, s, acc)
  p256SetIdentity(acc)
  for (let i: i32 = 0; i < 64; i++) {
    // Digit i is the high nibble of byte i / 2 when i is even, the low when odd.
    const at: i32 = i >> 1
    const byte: u32 = at >= 0 && at < kLength ? toU32(k[at]) : 0
    const digit: u32 = (byte >> ((1 - toU32(i & 1)) << 2)) & 15
    p256PointDouble(acc, acc, s)
    p256PointDouble(acc, acc, s)
    p256PointDouble(acc, acc, s)
    p256PointDouble(acc, acc, s)
    p256TableSelect(entry, table, digit)
    p256PointAdd(acc, acc, entry, s)
  }
  p256PointCopy(out, acc)
  wipe(table)
  p256WipePoint(acc)
  p256WipePoint(entry)
}

/** The base point G (SEC 2 §2.4.2), in the Montgomery domain with Z = 1. */
const p256Generator = (): P256ProjectivePoint => {
  const g = new P256ProjectivePoint()
  const r2: u32[] = p256FieldR2()
  p256SetLimbs(
    g.x,
    0xd898c296,
    0xf4a13945,
    0x2deb33a0,
    0x77037d81,
    0x63a440f2,
    0xf8bce6e5,
    0xe12c4247,
    0x6b17d1f2
  )
  p256SetLimbs(
    g.y,
    0x37bf51f5,
    0xcbb64068,
    0x6b315ece,
    0x2bce3357,
    0x7c0f9e16,
    0x8ee7eb4a,
    0xfe1a7f9b,
    0x4fe342e2
  )
  p256FiatMul(g.x, g.x, r2)
  p256FiatMul(g.y, g.y, r2)
  p256FiatSetOne(g.z)
  return g
}

// gen-p256-table:begin -- generated by scripts/gen-p256-table.mjs; edit that, not this.
/** The fixed-base comb's shape: teeth per comb, bits between teeth, combs, and entries per comb. */
const P256_COMB_TEETH: i32 = 6
const P256_COMB_SPACING: i32 = 4
const P256_COMBS: i32 = 11
const P256_COMB_ENTRIES: i32 = 32

/** `2^264 - 1 mod n`, plain: the recoding adds it before it halves (ECC-7). */
const p256BaseOffset = (out: u32[]): void => {
  p256SetLimbs(
    out,
    0x9cdaaeff,
    0x46353d03,
    0xe8617b0c,
    0x19055258,
    0x00000043,
    0x00000000,
    0xffffff00,
    0x000000ff
  )
}

/** `2^-1 R mod n`: a scalar Montgomery multiply by it halves mod n (ECC-7). */
const p256BaseHalf = (out: u32[]): void => {
  p256SetLimbs(
    out,
    0x00000000,
    0x00000000,
    0x00000000,
    0x00000000,
    0x00000000,
    0x00000000,
    0x00000000,
    0x80000000
  )
}

/**
 * The signed comb table `p256BaseMult` reads: comb `c` (0 to 10), entry `u`
 * (0 to 31) at limb `(32c + u) * 16`, is the affine point
 * (2^20 + the sum over j < 5 of (2u_j - 1) 2^(4j)) 2^(24c) G,
 * `u_j` bit `j` of `u`, as X then Y in the Montgomery domain. Public: a
 * function of G alone.
 */
const p256BaseTable = (): u32[] => [
  0xedc12173, 0xfe9ebeb9, 0x851a5326, 0x5003cd1e, 0x0183f383, 0x93bed421, 0x6630dd38, 0x3ce3d812, 0xde659ea5,
  0x65cb9deb, 0xd9ca1ae6, 0x0d21d8a2, 0xe4999ff8, 0x1c76ae38, 0xc28c50c9, 0x61e90db5, 0x67b6169b, 0x7413cc3c,
  0x66efb23b, 0x0d7db95b, 0x11ab8c9d, 0x35e5ee7a, 0x94ab35e6, 0x731b4cd2, 0x279c0aa2, 0x77122460, 0x53341316,
  0x5c23cd6b, 0xf01cabef, 0x44b77c54, 0xd37a090d, 0x3eb5ad70, 0xefc87fad, 0x3f8b64ba, 0x92605ca8, 0xfd9cb694,
  0x7991cdef, 0x9c7d36da, 0x30090b75, 0x662b19b3, 0x5c8d9f09, 0x1ec73934, 0xa47128bc, 0xb749ecb6, 0x92172869,
  0x2204a81b, 0x1aa9102b, 0x81c87c32, 0x15e1ab3a, 0x6abdf1d1, 0xd5352469, 0x4bda5fcd, 0x10db0cb7, 0xd2dcfd31,
  0xf1a9fec7, 0x0364bbdb, 0x30a1deb3, 0xdcc52c3e, 0xf8f34528, 0x99f6284e, 0x04f2502d, 0xa01079d6, 0x5af95c9d,
  0xf5f2b2e5, 0x7c2ba524, 0x8c71ee36, 0xc10f6113, 0xbbd75d6c, 0xdf86d0bb, 0x99f4e269, 0x3176cf6e, 0x6bf84a8c,
  0x2bb6658d, 0x8e598f87, 0xcb44088c, 0x99104065, 0x8cad0159, 0x219a8110, 0x75fe707f, 0x9189f325, 0x9f72e163,
  0x5e7738aa, 0x29b52f22, 0x63ba7c54, 0x11453da1, 0x24583b49, 0x15e1edb3, 0xf4273aee, 0x861d761b, 0x933bf2a7,
  0x1f6679f2, 0xe92eda97, 0xa62cfb48, 0xb3d27b4d, 0x6d0331da, 0x9d5efd9d, 0xdd0daf57, 0x07491569, 0x3244de23,
  0x6025bb98, 0x7d6fb2da, 0x837fa2ea, 0xc6c84be8, 0x8224250e, 0xb2f254ff, 0xec1fd618, 0x2a3c591a, 0x7beb5f6b,
  0x69bd035f, 0x194b0bdb, 0xc2790d42, 0xde49f77b, 0x1c763cd0, 0xb212015f, 0x01a5ed96, 0x39d32c32, 0xaf9ca3e3,
  0xbe322e3a, 0xe4b919ab, 0x6712df09, 0x97cb2540, 0x721f1a64, 0xd4d969ce, 0xe8231a7d, 0x1b8d06c7, 0xc50cb035,
  0x0423b7ad, 0xea27f24b, 0xd9708aed, 0x782c3151, 0x37ae1ae3, 0x48816aa8, 0x29197a56, 0x3b614e48, 0x468e4d64,
  0x545b5759, 0x5ce8301b, 0xc779101d, 0xdee9bc50, 0x20074d3e, 0x0d424a0e, 0xb5d0c64e, 0xc121832c, 0xe1c4a765,
  0xcf4a8e83, 0xb0724369, 0x6559b50f, 0x8472bad7, 0x4760af33, 0xe6e2d380, 0x0a7fda5b, 0x97ae2d83, 0x2a6a642b,
  0xd1595b93, 0xa1c7c9b6, 0x4ccaba58, 0x48002854, 0x68521e54, 0x4f8d6296, 0x89b52423, 0xce8f49c8, 0xeb8fc911,
  0xc4fed471, 0x3630d60e, 0x5d7f98d2, 0x6f2974ee, 0x8c123976, 0x263bd743, 0x3b8967ae, 0x8fe2aab4, 0x912fc763,
  0x17afbe9e, 0xd710a0ab, 0x3b77e783, 0xae94d2f2, 0x61113505, 0x4f7ec4dd, 0xe0515d3e, 0x90f6b46b, 0xe4ed3bad,
  0xc1280904, 0x87297e28, 0x16ebe1ad, 0xed8fa379, 0x60f35ad1, 0xc03f1ded, 0x581d119f, 0x8c9ce9ed, 0x07c15597,
  0xa141e10f, 0x2ca8f82a, 0x7a8d5505, 0x8302eef9, 0x89c80c8e, 0xba2c792a, 0xb9b65210, 0x450c82f1, 0xd4e55807,
  0x279d63e8, 0xf9a25f42, 0xe017c965, 0x749adec2, 0xa3860604, 0x74f03926, 0x775b909c, 0xc5c34699, 0x2bee7688,
  0xe353eafe, 0x3009f841, 0x77972137, 0xf41f2085, 0xda9a8d40, 0x7dabd9c2, 0x2ea6120f, 0x277aa096, 0x332ea61e,
  0x20bec841, 0x679b2ce7, 0x4ff76b10, 0xc5e868ce, 0x1e4a9291, 0xa35c0e53, 0xb547066f, 0x3ce9a1be, 0xacfbebf4,
  0xcdb5aeb7, 0x5f226ad0, 0x6b20a390, 0x4dc87e9f, 0x9568f670, 0xea0e4e7d, 0x20995b6c, 0xc186f02d, 0xa23bafa8,
  0x58bc2ae1, 0x937a68a2, 0x9d45aed4, 0x15213643, 0xc7d2b50a, 0x0ec18eac, 0x218e3709, 0xca1aec51, 0xe0cef53f,
  0x4df95506, 0x3794ed2e, 0x3e14e020, 0xe452d9b4, 0x34d51cd5, 0x8b1c5f86, 0xeb855f5a, 0xef63115b, 0xe5e17846,
  0x24aa5979, 0x2bcbec66, 0x9381dd7a, 0x1a5f1be6, 0xcd29ad6d, 0xa5ecc2aa, 0x6b492477, 0x0a541af1, 0x6a0964b0,
  0x91292bf1, 0xe2735b56, 0x5361cd86, 0x9173fbea, 0xfc0cadd1, 0xd5fb3921, 0x42982888, 0x0b52a1ff, 0x900ad64a,
  0x7ccf5f89, 0x25c938c3, 0x331d9daf, 0x95737f0e, 0xe2dc48ea, 0x9799abe2, 0x37fc1ccc, 0xf3a17b0d, 0x60f57d08,
  0xeffcd9c4, 0x7d561553, 0xd454288d, 0x8917aaeb, 0x54a00381, 0x8e8ea4ed, 0x10d1f4b5, 0x8cdd30cc, 0xb1802987,
  0x88da8b98, 0xd81a375a, 0x246a4144, 0x20a1699d, 0x43c35d7d, 0x13ab6ca1, 0x73b5e9bb, 0x16c88244, 0xbb90f0a5,
  0xf3c3fb24, 0x2f611642, 0xd01b7de0, 0x2ff4e569, 0xf09b9c21, 0x4fed2ef7, 0x6b2436c6, 0x81a98e60, 0x46b6ef19,
  0x21db52ed, 0xbeb91e09, 0xc3eea3b4, 0x534bc1d0, 0xd4c88ae5, 0x9c4fc04a, 0x7fe03d26, 0xb40e0a08, 0x9e0282d8,
  0x61fe08d5, 0xbe833afb, 0x58c0ae4a, 0xb227b92d, 0xe558c4de, 0xb895e9b6, 0x66012c65, 0x4a9d22a5, 0xcf9c55be,
  0x175343bc, 0x8d9c23ff, 0x086362fa, 0x19c61827, 0x5568e6fc, 0xb8d4546a, 0x8d2fde9b, 0x925cd556, 0x46fda279,
  0x871d21d2, 0x83591f63, 0xf07c3c4c, 0x4935b71a, 0xc1b344a1, 0xfe505ebd, 0x9687483a, 0x4f6ea590, 0xafbc0bdc,
  0xebdd816e, 0x700c7d26, 0x4b3122e5, 0x7fe39b4d, 0x2b9a4cd5, 0x9e822856, 0x6e2d79a9, 0x71f1abef, 0x8c633d6b,
  0x05835200, 0x9dae2fe0, 0x8bfaa127, 0x510d7783, 0x6f1170af, 0x53f1c621, 0x14075930, 0x0a4b5841, 0x65f40554,
  0x007e3458, 0x3e3c03ce, 0x346988ba, 0x41f74a78, 0xfdbbc909, 0x4aad1349, 0x07c0b111, 0xa24a2da7, 0x94926154,
  0x1d614500, 0x1ce42c5e, 0xf180cd11, 0x5206af85, 0x63672350, 0xef0cc1c3, 0xe7c274f7, 0x05d99913, 0xf4b8ec26,
  0x8a32ed3f, 0x1ef28f78, 0xcf81bfa5, 0xbbd23222, 0xb9782c4c, 0x6aeac41b, 0x1e366fbc, 0xe128c542, 0x1f3ebc20,
  0xb854fd38, 0x64fda32a, 0xf5e62e89, 0x34313297, 0xdc609c7f, 0x4e8bfb6c, 0xb3f1fd11, 0x17744e7c, 0xdc40d45a,
  0x5cf96eca, 0xca61cfc1, 0xce2b5b6e, 0xa37a6e0b, 0xcaf4286a, 0x48e4430e, 0xc6e8b4b4, 0x1a55f28d, 0xb6c295b4,
  0x962d9852, 0x6d4bfe37, 0x35ed454a, 0x85941b5f, 0xeaada71e, 0xad340b2f, 0x4a5bc00d, 0xf148e753, 0xd729909b,
  0x6aa59cd0, 0x069974ef, 0x714dba62, 0x3f15e96b, 0x5d25ae0e, 0x9a6ab190, 0x9a5ead6c, 0x1bdd79d6, 0x8cd20e59,
  0x37cd67d2, 0x1e681d96, 0x012b6c9e, 0xfe048472, 0xb0035e5d, 0x74b71813, 0x84830769, 0x3771f56f, 0x3547e706,
  0xaeb9fcf5, 0x327ab16e, 0x371ea84a, 0x7d4e6424, 0x04d730a5, 0xb09e184f, 0x9df4e9a5, 0x2654be00, 0x0b1bcc1e,
  0x45e43f4c, 0xeaec1de1, 0xad7e7a89, 0x69a7853c, 0x8ee6d6cc, 0x86409379, 0xb0db701f, 0xc0c778e9, 0xe35c9045,
  0x5b550f64, 0x26b9f38b, 0xdeb3a78e, 0x1b137688, 0xb96a7356, 0x34612ae1, 0x978267b6, 0x8cf6887a, 0x591b5980,
  0x76279cf2, 0x31a55183, 0x0950bd72, 0xaa65c1f3, 0x1c083618, 0xc207ca49, 0x36a24d47, 0x2b65183d, 0x78f27894,
  0x404b01b4, 0xe6aefe0c, 0xa76e74ff, 0x3734279b, 0x6b51e4f5, 0x5d8d066e, 0x056e42f9, 0x93d3bf5b, 0xac79e6e4,
  0x4e0bd1b1, 0x1dc7d69d, 0xd651b0ff, 0x88c11966, 0x3859caa9, 0xe0cd0ca5, 0x20c1dabb, 0x792d6cce, 0xc36619e4,
  0x6552a2d7, 0x3cbac998, 0x38e5400a, 0xcccd31ba, 0x38c69664, 0xcf71f3c6, 0xe20a6df2, 0x373b0778, 0x0594cec0,
  0x0cb1fe58, 0xd2b56f7e, 0x3625ff11, 0x15d6992d, 0x399c2afb, 0x0910e9bf, 0x6285b4bf, 0x2b52beb7, 0xe913d89a,
  0x89cb93cd, 0x409cb10e, 0xe4fddc37, 0xd07e63d7, 0xfa58d74c, 0xdba429ba, 0x59da602d, 0x70df2e44, 0x70ad3fbf,
  0xc11b9f22, 0x8854bb02, 0x94f0fb3b, 0x9614cd92, 0x67652daa, 0x574edbec, 0x659b73aa, 0xc1882f6a, 0xf3b82dd4,
  0xf80f98a7, 0x3b76fc33, 0x9efac886, 0x3f620539, 0x88a2a437, 0x47c3ad67, 0x954771e9, 0x5ea0ff96, 0xea46fbe2,
  0x4f3f0751, 0x5e37f05c, 0xf6539fdd, 0x8570f25a, 0xa72d7fe1, 0xa64b2e90, 0xe12716e6, 0xfb8db8c4, 0x8ce7a1a0,
  0x6a26cbd6, 0xa1624389, 0x8e7d5da9, 0x5b4a2f3e, 0x8bb33cd1, 0x98d08973, 0x7e93a750, 0xa85543f6, 0x9b835722,
  0x5cf9f885, 0xa3c9d3f9, 0x2ccc3711, 0x566b48e7, 0x22b135aa, 0x3c943d09, 0x4ca399a2, 0x37136aa3, 0xc4902710,
  0x9090725f, 0x994f2db6, 0x990a6eec, 0x0098b9ac, 0xda333ab4, 0xbd2ba7ce, 0xd750a2eb, 0x49ed40cf, 0x5732d76a,
  0xd84c2b97, 0xdfa6d81c, 0x09ab0889, 0xe95fbbfa, 0xe1f52631, 0x54b2bbf1, 0x5aadaaab, 0x9782c11d, 0x36d2f9aa,
  0xf3edd16c, 0x97525e78, 0x08af74c1, 0x7926887b, 0x99089f38, 0x853c82f3, 0x1a7eb162, 0x03dfdc81, 0xc96edfe0,
  0xd78129d0, 0x07cba465, 0x22c8bd68, 0xed44170b, 0x78fb97dc, 0xc93fb781, 0xb2674acc, 0xee87e8e2, 0x6e19a660,
  0xf7035514, 0x63b94d7b, 0x6fbad93e, 0x84dae909, 0x9be891a8, 0x6a76f1ec, 0x6cb1c69f, 0x3e4977cc, 0xc218dde5,
  0x4af00c34, 0x77fb7e19, 0x1bc021a8, 0x29591f13, 0x10acfcfa, 0x8a55e743, 0xf5277bf2, 0x9519c16f, 0x0da04f77,
  0x0d0f9826, 0x719d2236, 0x529132bb, 0x2de2af22, 0x3b4787d4, 0x7b8d91f2, 0x797ab2f2, 0xe9dcc697, 0x09e24ade,
  0x61e4cdaf, 0x44be1d15, 0x84e86601, 0x06e3e8d9, 0xf1e8c098, 0x03108853, 0xa0797839, 0xcd5f73b1, 0x66a61856,
  0x29f8de66, 0x61333da8, 0x8b150f87, 0xacba9655, 0x2e939ec4, 0xe8f1b5d3, 0xf919305e, 0x93861ea9, 0x869ff3ef,
  0x95662f2f, 0x86c2a580, 0x6af9580d, 0x7a410c05, 0x94ac1ef6, 0x546b0589, 0xe818498e, 0x0172c398, 0xb1ab8f9a,
  0x01946f31, 0x3f17fba6, 0x65ca37d0, 0xe76e793a, 0xe62d8598, 0x4d94c57e, 0xae1135dd, 0x722a975e, 0x6d883bbf,
  0xad392e07, 0xd1f43847, 0xdc34d779, 0x549799f6, 0x4445563f, 0x0071f486, 0x6b58703c, 0xf4f17291, 0xd1e8d588,
  0x9a595dd7, 0x344436eb, 0x07740800, 0x4fc1cbee, 0x87dfb834, 0xc271aef5, 0xdc46d684, 0xf02c19c5, 0x3074747a,
  0x914f32bd, 0xd9f53372, 0x196286c8, 0x0cc8a3a0, 0x14bb9855, 0xc823b0c2, 0xc8ff5ae5, 0x1a11a7ab, 0x64b4ee5d,
  0x3674bd79, 0x8d3155da, 0x550d20b4, 0x5758f140, 0x83e3283e, 0x78204e7e, 0x4e9eb628, 0x5944b0a2, 0x1f0d335e,
  0x8d75f524, 0x893992cc, 0x7cb4f854, 0x5145640a, 0x7c610a4a, 0x41669688, 0x39ee9e85, 0x63a2fe3a, 0xb8055430,
  0x5232817d, 0xd8214c8a, 0x30e88dda, 0xe09ae1e7, 0xcd997247, 0x4077539f, 0x4bc81cb8, 0x75ccd413, 0xcb58e01a,
  0x370d323f, 0xe50c66ea, 0x782965d6, 0x89b49aee, 0x042f943b, 0xb1b34681, 0x77df013c, 0x57ad04fa, 0xe04d6a01,
  0xdd4906e2, 0xfd73c722, 0x72d41ab0, 0x60bc3649, 0x4344ee4d, 0x5346dc2d, 0xa1e69ee1, 0x223a6570, 0xa25d930e,
  0xfef48c11, 0xebac4672, 0x2444a008, 0x1f7f6247, 0xdc44eb8d, 0x8fca82d9, 0xc3d18ca6, 0x7b3fb8ac, 0x6bae632c,
  0x6d621b90, 0x3890df40, 0x69cffe3a, 0x7be3226f, 0x992ce171, 0x3ae29e31, 0xd031f8e2, 0x967f7d53, 0x547f8486,
  0x06cf43b7, 0x54586326, 0x060087b9, 0xe8905d6a, 0xcd8f607e, 0xec969f8c, 0xeb48a130, 0x4db514d7, 0x8e1bcc3f,
  0x25610a13, 0x1bc11b5c, 0x104b9931, 0x46874b5e, 0x10c69b36, 0xd98bb373, 0xe5a7b3ba, 0x94af0eff, 0x434b6dd0,
  0xfeac3d87, 0x328b4756, 0xe3da15e3, 0xc8cace36, 0x55507aa8, 0xd39fba53, 0xb24e9fef, 0x6c87c472, 0x6583fb4d,
  0x694ea296, 0x40287a5f, 0x6486671d, 0xfd1b3d3c, 0xd8a20296, 0xf82315a7, 0xc2f46e04, 0x25d2f99b, 0x956059e5,
  0xed8927b9, 0x657e4c6d, 0xcc574130, 0xa6a19136, 0xcce05d52, 0x39a1785e, 0x1f0fe5f0, 0x0c4973f4, 0xd44bfb65,
  0x1def7e11, 0xc98b17bb, 0x5f76523a, 0x8b68928a, 0x372ee18d, 0xf05c53cd, 0x9727064d, 0x47651f58, 0xaf024836,
  0x044f51cc, 0x77f81a8b, 0xa021b9b3, 0x50742dbf, 0xad097625, 0x0fceb780, 0xddc439a4, 0x49e9e2d7, 0x5091dcad,
  0x9c5b7ed8, 0x9bfd77c4, 0xdd864e16, 0xf3c1f762, 0x15cfaa11, 0xe4d02da8, 0x53963e18, 0x7c821d5c, 0x80f05d40,
  0x24f0fafb, 0x2cf89ddd, 0x69f11bbc, 0xd361ace8, 0xc998451f, 0xa00f1bdc, 0x3dd31613, 0xe3ae277d, 0x32035610,
  0xd6d27f58, 0x58f68542, 0x9b4836c5, 0x3cd2681d, 0xd699eb49, 0x2b0db00b, 0x3616ea60, 0x74b131ce, 0x16e177cd,
  0x9fff4a10, 0x6f7d5dc9, 0x8fc66671, 0x7bef87a7, 0x1cf21476, 0xb9fe4e78, 0x0cd0dd29, 0xe7993b51, 0xd98da8f7,
  0xb9ca95ee, 0xdfc57db9, 0x71dd5bab, 0x4168077a, 0xa31ed06e, 0x986d96f8, 0x265179ad, 0x0258577c, 0xe073543c,
  0x7eed41f3, 0x0c7bb76d, 0x8709b2e1, 0x2a1c5da0, 0xc0935901, 0x8a2c3f6a, 0x33d80852, 0x4b29cb2b, 0x68a9e0c2,
  0x3b55ff6d, 0x80b1559c, 0xbf19b34e, 0x1c7356c4, 0x610c806a, 0xa5116d2e, 0x5a010a8b, 0x5f3f1133, 0x0a7eef0c,
  0x42ad197d, 0x7f77b78c, 0x35ce4700, 0xae5c3dc7, 0x982a3462, 0xdb191a11, 0x9ce3bc62, 0xd776efb8, 0xe3829552,
  0xd797d1ee, 0x6f177b0e, 0x7e0f8ea4, 0x443b18ae, 0x18734ed8, 0x7a9fa5dd, 0x5eb4d8a7, 0x437408ae, 0x5bbcced8,
  0x168de1c6, 0x9c556b88, 0x030d0573, 0xb53317f2, 0x518df481, 0x417ad025, 0x39133f9d, 0x09a39690, 0xd4efcf93,
  0xa23eea50, 0xf6dc9e0e, 0x87549f74, 0xb2eecac4, 0x2154d782, 0x6d6e53b6, 0x8d68e072, 0x0c202aa2, 0x9eb5db76,
  0x7d59fb64, 0x31f230d2, 0x8c9ed547, 0xf6419a39, 0xacb695dd, 0xe11a4f21, 0x0bbfb09b, 0xe58383ab, 0xb5bd3272,
  0x2da7df34, 0xac032a83, 0x805c7bd9, 0x285bcdee, 0xa00a37a6, 0x272ac0ed, 0xe20b7f4f, 0xd37750f3, 0xc799adad,
  0xe12c6b28, 0x596d02ea, 0xe86cc435, 0x768b1199, 0x93c70768, 0xb875f4c7, 0x59d8f97f, 0x88e88f6d, 0x8b9d1424,
  0xe29a8f0d, 0xbca22787, 0x101d786c, 0xc2dbcaf4, 0xbb1aa120, 0xad8c2a8e, 0xd6c7f5e0, 0xac29ffcc, 0x0c03f85a,
  0xc2e08281, 0x6f030099, 0xb027faec, 0x2c917aa9, 0xfd39d0e4, 0x35d11bc7, 0x5cb7e27e, 0x43de4707, 0xf703536e,
  0x710d3426, 0x4ad7723e, 0xe27a74aa, 0xcaa0dd8e, 0x5e9e76fb, 0x72b9ef2b, 0x95362963, 0x04044041, 0x5ceb5078,
  0xfc3ef392, 0xf906328f, 0x4a50da8d, 0x4923302c, 0x4d7cebc1, 0xea706e55, 0xc782e46d, 0xa57d712e, 0xe2e755ea,
  0xee6c79b2, 0x656fe6ec, 0x98975f24, 0x8951ad4b, 0x29326ebf, 0x85c9b5cc, 0x9afd6d08, 0x8d09651e, 0x76189c1b,
  0xad3e2ace, 0x3372e674, 0xdbfc0a00, 0xe6aad2fc, 0xa84dadf9, 0x53af5d0d, 0x4a159658, 0xaf69eefb, 0xaa4c09bd,
  0x8e765bac, 0x9decaeaf, 0x1f61048f, 0x0d0e91b9, 0xf7c783c0, 0x4c301ba7, 0xb3046429, 0x9377ef9c, 0x042bdd78,
  0xb4717a61, 0xaa3c9bd6, 0xb4470360, 0x6918d144, 0xb88b084e, 0x22d5b017, 0x03ecb70e, 0x52e9ee48, 0x00a68c35,
  0xb8e72b60, 0x5783e670, 0x72431a3f, 0x8ac3c4aa, 0x56dd8aa8, 0x6d6c3aab, 0x973ab1f2, 0x468c77c2, 0x3b8f3b41,
  0x53972d05, 0xa7a84169, 0x542e3ba2, 0x92cae02a, 0xb51f3b29, 0x9a7b6e3d, 0xe943a4b7, 0x40b4250f, 0xc5cd9742,
  0xff27366b, 0x569f392c, 0xd8c6c202, 0x3d8b6c4b, 0x0d62f816, 0xbe36f227, 0xa05bd1dd, 0xe2e9f000, 0x05660a35,
  0x60f203bb, 0xd2febc62, 0x9d9e7a33, 0x2c1c0abb, 0xbd248b37, 0x54919eac, 0xd6101110, 0xf7e38c34, 0xacbf5e76,
  0xc0ae7282, 0x5bf85e83, 0x9c69de84, 0xa30b60b7, 0x7d5e6e2a, 0xbbbaee98, 0x884cffaa, 0x821aca1a, 0xd8bd12c6,
  0xa2397cdd, 0x7dba991c, 0x3ab82d81, 0x62d984d3, 0xb519337a, 0xc534dd26, 0x34a16251, 0x0cdbf5ab, 0x86dda9ac,
  0x5ecc6b77, 0xd687da43, 0x13e25cc1, 0x2c79e3a7, 0xf6f99fa7, 0xb5d078a1, 0x348b8e4a, 0x8caeb9cc, 0x98975e15,
  0x55db5d16, 0x44aa4afe, 0x63a5d80f, 0xcb99f2c1, 0x3cf809db, 0x3a19ae2b, 0x16f994de, 0xa353fa3c, 0xc6268498,
  0xb301b5bc, 0x24ab61b8, 0xaae3999f, 0x3e89d0f8, 0x4e7b41c0, 0xd84f650c, 0xbcf991e4, 0x66265451, 0xdd820ef8,
  0xed956a21, 0xc7d843dc, 0xb9992aa0, 0x6bb86d33, 0x67bcf26b, 0x7d3857d8, 0x739116a1, 0xac5a3c40, 0xe4019c5b,
  0x8a8b188e, 0x94a428a8, 0x5dbe2c32, 0x7ca1d8a6, 0xcde84439, 0xdddd3a1d, 0xc436b10f, 0x18fe374d, 0x8aba32ec,
  0xd7354cce, 0x4e0db0b1, 0xec51f3ff, 0x09011a7f, 0x9a40a1a2, 0x46d45e57, 0xa3f88844, 0x8efdbe0f, 0xf548069a,
  0xc42a4a6d, 0x0820ce33, 0xe2b67659, 0xa637594f, 0x144bcaeb, 0x04fbd71b, 0xb637dfe7, 0x1a9400a4, 0x96bfc733,
  0xf87814f7, 0x063f6374, 0xd0353c3e, 0xbac73ecd, 0x73da4c29, 0xbb158f5e, 0x4d5b0e3f, 0x3ae4b8ef, 0x03842463,
  0x62e303a3, 0x6663a305, 0x3f503dca, 0x1e21ef29, 0x2efe7087, 0x84cc5751, 0x8b591c93, 0x8d769da9, 0x95ad153d,
  0x34c490e5, 0x75eba6a5, 0x4c2fb48f, 0xa9e98902, 0x8da1d4ea, 0x3dfaadb4, 0xa5241504, 0x175fb6a3, 0xe2084147,
  0x27cd870c, 0x281062c4, 0x7d4f02da, 0xde0cdbc7, 0x0e857609, 0x2f92eb38, 0x97b1ac0e, 0x23926b46, 0x86060ef8,
  0xfded2264, 0x5d39df69, 0x07bd5bce, 0x8711668f, 0x0ed76c6c, 0xd8b86dc0, 0xd44928b6, 0x2388447b, 0xeaf1b678,
  0xa48bea43, 0x4cba24f9, 0x8dac6d63, 0x6a8ce76c, 0xc28677ad, 0xfa9147b9, 0xaa0b674c, 0xc35e370b, 0x6f1008f4,
  0xf9db2b6f, 0x9ddd2dc8, 0xdc2edf5d, 0x52834836, 0x598cad24, 0xd653669b, 0xb9beca83, 0xec346560, 0xe2c209fe,
  0xf61b5490, 0x67f91255, 0xf14232be, 0xf238e950, 0x1a98a29b, 0xf4f54b85, 0x12d79033, 0xb4ebc902, 0x94a05227,
  0x0eda21eb, 0x8076b70a, 0x651a376a, 0x3646383b, 0xba1ebca1, 0x3e56d0ef, 0x33ae6852, 0xdfec77b2, 0xcc8b8928,
  0xef4438bc, 0xb565d9e0, 0xd0eaecb1, 0xeba8ea2f, 0xefb95961, 0x73010790, 0x89a411ad, 0x3dd57d29, 0x19c46e38,
  0xacaafe54, 0x46ca441e, 0xff4d5249, 0xf8214a7f, 0x78de441a, 0xf5594dc8, 0x52798ec6, 0x7484b56e, 0x0b29521e,
  0x83f1fc11, 0x37f8b01c, 0x98d4f5e7, 0x7f6000e4, 0xc3ad4066, 0x0472f95d, 0x232603bd, 0xb173bd9d, 0x0bbb5160,
  0xe5dbb414, 0xc204b89f, 0x59403b8e, 0xa40b6997, 0x0cb47fe2, 0x203e3be2, 0x371cd483, 0x972c3a51, 0xa34448b8,
  0xcb5100bf, 0x921d5829, 0x2bfd03b7, 0xb5f3c19c, 0x25c0e161, 0xb66e2f4d, 0xc91408b2, 0x18f23395, 0x225e9e04,
  0x837264a8, 0xb76e2043, 0x1dace071, 0xab50527d, 0xb4e0f185, 0x72bbc6e1, 0x7411c118, 0x85319b14, 0x83af7e6f,
  0x23ee1355, 0x92828609, 0x85bd34cc, 0xe05128bc, 0xae8836bb, 0x5c0cf24d, 0x516db711, 0x051c7ab3, 0x852fe83a,
  0xe02ba695, 0x2372a2d4, 0x48bd5b99, 0x69b5df80, 0xe47d2d8d, 0x1649be32, 0x80c4dfcb, 0xdbff4b49, 0x2bc9982c,
  0xb5babdcd, 0x8482bca9, 0x078fbd2f, 0x79787537, 0x7351c982, 0xb4e9471c, 0x3fcbcd2e, 0xdd9d6c79, 0xc26e9d4f,
  0xf6d7fa49, 0x8d99c81b, 0x444772fc, 0xbbc12b8d, 0xf26a5cb5, 0xeea3c03c, 0x1bbeba53, 0x581b8103, 0x91873828,
  0xaa9b6375, 0xce72f66e, 0xc9e8ed53, 0x894f0b18, 0x4fb2cc24, 0x72e54c8b, 0x50dc83c7, 0xc903ea8b, 0x7bc17987,
  0x2221f666, 0xffc7c775, 0x54d643a0, 0x29375351, 0x1daf22cc, 0x6e794a10, 0x03088ec2, 0xb58f4f29, 0x3cede08c,
  0x9ec18f99, 0x1e02bf90, 0xa7d7ca33, 0x0e94ea39, 0x92123f76, 0xab670095, 0xb6114f9a, 0x578ce19f, 0xdc0fa280,
  0x28aceddb, 0x1252438d, 0xbefa3064, 0x3ea7a498, 0x0fc855d2, 0xb3e8906f, 0x1f977d19, 0x69824def, 0xebd73d7c,
  0x9194df07, 0x8521bd09, 0xe4b3f2c0, 0xbfbc230f, 0xf3b798a3, 0x02d8a76d, 0x4ca96fcf, 0x01847395, 0x23593e80,
  0x60a77cba, 0x25a7f5e2, 0x8aae807f, 0x6b08f5e0, 0x632eb1b8, 0x0f8cd5bc, 0xf5461c04, 0x96f6811f, 0xb6987c9e,
  0x37135f61, 0x2dda3318, 0xea43bd2c, 0xa7228a31, 0x9c1299a2, 0x76257ae4, 0xae6379b9, 0x5c1be8c2, 0x06c1974b,
  0xcf9cd607, 0x94b9395a, 0x52f8742a, 0x8942bb08, 0x5244571f, 0xc2a17922, 0xa413c969, 0xc1577886, 0xdd38a4b0,
  0x59b8a32b, 0xfef73317, 0x9345267e, 0x38afd6ab, 0x7627e892, 0x3b534e66, 0x78a60b52, 0x4c3c6773, 0x82643dd8,
  0x4cac08dc, 0x3acb3ce4, 0x6dd2ece5, 0x88e8967f, 0x431afad3, 0x7d278121, 0xddd0c3c1, 0xf7b23e27, 0x9dc568ef,
  0xa63b06e8, 0x9211c727, 0xee788e02, 0x4daeb36e, 0x30f06a90, 0x3c4dcfb1, 0x290381b6, 0x43ae9432, 0x9eb555d6,
  0x0d1656e0, 0xb3584ed2, 0xe73adec4, 0xeb462005, 0x31b87795, 0x3da0c442, 0x78431470, 0x6c84cd57, 0x93b61204,
  0xac3f82ee, 0xa8819c37, 0xc4757820, 0x7ef98adf, 0x9531e6f2, 0x80545a82, 0xf4ca4c57, 0xe2352573, 0x23ca3452,
  0x86004503, 0x787aecfe, 0x5a969483, 0xfd6ff7ff, 0x06d3b66c, 0xb410dcdc, 0x4202b46b, 0x0a689ab0, 0x085f4e58,
  0x3d10a9be, 0x5034d450, 0xd65fe230, 0x7f44cac3, 0x342bd354, 0xfe248529, 0x2731b786, 0xc1a946c9, 0x4d419da0,
  0x89e693fa, 0x1fd270bd, 0x8ab63b80, 0x370c267f, 0x37f3e43a, 0xa5b2a49d, 0xa28cb1cc, 0x5e16bb68, 0x7cf5bf8c,
  0x22ea4157, 0xf0d6d769, 0xb47ba976, 0xb2765907, 0xaa9a20d5, 0xa61256e3, 0xbfe98515, 0x4acec06a, 0xd14aab2d,
  0xfe4ee8ef, 0xf13ce1f1, 0x6f7e5711, 0x49dc2c79, 0xaff3a33f, 0x7a21dcd9, 0xc160843f, 0xd5f5f546, 0xb7b2d4f2,
  0x2b48a7f7, 0x98e13771, 0x5b60e8fc, 0x090793c6, 0x5e1c37aa, 0x8926d8f5, 0xa1e7938f, 0x85a04681, 0x9f61eeec,
  0x723a9132, 0x5edf9716, 0x9502f2aa, 0x42582667, 0x2e3c5506, 0x9eef95aa, 0xd061b73e, 0x30115974, 0x8ff90e38,
  0xa31a6586, 0xc4490eb6, 0x2477e621, 0x47705e84, 0xbc6c377f, 0x089fa015, 0x67482c34, 0x08b2cddd, 0x89cbf17d,
  0x2804dff9, 0x5af8d1a6, 0x9cbe8ef9, 0x3693ce56, 0x7cffbde5, 0xa0f396e7, 0x37923092, 0xf4d15a35, 0x58e02cef,
  0x1cfd782f, 0xa6d73b9f, 0x33880011, 0xb10f96f6, 0xd74c01b1, 0x36d485a4, 0x59e11084, 0x503d8d86, 0x870bbbdb,
  0x9d9e17c7, 0xaf1a4489, 0xa097f415, 0xd73bdc68, 0x9f2d3b75, 0x9a1125f0, 0x3fedb407, 0x47fd57e3, 0x5ebf64d1,
  0xb8617b0f, 0x8ff8b4a2, 0xf344886a, 0x431c01cb, 0x385d6549, 0x1d630b7c, 0x6cabfca6, 0xe472e248, 0x2cd4c4ea,
  0x9c947881, 0x09cc9044, 0x269fc6a3, 0xbac017d4, 0x7e15ee9e, 0x8872b3df, 0x3b918419, 0x1f14e05c, 0x0b99854d,
  0xc9335878, 0x44339088, 0xb90b521d, 0x3b6c2dc6, 0x1650f4cf, 0x1f0a61af, 0xf1753fb8, 0xfefe675a, 0xc6cd218d,
  0xd3002576, 0x9fa15f24, 0x17708498, 0x37ca31ed, 0xde876a77, 0xc1961736, 0xfda3ab20, 0xc040db7a, 0x68ae5ae9,
  0xa0086770, 0xa2ec3254, 0x3b2533a5, 0xcac1979d, 0x3f5fe181, 0xb04696b6, 0x0b978b15, 0x7291ac93, 0xeae74806,
  0xc73aa12d, 0x094c11d5, 0x2b34b755, 0x3034b8f2, 0x527731cc, 0x2574ffd2, 0x17304cd0, 0x41938e74, 0x51e23167,
  0xcfa95b53, 0x4a937d5a, 0xaba08828, 0x0b54af67, 0x67daff83, 0x1d9d4f0c, 0xc48478ce, 0xb8d25e8e, 0xfc954833,
  0x5b5d17df, 0x7cf26610, 0x25139a59, 0x2fdead76, 0x7bf09b7c, 0xfe927f4d, 0xf05d139a, 0x26a2882e, 0x0e9e4da8,
  0x6b10d69c, 0x2a01428a, 0xd40ae7a5, 0x078e7017, 0xb463237f, 0xa4e9caba, 0x00d7b961, 0xff5a4dbb, 0x1ab5fb93,
  0x00d54e69, 0xa21f83e2, 0x980378eb, 0x5b53b668, 0x0d513bc9, 0x8ba99f02, 0x2b9ca1db, 0x16ef67a3, 0xa16c4d3a,
  0xe358b42d, 0x2e29dbfa, 0xe9ef8b62, 0xe78621b2, 0xb94f6016, 0x6c70b17f, 0xa3937ce9, 0xbde88c3d, 0x78735392,
  0x4cee7531, 0xa949ce95, 0x20f6f1a6, 0x4f0db3bc, 0xef197daa, 0xd24df13e, 0xd5d03d29, 0x9fdd9f80, 0x78d0797e,
  0x06760d34, 0x08ede501, 0x9ac359ce, 0xef5f4857, 0xa0b9be13, 0x338225cf, 0x5b444c94, 0x18df9d27, 0xa1dd4128,
  0x288a81c2, 0xa13f8644, 0xc60d8e77, 0xafca133d, 0xcf5e6c60, 0x8d1be036, 0x540b625f, 0x9caffe0e, 0x1f8f7f48,
  0x0183d210, 0x7f26b8c1, 0x99ab303d, 0x294ebc59, 0xf7e807fb, 0x39bb8b36, 0xe2d4af15, 0xc0105442, 0xd79a3397,
  0x9d85f0a8, 0xcdff8b2b, 0x5bd88fbc, 0xc87dffec, 0x44c5428f, 0x8187fb49, 0x701f2350, 0x4f00e406, 0xef214ce5,
  0xdd3c193f, 0x703b1f9a, 0x7513168a, 0x22e75c2a, 0x336ab0ab, 0xb815924d, 0x9f4656dd, 0xbc46f48d, 0xf98e9fd2,
  0x7ab1674c, 0xd40ee8e1, 0x4b2d82a7, 0x55287a62, 0xc4743d34, 0x9d926205, 0xd12ef967, 0x31368018, 0x7912f6ce,
  0x92adf890, 0xeaedf52c, 0xcd5626a7, 0xfd1f50e4, 0xe64ecd2a, 0xc1629e83, 0x9a4999aa, 0xb2f74ee8, 0x3560b9b7,
  0x549cc812, 0x1399bccf, 0x616365c1, 0x07600b14, 0x32aa86c8, 0xf2d4ccaa, 0xd0515c9f, 0x4c410ee5, 0x6dd1c942,
  0xd907fa62, 0xa6d951d1, 0x937c125d, 0xbd9da473, 0x13be9d2c, 0xb6d8a7ef, 0x4a3f5e22, 0x18bee92c, 0x7db29fe8,
  0xc843a3a9, 0x5de7b635, 0x50d253a0, 0xb50139b4, 0xae75ccee, 0x4237ef7f, 0xd3ed4581, 0x14ade5a7, 0x6f87f6a6,
  0xe7155bec, 0xabeead07, 0xcee860ac, 0xf59f9417, 0x728abc23, 0xd74c0a79, 0x211d292a, 0x3f3491e7, 0xc70f9e67,
  0xe1e698d3, 0x9a720e6e, 0xfa116c82, 0x5f6b9f0c, 0x23ffca52, 0x4742d5b5, 0x24c39ea2, 0x3ba4313c, 0x9a27fd57,
  0x52c7f005, 0xacfe60bf, 0x5c5e56e9, 0xbeb78f90, 0x04b5a3ec, 0xc65c3e91, 0x8c194b5a, 0xb93f0e8e, 0x2be1c08d,
  0x63cbffb3, 0x812da962, 0x07477507, 0xf957f89d, 0xf5229948, 0x826b3ae3, 0x82d9f909, 0x38f819f7, 0xabcc7a0a,
  0x078749c9, 0xbab774c6, 0x00cb726d, 0xb385047a, 0x5e1d3165, 0x58555aac, 0xe5ed56a2, 0x00ba804c, 0xb145f140,
  0x52845caf, 0x520300a0, 0x5dc3d9f0, 0x2a3968d7, 0x3db5dfd4, 0x0a55a640, 0x586ae26c, 0x4e4818e5, 0xc0c5e318,
  0x97d2e08b, 0x106d6766, 0x3c29c626, 0xb69805b9, 0xc504f51b, 0x70f58c1b, 0xfdf4daf0, 0xa6c1ab8c, 0x5cadadac,
  0xedbe674e, 0x0394a2eb, 0x30ff25e8, 0x8b2b3497, 0x86cfd177, 0x650d11e4, 0x0c28522e, 0x44075c15, 0x87b95987,
  0x44464a4f, 0x83c10054, 0x22527ca3, 0xf4a73782, 0x083c9752, 0x11ebc420, 0xbd2b2da7, 0xfd956b3e, 0x18f26e1b,
  0x6d4bbbf9, 0x5e52c836, 0xccf325ed, 0xf462af4c, 0x7ffc533e, 0xed539be3, 0x65bf1e7e, 0x84d0a423, 0x753b6256,
  0x55c7677d, 0xca568ae6, 0x717df48b, 0x433c8c2c, 0x78a19b34, 0x2c6a912d, 0xf9859040, 0x7dc4ee93, 0x3788fab0,
  0x1c14be08, 0x88537df1, 0x5f6778cb, 0xc738c7c4, 0x68ea88a9, 0xd8da7396, 0x9aa86cb6, 0x06cb50ed, 0xae9f14b9,
  0x023dd237, 0x50845d63, 0x969d77cd, 0x0d8d81db, 0xffe99454, 0x5c0ae0c9, 0x8efc6e0e, 0x65c232ad, 0x288aadbf,
  0xf1c65461, 0x72adbdcc, 0xa5889193, 0x41406ed1, 0x8761b12e, 0xd7ea760d, 0x1d331762, 0xf72fcad9, 0x28799bf6,
  0xf94005ab, 0x019faa97, 0x38e988c1, 0xed52b0fe, 0xf57cb8bf, 0x4102fd3e, 0xe5633525, 0xe6d6783f, 0x9fa37d5f,
  0x12073fba, 0x8942cfbf, 0xcec94f53, 0xba945e2a, 0xbe25458d, 0xb24269a9, 0xe257dab9, 0x7b79b324, 0x299d8ee4,
  0x0643aa5b, 0xd557430a, 0x5663d47f, 0x0389f032, 0x439e06fa, 0x6f3caf57, 0x7d24b020, 0x4fe3c6b7, 0xb9400765,
  0x9fb9a6dc, 0xda6c485d, 0x6dea6da6, 0x68708138, 0xc790da13, 0x44d1ef37, 0x03f71642, 0x874fefe6, 0x59ef1a42,
  0xcd4bd7b2, 0x8a0d37ac, 0x0c1a5e35, 0x0861a01e, 0x7dfe8c1d, 0xa010b73a, 0x21d5ca1d, 0x268c9d77, 0x54313555,
  0xf130de6a, 0x60a1747e, 0xa463756f, 0x12551a49, 0x58c1f97e, 0x6b33ddfd, 0x6d6d5334, 0x1250b957, 0xa2199da3,
  0xa36982fa, 0xfe44b744, 0xc0da08d6, 0x945a92c1, 0x3860d83f, 0xef87be9d, 0xd98da599, 0xf138d6ab, 0x20318942,
  0x1c1bb698, 0x8f9549e8, 0x789b25e7, 0x5a59b0cb, 0x28acbec6, 0xb9c40851, 0xf7de4654, 0xfab92c77, 0xb307e406,
  0xc57c2f5f, 0xcc5e308d, 0x22c9771e, 0x3ed9cb03, 0x07551570, 0x09cff78f, 0x07eeca6b, 0x23b09c1e, 0x551eb35d,
  0x3cf3f126, 0xf0a6590f, 0x5fa240af, 0x8f73da3e, 0x912f8ee9, 0x2d8512d3, 0xd70cac31, 0xc4fca76d, 0x6c2156de,
  0x2092f43d, 0x71939b5b, 0x805a86a1, 0xa8f31b1e, 0x421b972f, 0x98af6a14, 0x030a0e1d, 0xf2a5ef81, 0x6b91aa19,
  0x4e379b75, 0x72561be0, 0x569b2062, 0x4e3f86ce, 0x0a4b6688, 0x9fa143da, 0xa50d532d, 0xeec2830a, 0x32db038f,
  0x49e201d9, 0xc6350502, 0x1d17e964, 0xa5f60530, 0x561883a8, 0x1e514f27, 0x248a4a3e, 0xfc0d1674, 0x1155b86e,
  0x1688960d, 0x2ae5f597, 0x4aee742f, 0x65ea5fbb, 0xb8f86eca, 0x44d622ee, 0x5c22fb6b, 0xd3cf7d19, 0xd09b0791,
  0xf831941f, 0xb53f91f8, 0x2d28c1af, 0xa0341772, 0x8e1ff4e9, 0x0158cb03, 0xab0e1ddd, 0x9d99fa2a, 0xea20f379,
  0x83ad3c3a, 0x8cd2c354, 0x528e0f5b, 0xad9d0a38, 0x891667c7, 0x976ce322, 0x780bbeb7, 0x6a7b4357, 0xcd6fdacf,
  0x253e642b, 0xcfd0a67c, 0x1cbcace8, 0xf41bbc50, 0xf792b586, 0x0e409fe1, 0xacb8c984, 0x3a304cbf, 0x82a9e823,
  0x6df04077, 0x602c0fe3, 0x51122b43, 0x5e12ae0e, 0x96184a86, 0xb218c738, 0x19d013c5, 0x801999ac, 0xdad1f3b6,
  0x99d44e8d, 0x7b6ec689, 0xb874c1d5, 0xb366782d, 0x269c9e7e, 0x53276bf2, 0xc0e0cfaf, 0xd77e23ab, 0x80f1c7ab,
  0x9c9fcb7f, 0x39f5c548, 0x6277f2ee, 0x2c7b67c1, 0x2bf234d3, 0x28ac4c5d, 0xcc66e718, 0x4c034f5f, 0x3fe94239,
  0xfeefd649, 0x5091bbe9, 0x7fb518b0, 0xa1835aac, 0xcd0c629b, 0x6dc2fdc9, 0x6d8d252f, 0xf751af15, 0x6365474e,
  0x6c28bf61, 0xf242d833, 0xf27c9475, 0xb1c64eea, 0x273141e6, 0xb2e08769, 0xed430ace, 0x41b55d99, 0xf975d2c3,
  0x5ef66376, 0xd3712285, 0x62eea537, 0xed8bc0c6, 0xb8fab6cb, 0x644b188f, 0x9cac6d93, 0xf72283bb, 0x337f5d75,
  0x316354d3, 0x53a822d8, 0xc44fb0be, 0xdc809229, 0xd7d18d4e, 0x0c4a67e0, 0xb44d1e8b, 0x19d60b5e, 0x09bc4055,
  0x4f06e2cd, 0xf1fb9331, 0xd2f9c064, 0xdaf95d9e, 0x9c4853c8, 0x1c350ed5, 0x4c22bf8a, 0x138f36b8, 0x691beae4,
  0xbf4d25bc, 0x1b0d0af5, 0xef80c024, 0x1c6002c0, 0x6d57fe6b, 0x42dd5baa, 0xc4255b01, 0x224ee419, 0x96c13229,
  0xbd088dca, 0xecfbc4bb, 0x3038716f, 0xf37940cc, 0x6dd89d16, 0x8c2723a0, 0x2e3d1984, 0x1a62ae95, 0x7b18d213,
  0x810b0f71, 0x1308a65a, 0xee0be84a, 0xeba95127, 0x0fe7136c, 0x1c452765, 0xd02e3844, 0x33bbdb23, 0xcbbe40e9,
  0x94f8718b, 0xc9839388, 0x0b84527c, 0x5163417b, 0x0d2f9dfb, 0x11599d90, 0x94108940, 0x8d895a69, 0x026ff845,
  0x2cdedb7d, 0x2a0ef4eb, 0x0d866122, 0x6aa1d0cc, 0x7af2ac15, 0xceb95599, 0x4c2e8140, 0xaf4dbcea, 0xb7d3446c,
  0x0151d02a, 0x3ee185b6, 0x980e4f2e, 0x12361197, 0x38b4e7e6, 0x3e8aeb50, 0x9839e890, 0x5d1fa1e3, 0x371d5d59,
  0x0286a699, 0xa5752c9a, 0x4ce68519, 0xebd909e5, 0x500f75c0, 0x53bffe52, 0x833ade98, 0x1fd21451, 0x9bea07d6,
  0x5af5da01, 0x2925e2be, 0x9e11500f, 0xf9dfd960, 0x0a0481a1, 0x547a6a96, 0xec1cc205, 0xd6fc0da5, 0x9c81075e,
  0x93e84d78, 0x3b7628df, 0x68402e1b, 0xedcdef97, 0xd63efafd, 0xd8e0f149, 0xd30ea317, 0x155279f9, 0x74d57630,
  0x78b30245, 0xf3c47ccb, 0x8a5146a6, 0x146b2f84, 0x62340547, 0x44adfdda, 0x61738234, 0xb7a59c02, 0xfd0111c4,
  0x78adb56b, 0x09037bc2, 0x4b215a12, 0x4b71615a, 0x2c5c23c3, 0xc74943d3, 0xf14296d2, 0x2878035b, 0xa64df84e,
  0xa5cd930e, 0x49dd1b02, 0xb51740e4, 0x8a5b1371, 0xda065640, 0x54c52d80, 0xa8c57533, 0xee2a1927, 0x630bce10,
  0x37377946, 0x8db22e85, 0xb3155f1d, 0x2d600031, 0x2f246d45, 0x0dcc71dc, 0x59423238, 0xce7be244, 0xe6c39346,
  0xe7f3164c, 0x77452549, 0x31f844d6, 0x0f9846f7, 0x3ab755b7, 0x9069525e, 0x77a2e9ff, 0xcfa7ef44, 0xda720288,
  0x1ef7d002, 0xfb7116e8, 0x5f41c548, 0x072b5678, 0x2f3192d9, 0xf1dfaea6, 0x0327c1b1, 0xe0d3e463, 0x2539e08a,
  0xfcdf458b, 0xfc17a289, 0x8875c836, 0x0db98ac3, 0x59a5bf46, 0x42f3def6, 0xc356f8ae, 0x815beb40, 0xe2a5ed12,
  0xfd526592, 0xd08fce85, 0x64fdc6b4, 0xd29e4d4d, 0x41ca0354, 0x48a613ba, 0x5071df7d, 0x7d131cfd, 0x46d8af84,
  0x508a4e49, 0x6e87b2f1, 0xb74150eb, 0x1270821b, 0x45dec032, 0xc9dfdd39, 0x52732741, 0x45cea87c, 0xe2349805,
  0xb7a08891, 0x03e3112f, 0xa6c96c42, 0xdcbd294a, 0x2ce4cfea, 0x15dfd93a, 0xd72793af, 0x5bb1969e, 0xefbae43a,
  0xaccb6d58, 0x6e16d85a, 0x852753ff, 0x4f90f110, 0xe5814c7d, 0x1feeadaa, 0x873aefc4, 0x24b7cb3e, 0x55e006bc,
  0xa1f7b019, 0x1fa09d47, 0xc3f8325a, 0xa8996be9, 0x34daae1f, 0x21f7b144, 0x6a32d3c0, 0x740d3fe8, 0xdc34c2f2,
  0x2a5aff0a, 0xf140a67f, 0xccae9dfd, 0x11acd04f, 0xf4324e0c, 0xf4c48d81, 0x1298830b, 0x582210fb, 0xecb2ae36,
  0x2dd77911, 0xecf0b563, 0xbc89b4c3, 0x44f1b505, 0xbfbed2e1, 0xb1112153, 0xaaa24024, 0xcd1a4e80, 0x73c5aec7,
  0x7dd8535f, 0x30e4fcab, 0xca4b1599, 0xfb5fcae1, 0x60cc025e, 0xe2d1db97, 0x09bb5216, 0x0fa34c2e, 0x8f5a9014,
  0x9e8d2167, 0xa2a16e4c, 0x1154623c, 0xb9856f2c, 0x81aa8d78, 0x3dd37ce2, 0xc6551637, 0xad31bdd3, 0x6cc83dda,
  0xc1809de8, 0xf7bbeddc, 0x55cf38de, 0xba4eb0cf, 0x966e5ab1, 0x517e7a8b, 0x8be3d42e, 0x0934635c, 0xcff2ea77,
  0xd32df2a6, 0x703bfff6, 0x3f5d7d14, 0x2e08cbff, 0xd99129b4, 0x3013acd2, 0x080a7fe9, 0x28936bbb, 0x4f192d9d,
  0xe8cfcc6c, 0xccff93e4, 0x2fcf21c2, 0xe4ddd552, 0x0021b3c4, 0x08ded53e, 0x40e36bff, 0xfce8b133, 0x762930ed,
  0xe52bc0ae, 0x3fb2bab6, 0x37a14d37, 0x38150f95, 0x7bc5f7d3, 0xe52a1b80, 0xa55313a9, 0xe85831c7, 0x40d65103,
  0x34aa38e1, 0x1b6f1e1b, 0x2c2314fc, 0xa76061d3, 0x27778fec, 0x545f4ce9, 0xcacacb8a, 0x63c57012, 0xc653e17d,
  0xa9a8a4ab, 0xf07f87ff, 0x75edb8fa, 0x85dee805, 0x14d939e5, 0x5e15bddc, 0xd78a8c94, 0x5ebcc564, 0x396b2e3f,
  0xdc13e3c5, 0x88f04d86, 0xc445bbf0, 0xdeefdbe9, 0xef0f6f54, 0xba1879a7, 0xa17b427a, 0x3f4d63ed, 0xdad44486,
  0x9f4de403, 0x70908b98, 0x6c2f386f, 0x59463838, 0x565c6702, 0x64d18e6c, 0xeabbcea4, 0x645e8766, 0xd5be8b76,
  0xdcf26d90, 0x2de2b4d1, 0x1ec30f07, 0xa3a3aa97, 0xf8cda80b, 0xd32432c5, 0x120d8256, 0xa2f63a13, 0xe0327857,
  0x0c0f7d5a, 0xacd7c6ba, 0x301115c6, 0x5a1ee107, 0x842429a7, 0x0dc560a7, 0xc9314991, 0x82dbb51a, 0x88c0ad91,
  0x30e2df62, 0xa0d548e8, 0xa3b998f4, 0x1792a363, 0xb0bd2593, 0xd8c0de6e, 0x57c0090d, 0xe716e913, 0x98469985,
  0xb8bd550d, 0x735db438, 0xf0246fdf, 0x9e495bc1, 0x8524650e, 0x45b642af, 0x284c18cd, 0xdb9c79d0, 0xa68b3462,
  0xb7abe875, 0x477587ba, 0xe005cf1e, 0x779d26a8, 0x29fb6fc9, 0x307caaf9, 0x1c5fb979, 0x9f318787, 0x6aae12b6,
  0x044d7c76, 0x34fe6f19, 0x2097a557, 0xc32eb1b1, 0xb60788fe, 0xc8d7df54, 0x202f0ca0, 0x6e0d814f, 0xdb578110,
  0xf724b37e, 0xcabaf77d, 0x209d6fd0, 0x98c99c49, 0x513d73bb, 0xc9a9892c, 0x4fb18b88, 0xee957ace, 0xc76165b0,
  0x92e09286, 0xe754dc2f, 0x06889a98, 0x8941d770, 0xcee6e73e, 0x705f9d28, 0x6dbd7c53, 0xb32e48c2, 0x59179adf,
  0x78950cd2, 0x4d2be084, 0xfd9167d6, 0xab9142ec, 0x09806242, 0x18a9b637, 0x7a89d1ad, 0x132931e0, 0x59a15119,
  0xedcc4113, 0x26598ca7, 0x7ad1327d, 0xbcae9ad0, 0x9efbb6d4, 0x2447d575, 0x5a61a0c0, 0xc40be0a7, 0xefd6cbc7,
  0x5ce134f8, 0x5cbc7fa4, 0xe287dc50, 0xc596ce65, 0xedbd866b, 0x9ebe5c1a, 0x9d1c2a2d, 0xa607970b, 0x5af62f85,
  0xafb022f9, 0x19a3d9bf, 0x13f6d276, 0x4779e218, 0xf320c6e1, 0x773ce442, 0xf49eaa98, 0x1e7c5375, 0x5ac83780,
  0xce62f5fa, 0x1a4b49d1, 0x79c3b6c5, 0x88a2209a, 0x8264a7bf, 0x0c30594f, 0xd9122316, 0x5252fc23, 0x7d4955c6,
  0xc74441ca, 0xcd6384d3, 0xbcac5629, 0xf9d10f9c, 0xe51f18e3, 0x570ae90e, 0x69b09278, 0x9c310124, 0xb484f943,
  0x7cda6df6, 0x4607862d, 0x4cf4d1bb, 0x55d3e883, 0x04ed7cad, 0x93c01965, 0xe45ee1d1, 0xc56cae7a, 0x782022dc,
  0x6a93a0cd, 0x24e25ef4, 0xa487ae94, 0x7e0a6bea, 0x7e950b05, 0x7c68cd7b, 0x4f951d03, 0xbe28b11f, 0x94f4b353,
  0x354c0384, 0x75508111, 0x146fbcae, 0x1f66d663, 0x06778749, 0xfcf3bc01, 0xdccd279e, 0x1baff50d, 0x305a3c2e,
  0x7e18d266, 0xfbb8a50d, 0x94d6b265, 0xaac3910c, 0x9845c811, 0x72f089d4, 0x09188638, 0x963ee2d7, 0x4673e9b8,
  0xdc08faa6, 0x898b7549, 0x2b209042, 0x3473b520, 0xe39b274a, 0x6e71d024, 0xf4eaa0d7, 0x7072b830, 0x81915bb9,
  0x2803ad77, 0xc29ab2fb, 0x3a6c0339, 0x938fe6b2, 0x73b758a9, 0x5e8eea35, 0x24a09d36, 0x4445cc2d, 0x5d524dab,
  0xd5633ecb, 0x9d5dd515, 0xbcce842a, 0x9f5eb0ea, 0xcac25878, 0x9a6a79c7, 0xe2aa547e, 0x481e5eb7, 0xd12126d0,
  0xe77fb14b, 0x6ba50924, 0x636edfab, 0x9db9ac6b, 0xb785c55f, 0x65efd0b6, 0x4578861e, 0xe85f7169, 0x5240f690,
  0x35d9d371, 0xa3fbd79f, 0x752f4016, 0x4641a077, 0x0482c84a, 0x5606b066, 0xabc2e2e0, 0x07331f3e, 0xd946e5b2,
  0xf1e783a0, 0x82870083, 0x5bca3a58, 0x7d49cda7, 0x78fb5e0d, 0x2ada013b, 0x85b34d0b, 0x4e4ecb7b, 0x03c32dec,
  0xbb677006, 0xa6080a82, 0x7758a5de, 0x90423eab, 0xc26e61b9, 0x300f005e, 0x7b42ccbe, 0x7ac13976, 0xbff9a354,
  0x8f585f3f, 0xeb2680b7, 0x2da6a3bd, 0x426931fe, 0xcfb0164e, 0xf38dc961, 0x2921dff7, 0x9ff684eb, 0x475b9d6c,
  0x6bffcf60, 0x91d543db, 0x338e9257, 0x120526d3, 0x410c093e, 0x33f89f12, 0x58c97785, 0x466155a1, 0x62e3e809,
  0x5b91038e, 0x67a47b67, 0x634f2486, 0x87b208ea, 0x35d5b5c9, 0x0fb7479c, 0x42866a8c, 0xc931102d, 0xc50c93cd,
  0x4030478d, 0xc0915ff6, 0x92ac187e, 0x3181d360, 0xb0bfd9bf, 0x076b7ade, 0x6d62ac42, 0x44b33e7e, 0xbf2fb886,
  0x28a932bf, 0xc7a686b9, 0x2a4d5732, 0x10f67f95, 0xdbb2e06d, 0x9d2e0ca4, 0xacfdc321, 0x38874be2, 0x92d921e2,
  0xc5a91d1e, 0x6f33ce9f, 0xf420ac04, 0xc2f846aa, 0xc40b2171, 0xdf11df25, 0xb7cc32f5, 0x8ddf54ac, 0x0f3b592a,
  0xef12c588, 0x7f2a7882, 0x3d243601, 0x974b2312, 0x46f496e1, 0xeac84cdb, 0x4be90830, 0x5058cef7, 0xa5b35fa0,
  0x05053ee8, 0xb5a6c419, 0x9e762989, 0xa9777e68, 0xc180622a, 0xac381369, 0xe1dc7d44, 0xddaa19d9, 0xd3773f4d,
  0x54be9722, 0x073f87ce, 0xf9665690, 0x93089faa, 0xd5a7106e, 0x2956c0e7, 0x4af18c97, 0x405f5d8c, 0xb86e94fb,
  0x075cc446, 0x0be6780a, 0x173a7d07, 0xde767198, 0x59d89751, 0xda547ad7, 0x5756668f, 0x6067750e, 0xc71d86de,
  0x71395ed8, 0x68db40b7, 0x93533979, 0x5880fc1f, 0xa2b74c4a, 0x915f1a78, 0x6d0929fd, 0x61cc0d7a, 0x9b9a8936,
  0xb4db9048, 0x2ff09f93, 0x9ec13db9, 0xbd2436d9, 0x6c6f8335, 0xf2298362, 0x93b6877d, 0xa4092958, 0x1f0a640b,
  0xac8ffddc, 0xbf1176af, 0xe465cbf9, 0x3cdb7582, 0xd566dff8, 0x276c9c69, 0x8c3e7dca, 0xe498611b, 0x9a6ffedd,
  0xce0d8a60, 0xf8e402a5, 0xa10ae020, 0xbe7cdc3c, 0x655d8bc7, 0xc43bc4db, 0x644dd36d, 0x2a9b6615, 0x34bed78b,
  0x72e2e5a4, 0x3ff2f2d5, 0x24ab6829, 0x66864877, 0x875523c7, 0x7975a088, 0xce9f8f94, 0x165544ae, 0x387c2302,
  0x69938623, 0xea2d59d2, 0xb0ec33bd, 0xafacc829, 0x601c5d49, 0xc82b5b4b, 0x934b0a22, 0x3da214c1, 0x563078a0,
  0x8027b85d, 0xcecf110b, 0x7529e111, 0xce589169, 0x2dbb8b7c, 0x096e48b4, 0xb0809651, 0x768383c8, 0xa3513594,
  0x0cc289d6, 0xf256326b, 0xd225e171, 0xa2a2011a, 0x3be7678a, 0x7e1529c4, 0x41b9f3b0, 0xfdffa2f1, 0x0b90b061,
  0xe108a87c, 0x84b2c8f5, 0xf611270b, 0xf115cccf, 0xfa4badbf, 0xc79f12a3, 0xbac78087, 0x7c674fb8, 0x79de75eb,
  0xe1749951, 0x27a1f914, 0x427f8efe, 0x4e3f977b, 0x48b2242c, 0xaec88a01, 0xe9a3d7ac, 0x4a7e3aa5, 0x9c4c59ec,
  0x43dc5fc5, 0x7e5e1e06, 0x6db0727f, 0x24d7b745, 0x62598074, 0xae11d85c, 0x33062531, 0xcf7c8998, 0x9bef1985,
  0x307ce969, 0x6fb02bf9, 0xfaffc7f7, 0xc360acc4, 0x75fa9d96, 0x58b2b916, 0xa9e8947b, 0x40e0b402, 0x1ce82637,
  0xf7d4731c, 0xa0b2516f, 0x7ae4c973, 0x473b62c7, 0x2053f5d5, 0xc1f20956, 0xe034a7b9, 0xcfb2fb72, 0xf5a871be,
  0xffa0eb9a, 0x086c5d1e, 0x914b77b3, 0x96215aed, 0x49426987, 0x132fa877, 0xa343efff, 0x1f3d1387, 0x6cd1b38c,
  0x122e4ea9, 0x732e6737, 0xdf496eea, 0x5cad4401, 0x8ff4f11d, 0xc18d4316, 0x73a880c6, 0xea2ab955, 0x8bc06e75,
  0xdcd17422, 0xa2bacb3c, 0x75a3153b, 0xa19f5242, 0xeaa68000, 0xc202f65e, 0x1e86b769, 0x5a86043e, 0x7395b387,
  0x322a6a80, 0xe6f92e00, 0x5a55d543, 0xc6d69fa6, 0x514427e9, 0x61284e33, 0x7d961010, 0x7e3e3975, 0x7d1492eb,
  0x11acf897, 0xceb1d264, 0xbb478159, 0x58a31667, 0x99602ce4, 0x7c3ee27b, 0x63a50646, 0xbf674909, 0xe39da91e,
  0xe689eaf5, 0xbb1557b7, 0x577eb47f, 0x75d2146c, 0x9f1e960a, 0x330c19be, 0x67d03c7e, 0xe9e3d4f6, 0x45c9fb8a,
  0x3210089b, 0x15e6ef5c, 0x61bc47e1, 0x31a89152, 0x21b56ee8, 0xb77fa489, 0x629c4594, 0x483113e9, 0x553825f7,
  0x7fee6f86, 0x8f831949, 0xb3394184, 0x31d5f223, 0xc33fae7a, 0xc37b156d, 0x3eec1b8a, 0x09fe2cf0, 0x2821f90d,
  0x35245481, 0xcb7c4f44, 0x7201a253, 0x41586b49, 0x16e09737, 0xe8ebd6b8, 0xbcf2d08e, 0x7c8a0e6e, 0x03cb3543,
  0x860627a8, 0xa47be5b7, 0x52d2d1b2, 0x75282750, 0xad042c09, 0x8d3d6b4b, 0xdff6a607, 0x8b2764ba, 0x9546aab8,
  0xaa503c8e, 0xd1c93766, 0xdb974c51, 0xc4640b40, 0x7d80b711, 0xb4a3e2f8, 0xf1f5d46b, 0x60b616bc, 0x70440da3,
  0x104e0c62, 0x83aa20fb, 0xa40cfcec, 0xe418f964, 0xdc81a6b0, 0x03dbe2c3, 0xd39e4449, 0xd10f704a, 0x16940f84,
  0xade94b85, 0xad7037e6, 0x528d4615, 0xe61da724, 0x482c9bfd, 0x12c62b6a, 0xd7dc3d63, 0x25d9089e, 0x532b2b00,
  0x655e463a, 0xe7839530, 0xaf6de6b3, 0x28ddf466, 0xeeaa2eae, 0x7710c8b8, 0x1a7ce721, 0xc56fa4ed, 0x98521876,
  0x85c3f495, 0x88d1db21, 0x14a2a10a, 0xda9636e4, 0xc93051d2, 0x659029b6, 0x7713612a, 0x8b2205a5, 0x7024e473,
  0x18b875fb, 0xe105ecbd, 0xfcf7c33b, 0x15d5d381, 0xead2503b, 0x649bc841, 0xee3c7133, 0xb259dd0a, 0xc683f2e4,
  0xc7668b97, 0xb7a6fa57, 0xdb4fd57e, 0xe4dd564d, 0x139ecffb, 0xfa751c96, 0x0dd4ea50, 0x175e0799, 0x81b9b4e3,
  0x3060c428, 0x42bc193a, 0xbc5d6adf, 0x47ce4533, 0xada09a17, 0xe59f404f, 0xdd2c113d, 0xf2daf3e7, 0xd0ee33ed,
  0x5555f5f0, 0x867691b3, 0xd17a3469, 0xe7f882ec, 0xf0f76cd4, 0x1358ffc8, 0x0de5f74c, 0xb15a2c62, 0x91042020,
  0x57c85fcc, 0x79c68b7e, 0x8d47f52c, 0x46b15909, 0xc06a81ac, 0x72f1fec5, 0x06c7d52f, 0x5be7ab88, 0x160ae140,
  0x08e1a7ea, 0x3529518e, 0x5bc7944b, 0x6d331af0, 0x2ed93b39, 0x89aabf05, 0x2e21dfb8, 0xc5864d3d, 0xf09d79e1,
  0x0d0fc094, 0x8adc607a, 0xcd5ade89, 0x202e20d5, 0x6e4524f7, 0xbc7968f1, 0x9dae56b6, 0x64767de2, 0xd866eda8,
  0xe445b4bf, 0xe8fa5258, 0xd85fb248, 0x64c7278e, 0xc8bc9a25, 0xfc758a48, 0xf3dc3102, 0x37b30c58, 0x1d081a98,
  0x242bbfef, 0x0b201dad, 0x5a4952f8, 0xd11238b9, 0xbb4c8fdc, 0x77ddb381, 0x73692cc6, 0x52abe5f5, 0x2cc33468,
  0x38160434, 0x4652e252, 0xeb190160, 0x57c19a97, 0x29645bdd, 0x4d158cfe, 0xb3217d14, 0xddbda2aa, 0x72b218d8,
  0x1c12c587, 0xd1bb1f62, 0x52108c83, 0x570d3bc1, 0xaeb193c5, 0x5aaaedb9, 0xed1d8c5a, 0xa7d26383, 0xcf59d0ac,
  0x46c4f418, 0x5934c37a, 0x69645c3d, 0x2a8ccc31, 0x5fab5616, 0x3d05f49f, 0x617a64f6, 0xebd4162b, 0xb9813c5f,
  0x7e9dedda, 0xa0cca1b6, 0xa36272b2, 0xd72a82c6, 0xeac87e0b, 0xaec2dc1a, 0x3d7ba30f, 0x72b02a09, 0x776461e2,
  0x90f33498, 0x759dd3eb, 0x01f33010, 0x1df21ee5, 0x9954006d, 0xa43fa329, 0x02162e82, 0x0029c4db, 0x5b5e25ea,
  0x2262f000, 0x2632e1f8, 0x138784f0, 0xe67bb191, 0xe9df5e8b, 0xa01b1e35, 0xc2bf63d7, 0x9f3c46b2, 0xf2d9e17f,
  0x795630f5, 0x65557ecf, 0x48545392, 0x3bee5956, 0x41dd6e59, 0x98bfde2a, 0x295eaddc, 0xf2d90ed6, 0x1fca4e1b,
  0x94db93f3, 0x981fdb46, 0x8364bea0, 0xa0fb6324, 0x779beb69, 0xadb7a952, 0x4d883167, 0x1a486341, 0xb1b3ffc1,
  0x704affce, 0x3ce6d5bc, 0xfbb85185, 0xd1b62215, 0x02612ba3, 0x109a6524, 0x25332dcd, 0xdce08570, 0x4f9314a5,
  0x1ddb9d30, 0xe2a3405c, 0x103023eb, 0x4fcca085, 0x68cf44d7, 0x9536dfa2, 0xa4ee2857, 0xe0c034d2, 0x7ddd0ea7,
  0x3dbab104, 0x8667c9a7, 0x872b6354, 0xbdf1f3d7, 0xbef3a09d, 0x902a7161, 0x3a3f4eec, 0x5b5e3e0d, 0xf02f938a,
  0xf9f116d0, 0x8e54c28d, 0x6247cf7b, 0x53a4a408, 0xa8f2deaf, 0xdf6bf796, 0xc28d62b4, 0x093b7e48, 0xffc2ef2f,
  0xdcbfacd5, 0xc615c801, 0x59bc76db, 0x2c33e7e1, 0xe75c4f2f, 0xcbb6faf4, 0xf9107f07, 0xbd73ce10, 0x1b2e8677,
  0x3306d038, 0x4c6da0d5, 0xd2c65d1b, 0xfc9f6c68, 0x6ff7b50e, 0x6dcb85e4, 0x9c87084b, 0x756777dd, 0xc48fdc54,
  0xc7e45e5f, 0x7e66a18b, 0xa4728a88, 0x0dc727fb, 0x5f5612a0, 0x2de9af00, 0x4df59fc3, 0x7c29371c, 0x750becae,
  0x27f1d753, 0x421665ab, 0x79784c53, 0x07ce7021, 0x96dabcf5, 0xc129a42a, 0x10203368, 0x40f05d35, 0x63b7d951,
  0xa804dbbe, 0x623839bd, 0x4234e8e8, 0x926bf94f, 0x76bdd046, 0xb7a20503, 0x55385298, 0x2017bc24, 0xdaee4943,
  0xad2ba6c2, 0x2badad67, 0x68f9dee3, 0xea892a8b, 0x7be5e717, 0x02d22ca1, 0xbd3219f2, 0x7f28c874, 0x78922a71,
  0xf86e5464, 0x98c4859a, 0xba524263, 0x7a889771, 0x93ca43a9, 0x8d400e2a, 0xeae107f7, 0xd8b3942e, 0x024a5aeb,
  0x0bdceb94, 0x33723910, 0x7d571876, 0x2a4568e5, 0x937a2290, 0x22fbcf9e, 0x42286a8e, 0x45185665, 0x0981baa9,
  0xcd2e9148, 0xa0857c11, 0x5e976090, 0xa73ebfc5, 0xdc17a14e, 0xe98753c0, 0x3c366b5f, 0x3e49fe8b, 0xd0d69254,
  0xb29eb4b0, 0xe94b0ef6, 0x6b3cbfa7, 0x36489e71, 0x6d24d18a, 0xe3991574, 0x187a0333, 0xe5c30a7f, 0x68a8f975,
  0x74234135, 0x9e1928eb, 0xe0fa7254, 0x1cbc1df5, 0xf28edb74, 0x56f06c05, 0x54649c63, 0x0be197dc, 0xba8b903c,
  0x48daa849, 0xdeb5ed24, 0x5f1d961e, 0x71b4095b, 0x1c67ad91, 0x0e8ed73d, 0x38a04140, 0xf7544b01, 0xbcfeed6d,
  0x3c7911f5, 0x2eb3e083, 0x314ca91b, 0xecc45996, 0x8ff10fe2, 0xe1020a55, 0x0a1abeb1, 0x93229a15, 0xe8d90f8f,
  0x933bf99c, 0xaeec16c8, 0x80ad5201, 0xc98292fc, 0x1fbf2197, 0xf51f7022, 0x0bb6cb94, 0x189aaa10, 0x6ebcc7e9,
  0x40b5811c, 0xf3f40217, 0x1b5de069, 0x081950ed, 0x996138db, 0x899aaab8, 0x43cb1d59, 0x910c2df0, 0xf77f1e25,
  0x843ebe4e, 0x5654fff6, 0x519c0c72, 0xec9e139a, 0xdec1a979, 0xabe9f9a1, 0xbdeed01e, 0xf9315649, 0x74a7754b,
  0x9e797da8, 0xb4ae9731, 0x9a00685a, 0xec2d018a, 0xc1683905, 0x29959cf3, 0x4f3790ac, 0xda439036, 0x642daf19,
  0xdbf2cbac, 0x7922d957, 0xacca86b6, 0xff587785, 0xf20e42c4, 0x1ff02031, 0x83188671, 0x7696bd0f, 0x11573535,
  0x024f562e, 0xe19c2e93, 0xd6e4488e, 0x16127126, 0x859ce452, 0x37aca19f, 0x285186b2, 0xafbfa4fd, 0x8159036f,
  0xe9461ec6, 0xd44357c3, 0x232434ca, 0xc2b9d28c, 0x097abb94, 0xfa518392, 0xf7189b79, 0x7f49eadc, 0x75bf8dc1,
  0xc4f7cd83, 0xca0ec3df, 0x7c761322, 0xd95953de, 0x768c7b70, 0x975d52a8, 0x76e4b916, 0xbfce10e5, 0x4a955a68,
  0x1a99a197, 0xd4c624cd, 0x7a89cd2a, 0xb9b87aa3, 0x773b2c25, 0x1d0f505a, 0x14b65280, 0xc7e81ee0, 0x00fe3935,
  0x55b8b408, 0xa39adc75, 0x4ecc62dc, 0x1aecb4b8, 0x2c3f645a, 0x32fc0d4b, 0x0a23dfff, 0x4d6ccb61, 0x5cce1d49,
  0x5df7c522, 0x5841c635, 0x488df894, 0x02556441, 0x7f9da929, 0x18a0c47c, 0x4aa24a9c, 0x58826a84, 0x31e93148,
  0x4b7896ba, 0xa4ac9c15, 0x72ff2d26, 0xf05aac11, 0xe5ff7941, 0x0cea825b, 0x3f56961d, 0xe83626a4, 0x1c0775ee,
  0x335a603c, 0x3b485850, 0xfe2af5a4, 0x016a2a4f, 0x4c2f449b, 0x35659b20, 0xfecd99e6, 0x9921efe6, 0x426f55d1,
  0xfad7add5, 0x4ad4e89e, 0x0299cae7, 0xf5db8ec0, 0xb42cb1c1, 0xb57a571c, 0x29950f39, 0x78e5f33a, 0x48607119,
  0x5b3af64d, 0xd93eaeb9, 0x94fa8903, 0x3de6e3f5, 0xe7175349, 0x5f3d122f, 0x94578f85, 0x922b1f50, 0x67f7bc63,
  0xfec50efd, 0x19021518, 0x3f00691a, 0xbbadfc4a, 0x48b681de, 0x6c651bbb, 0xe1d79dcb, 0xeeccd97c, 0xbea9c179,
  0x383d7220, 0xd4235ba3, 0xaebfeea7, 0xe2336f45, 0x01061fd6, 0x20bbae73, 0xb57524b8, 0x7851250d, 0x102a09f7,
  0xe73bdc02, 0x687decc7, 0x7ee3436d, 0xc8295988, 0x3eae61e1, 0xcad26c35, 0x342e2145, 0x069772ba, 0x566f12e7,
  0xa5da8a4d, 0xa7d73417, 0xe90b4215, 0xab1688ed, 0xeffe5609, 0x0ab96a60, 0x72ea52c3, 0x99f8762a, 0xb13aaa17,
  0x5dd08726, 0xf57a2b8d, 0x4e86f6b0, 0xb392ab75, 0x171c4abc, 0x5905dfda, 0xe4b6e773, 0xb6ff5341, 0xe94c7c60,
  0x50c303b9, 0xd967f431, 0xf6cbf239, 0xd3abdacd, 0xf09f4266, 0xa89e2e2e, 0xa8a4d26d, 0x6119e4f2, 0xbc654859,
  0x1dfdcf6a, 0xb4cd8dfb, 0x5576581f, 0xdea20f7e, 0xf9e046a7, 0x79a008d1, 0x06a09697, 0x3364d095, 0x400ae153,
  0x31de0d67, 0x329996b8, 0xfaf50d51, 0xcde0f9c0, 0x0815f642, 0x553a96f5, 0xed190f53, 0x1e6e091b, 0xe32d1f8f,
  0x17a6acce, 0x2755f0c0, 0xf8cd3e08, 0xc326014b, 0x68730718, 0x5c437ff5, 0x97fb74f4, 0x2f8f4d6b, 0xbdf2e85d,
  0x635024d7, 0x61fd99fc, 0xc63e2627, 0xa1e56fc5, 0x697473c5, 0x16f1ac2e, 0xad03ab01, 0xd2e58e97, 0x6e37e8c4,
  0x9635dc9f, 0x325e73a9, 0x8efa2dcc, 0x7772eeb6, 0x7e7b75d7, 0x40349f01, 0xfd71a743, 0x596d82ed, 0x085c2784,
  0x030ad670, 0xd9e326d6, 0x8a550826, 0xd10a5bc6, 0x01b2c723, 0xd96b0b8a, 0xff61c487, 0xbf2e69f6, 0x73767127,
  0x742cc584, 0x9a0b1779, 0x7f1db1af, 0x5caff681, 0xbd703652, 0xcca3e3b7, 0xf2e20277, 0xcab4bdc0, 0x31206910,
  0x7af35ae6, 0x9e52f7d5, 0x801af7a6, 0xdeb4bca2, 0x4790b061, 0x4eb7facb, 0xf4152440, 0xbe0a8cf8, 0x2aae2dc5,
  0x7fcbe9fb, 0x9a750500, 0x415c7ba3, 0xa9619d0e, 0xb7a6d24a, 0x3621da5c, 0x9f259f5f, 0x1c9d9490, 0x169649c5,
  0x4eb5d2d0, 0xbcfb9a7e, 0xf1b861f4, 0x64775b11, 0x87fa3f20, 0xf2024862, 0x900534f7, 0x3340c886, 0xd826356f,
  0x06ddd723, 0x9ce25765, 0xfe2a7a22, 0xe20dd108, 0x359550a2, 0xc4d8878f, 0xc2550828, 0xfe2741de, 0xca13f46e,
  0x16d7686b, 0xbe6608f4, 0x8a1d7914, 0x12697748, 0xe32cc0fb, 0x9603859a, 0x9187d3dc, 0x834ccf47, 0xe0da2e96,
  0x12113d1e, 0x59e08e4a, 0x6d095915, 0x64c5bca2, 0x2f2d7f03, 0xc3ae7469, 0xce92886b, 0xc33903f8, 0x3de7b0b9,
  0xee4a3eec, 0xa8a567af, 0x83feb4e2, 0x1109d45b, 0x84c873df, 0x011a9a2e, 0xe97fb2e1, 0x3f532d8a, 0x06dae858,
  0xb20ebcd9, 0xf7bb7d8a, 0x33ddfdb5, 0x6f1cbcaa, 0x0871f571, 0x534566fb, 0xcdfc5d89, 0x6d9dedfc, 0xd062861b,
  0x369b30ab, 0xf692fbea, 0x53a5970e, 0x2aa93296, 0xeea12f29, 0x191c3560, 0x4f47003d, 0xafda3205, 0x39b12dec,
  0x8922cf81, 0xd9bd3606, 0x4f972749, 0x00a64036, 0xd39ce3da, 0x648ea437, 0x5b6443ca, 0xc8c4f7f4, 0xa51ead98,
  0xbb956c26, 0xa0410099, 0x754973df, 0x7cc3eada, 0x53adf31b, 0xc9d35836, 0x1989cb5a, 0x9fda85b6, 0x911214b8,
  0x50699af7, 0x45777b29, 0x3a83b450, 0xba19384d, 0xcfda2741, 0xfe746371, 0x177af1c2, 0x9978c4fa, 0x5a18870a,
  0x44123b37, 0x1478fa45, 0x6a938f37, 0x3088db36, 0xa8b8a47c, 0x7dfb5b5e, 0x5e5a6e93, 0x451c7f63, 0x3c445000,
  0x793e4d0d, 0x20038fac, 0x48f95cd3, 0x5bf58f86, 0x92e357ea, 0x6e82197b, 0x11645cfe, 0xaef3f09c, 0x629bf65c,
  0x88ce5381, 0xfbf86667, 0x4c4dc1ff, 0x5b33f377, 0x1075089d, 0xd8431c39, 0x33e55b7b, 0x6ebc00de, 0xd59d5a77,
  0x6f162a56, 0x9fb65b50, 0xb7003297, 0xe0890423, 0xf9dbbabb, 0x75e28476, 0x6b939b07, 0xe1af1b0b, 0xbeab42f3,
  0xfbe9fb2d, 0xce9c5eab, 0xbf666dc3, 0x6387abe9, 0x4e2376ee, 0xf2ef0859, 0x9ed68b63, 0xb07474ae, 0xb2df6294,
  0x2871c78c, 0xcfe8cbd6, 0xa4bffcbc, 0xde09a83b, 0x32a51d58, 0xa5eee5a5, 0xcf509778, 0x6b1094b0, 0x18465339,
  0x44edaa52, 0x0643f013, 0xb05d8355, 0xe4fed69d, 0x3e8c9c5f, 0xf60d950a, 0xfa1d878d, 0x74f6d58f, 0x2afc4b1b,
  0xbe82db5e, 0xb66d12c0, 0x6ef46bbb, 0x4a5625f7, 0xdce3c32f, 0x3fbc557f, 0x77d5a774, 0x719151dc, 0x54d036e7,
  0xc3acfd8f, 0x9c7dedb6, 0x5e8fd70f, 0x3332f18a, 0xa9cf2278, 0xe7f263dd, 0xfc834e1b, 0x630f3261, 0x622cc2c4,
  0x11c6cae0, 0x31d47709, 0x82f169a5, 0xf2129ff3, 0x2752087f, 0x2608cc4b, 0x4904ddcb, 0x847b8525, 0x9057ebaa,
  0x22fb261c, 0x3bab6188, 0x22a82eaf, 0xeede6092, 0x4a52497e, 0x1e354349, 0x21462bb6, 0x480c9898, 0xb02ebff8,
  0xfa86f088, 0x91bc8845, 0x5ac55dab, 0x17aef435, 0x9bd109be, 0x1575f32b, 0x4a68ae63, 0x91b65d89, 0xe51c2200,
  0x2610658b, 0xf3e82d4e, 0x159cd2d5, 0x20c17b48, 0xeac9a432, 0x8a4da86e, 0x1b9f1109, 0xca915c2c, 0xa0444e2d,
  0x76b2f86e, 0xc9d1a1bd, 0xb717f533, 0x8fd6c52e, 0x84927ad7, 0x467001f9, 0x1e304174, 0x78f7b9af, 0x5a144e86,
  0xcfbc8fe5, 0x59eeeab9, 0x2739ff58, 0x2066e902, 0x2db3b114, 0x2ee21411, 0x3db08999, 0x10c4e0c5, 0x6e5935ab,
  0x015aab35, 0xa65b525e, 0xa62637d7, 0x147655ce, 0xbfe3ecc0, 0xb6c13a1f, 0xaed324e1, 0x9bf4db31, 0x117cf17e,
  0x3e176f30, 0x7789f82f, 0xe05ff104, 0x35149389, 0x9a3b1fc2, 0xbc153f97, 0x6a91df76, 0x3f6f4622, 0xe3a9d7b7,
  0x566697ea, 0x7dec7741, 0xd362f203, 0x495597b6, 0xa6921f33, 0x7aca1ab3, 0x1eab2a20, 0x9317498b, 0x7da728e8,
  0x8a6bb593, 0xb697fa09, 0xbc9d143b, 0x079b7ac2, 0x4093138b, 0xdbefefec, 0xdfe01065, 0xabde726d, 0xe55fd08b,
  0x018c7c27, 0x557e9a50, 0xb0ca0333, 0x2a9abf2b, 0xed6dde3e, 0xf1b489e4, 0x2c0f3d3d, 0xd396d107, 0xb72c5fcf,
  0xa5afe27a, 0x6cabe6ef, 0x198543ee, 0xe18e3f96, 0xcb033266, 0x4a0e1839, 0xa349b55a, 0x720e9284, 0x2233bf62,
  0x513ea118, 0xf568dac4, 0x35867903, 0x0059715c, 0xa70a2083, 0x7621b6df, 0x65e5bc3c, 0xe246c26c, 0xcf8b7e21,
  0x8640b978, 0xdcf9a621, 0xd0cf6e06, 0x7dcfcd07, 0x67375781, 0x71c15b1b, 0x462d73f2, 0x0db27008, 0x890f7b66,
  0xbfa6ac0f, 0x3ac83810, 0x11fd3e77, 0xf457e38d, 0xb554110b, 0x79f8eca3, 0xd30f179f, 0x9aeba295, 0xac2e2380,
  0x2b58a034, 0x74c962fa, 0x7b2b2bf8, 0xbda1d600, 0xb71bc6d1, 0xddd99325, 0xf12df6ab, 0xa1dbcca2, 0xe1e5ebca,
  0x8a8d57cf, 0x202a5ba0, 0x04877195, 0x77cc6b43, 0xa75ee246, 0x8b2ac25a, 0xc855b4de, 0xd68a743a, 0x1b257820,
  0x221b6824, 0x8e44cc43, 0xaf30ef18, 0xccc79f6e, 0xfc945924, 0xa89c9e97, 0xecef4a6c, 0x42a617ab, 0x94e15f2b,
  0x16b18446, 0x520764ac, 0x683110d7, 0x8140706c, 0xc6dd571b, 0x857b85bd, 0x41f38c4b, 0xa97cbe8c, 0x8302a4aa,
  0xca817521, 0x9bd7dce7, 0x973d4ad5, 0xe4404e3e, 0x02d4a8ee, 0x61696b68, 0x262f396c, 0xbd75adca, 0xc718ded3,
  0xf93d2459, 0x259ccb88, 0xbf5a0bbb, 0x045d3984, 0x28d43746, 0x4d3d2202, 0x164218ce, 0xe4fc28a0, 0xac85b618,
  0x583f5b5f, 0xa5e689b7, 0xdbcdbc13, 0x1c68ba41, 0x0b8d5a47, 0xcb3087b8, 0xb9db1ec4, 0xabff9758, 0xc1f36eac,
  0x0e182a77, 0x9b6e1cf1, 0x612bdfb6, 0x69ff5130, 0x11a8f713, 0x8fab52a8, 0xdfa856c8, 0x6f9deeb2, 0x19974a33,
  0x16286d07, 0x428d9571, 0x3ea23562, 0x4945ce03, 0x9bb8bba4, 0x685668eb, 0x671c51c1, 0xd1f3492e, 0xd6472048,
  0x49916f49, 0xe20a390b, 0xd1f219db, 0xd8d8561d, 0x9863a87c, 0x63872c9d, 0xe8f10a4e, 0xb47953ec, 0x939b2110,
  0x0033057e, 0x10b27118, 0x9a603774, 0x8672d6fd, 0xbae861cb, 0xaf0245dc, 0x68d2394c, 0x6dd792cb, 0x3195019e,
  0x3dcba65f, 0x73916508, 0x878d833c, 0x007a5396, 0x4deabf2e, 0x43fe19fe, 0xa2a1baf1, 0x8c8b45bb, 0xa65facc8,
  0x94b32d1d, 0x0685a688, 0xb4a155fa, 0x8a333373, 0xd93361a3, 0x5c4afcd3, 0xeef22fbd, 0x400be4aa, 0x29517d94,
  0x603c25b6, 0x87c8c0f9, 0x35da3181, 0x4eacc36f, 0x6805a4d7, 0x7a7c7c54, 0x8c4afcd0, 0xa570ae1d, 0x7bad590d,
  0xcb74d0bd, 0x981884e4, 0x9c79485d, 0x82db57b3, 0x5a106f4e, 0x1439d4b8, 0x9adea59a, 0x98ba9366, 0x758d86ef,
  0x5e25b735, 0x64131759, 0x0e309dc9, 0x8cead08b, 0xbab025e6, 0x247bcd92, 0x2a247e35, 0x5c045f4d, 0x91a62c7e,
  0xece9a401, 0x880122e9, 0x8414b0ed, 0xe0821194, 0xe1c94ad8, 0x37d89444, 0x873cd6a5, 0x511a6b71, 0xd4ce6981,
  0xb1260a37, 0x52eba4b6, 0xa418b943, 0xb564b450, 0x1b19ec38, 0xf8b58ab1, 0x1145cc0f, 0xe2b945d1, 0x3ba02ae6,
  0xe93d2322, 0x0431fde4, 0x2bd1a299, 0x2f3cd3cd, 0xa4526941, 0x0f06a8c7, 0xd4a754d6, 0x633f32d2, 0x62ac53c6,
  0x358ba62e, 0xef84dc30, 0xbcf21943, 0x5995665a, 0x5adb1b13, 0x7833459e, 0xe0c3d4ef, 0xe97410a6, 0xfdb1b6e0,
  0x37468bd0, 0xb6ad0ad8, 0x8974d0dc, 0xfe78c4b6, 0x2f6f46bc, 0xc6c1e30d, 0xdf89c15e, 0xba644f6e, 0x0d3f6d8a,
  0x82416758, 0xb17e034d, 0xb28a1771, 0x3b407fce, 0x92cb9b11, 0xe8c23796, 0x8e37c6a8, 0x415b0938, 0xaab37be5,
  0x56eb427c, 0x491c22c8, 0xd000e01d, 0x604e9ac3, 0xd254de4b, 0x70988619, 0x70d06326, 0x9dc96b65, 0x5dce46d0,
  0x2ab08101, 0x6702d860, 0x483a0e41, 0x2421cc61, 0xbde82e22, 0x2ae3adef, 0x0a2b4997, 0x26acfc8c, 0xe3881dae,
  0x66a334ad, 0x12bcd49c, 0xa32b314c, 0x666a7fc9, 0x4e59638b, 0xe874a695, 0x3c7439c1, 0x5ce326ab, 0x0d1cf56a,
  0xa92efac4, 0xbbe8f59d, 0xb05bd63c, 0xb5a07687, 0xad6aae5b, 0x7faa18f5, 0x92edd0c6, 0x990187de, 0x66f3eb21,
  0x0b5b960a, 0x2a054efb, 0x605d393e, 0xcf051111, 0xc0bdc744, 0xcda81f43, 0xb190912a, 0xd09bbf5d, 0x496f36e6,
  0x749f4b3e, 0xf15f742e, 0x01ce304a, 0x02a23876, 0x7c28554a, 0x9f90ebf7, 0xcf288987, 0xb52b69ab, 0xab1a7265,
  0x95bc47d8, 0x22226906, 0x390324e2, 0xebee340e, 0x8c4ce277, 0x105c5c77, 0xaa3db02b, 0xf4ca56b5, 0x669e2c86,
  0xe29bb25f, 0x99468b37, 0xfb43aca6, 0x8968be57, 0x8132c444, 0x1721e5b6, 0xcb8f312a, 0xccc8a8d3, 0x5b202acd,
  0xc834c4e0, 0x17e33717, 0x0f11ef19, 0x74d58437, 0x77654368, 0x9ecb94af, 0x8c436533, 0x91cf03f0, 0xfdb6be70,
  0xa1d52070, 0xd219140b, 0xcc279d13, 0x447ede6e, 0xbad2aeac, 0xf4b781d5, 0x33b0eec5, 0x0fe0e606, 0xe0b452ff,
  0x792c698c, 0x33e596c4, 0xa4687dfb, 0x1c57ba5e, 0xa9861ab2, 0x55833c14, 0x90ec764f, 0xde36b0a1, 0xcb02e244,
  0x1d55cab8, 0x08f3bdca, 0x38c3bf11, 0xb4083347, 0xebbf35f6, 0xe94a64b8, 0xd363bce5, 0xdd5d9910, 0x54315bdc,
  0x6c01a50f, 0x90e6b1bd, 0x32ca8259, 0x7b61e975, 0x9535fa92, 0xec4ecd08, 0x06e78ab1, 0xf9c5a39e, 0x732006c9,
  0x6ef260a4, 0xe2fc363c, 0x3b53f981, 0x98d405c6, 0x00b9df2b, 0x68d9a71f, 0x51df59d7, 0xa6d9fc0e, 0x844d98c1,
  0x2944e58f, 0xd0111af0, 0xdb6bb154, 0xa60b41af, 0x51acdea7, 0x5e6efbaa, 0x51132ce8, 0xcddac65c, 0xaa2fb5e7,
  0x973a9ed7, 0xa9843192, 0xe850d0be, 0xba02197a, 0x99fe8b19, 0x6dc6daca, 0xb6571198, 0xbe5acd00, 0xa6dc8288,
  0x2d281078, 0x37d82f22, 0xe921da16, 0x0932ab58, 0x0493145e, 0xcd044470, 0x371aff96, 0x9893f211, 0x54772e19,
  0xafd0e021, 0xb5a4626d, 0xae5e4b7f, 0x06ce1273, 0x88be6714, 0xed679d8c, 0x1f68f7c3, 0x6717f892, 0x9654fb11,
  0x0e3ca39a, 0x81870d17, 0x7344d84c, 0xb5ab3a7b, 0x85d1579d, 0xd09c3d92, 0xd202d2f7, 0xcb6dafd2, 0x49982cf1,
  0x56caca85, 0xad8ddb93, 0x163afbe2, 0xdaa22da1, 0x68fbb387, 0x6470310f, 0x007250e5, 0x351aff2c, 0xd7ce3e15,
  0x0b46cf1f, 0x086991cf, 0xdf15c2cd, 0xe09efed3, 0x0adfea1a, 0x357a3e29, 0x275753e8, 0x06d74147, 0x116a0840,
  0xffbdd11a, 0x752e43a8, 0xd6424cbd, 0x929adb6e, 0x30ffb50d, 0x04c8d0c2, 0x74d199dd, 0x845cae93, 0x190ed1b7,
  0xb20973db, 0xafbfe8ff, 0x10f3f851, 0xe17f73eb, 0xdf7d9fc7, 0x30a09381, 0xc9b80fa2, 0xb586c590, 0xac1bd4c8,
  0xe1c7beb0, 0xb8e0868f, 0x7e76ce47, 0x3a7aefa7, 0xc6df9f9f, 0x4638bdf8, 0x14f8fd52, 0xe3cafa28, 0x882053ae,
  0xf5a3a7e4, 0x3d3ac6d7, 0xd813c4dc, 0xe9f5e778, 0xb51572d0, 0x074403de, 0xd070280c, 0x93f6d1e6, 0x6b7b24d6,
  0x3c8d5aa3, 0x2678f7fa, 0x19a1977f, 0xfbaf5f9d, 0xc7bfd8bf, 0xefc17993, 0xe89d84bf, 0xe0c49e76, 0xf2c6e360,
  0xf1dedbeb, 0x2c20208f, 0xc89ad20a, 0x3ea922c4, 0x1a04848c, 0x5fa8fde4, 0x4e7a12d8, 0x320de846, 0xe4401bd4,
  0x92248684, 0xcd1e5c38, 0x532d737f, 0xb0360a94, 0x16f5642b, 0x4569f979, 0x8cd14ab4, 0xcb26b1ee, 0xaa106efa,
  0xf5f20807, 0x05774229, 0xec01dc46, 0x262c746a, 0x837a0ce7, 0x5ab119e2, 0x353f1257, 0xe76487d6, 0x692727fc,
  0xe5abec75, 0x0e3dd316, 0x714e5534, 0x1c376c87, 0xbbbf1bcd, 0x30bf2f1b, 0x13094814, 0xd9d7e782, 0xdcc4a071,
  0xa47d9e13, 0x7b40fcad, 0x16dd308b, 0x0375c476, 0x613722c0, 0xbdb9b17c, 0x084f233d, 0x10d9c080, 0xf2b8ec7a,
  0x310a5ef9, 0xf7f1035d, 0xa248792f, 0xefad8733, 0x619f34b0, 0x1625c173, 0x01a1cbec, 0x30f0a663, 0x3fdded07,
  0xccc88b69, 0xb650b834, 0xa575d54b, 0x95fa94d4, 0x42bea0e0, 0x70f0fce3, 0x9d22a7c9, 0x738674ec, 0x7cc2839b,
  0x61fe482c, 0x0f2cf0fd, 0xc7583242, 0x862ae60e, 0xb8a33482, 0xb876cac3, 0x2f3a0d9c, 0x5fa9b289, 0x48cd92a1,
  0xb286a825, 0x4900cd47, 0xa1c4f55d, 0x2d51468e, 0x9141bb4a, 0x426f91d4, 0x7f48003b, 0x755b28ac, 0xfd7c60af,
  0xfeefe343, 0x5d667666, 0xa1b3f803, 0xef8bad2c, 0x01c479bd, 0x3729b58f, 0x909d6403, 0x98fd4e71, 0x6faf76c3,
  0xb358cdd0, 0x75a99752, 0xf5b5fc3c, 0xdce07272, 0xd823a157, 0xef248d4c, 0x0298cfed, 0x319daf0f, 0x23521fa5,
  0xbac4dd9e, 0xb1741929, 0x32de4bbe, 0x7a58fa04, 0x82f68c01, 0x79dd438d, 0xea3573fa, 0xd0926bfb, 0x369e6d54,
  0xf36144ac, 0x2614e69f, 0x6515ebf9, 0x54214238, 0x15b7048f, 0xcc7098ba, 0x6efee17a, 0xaf074b7c, 0xbd503a02,
  0x846fac8d, 0x20309906, 0xf0f788a0, 0xcfd826f8, 0x5d393da9, 0x5bf41881, 0x7fa8b988, 0x58782bd6, 0xeb31f4ce,
  0xd378e236, 0x3f0063f0, 0x9a414def, 0x5548e1b3, 0x1d5c1a2f, 0x587db641, 0x24be7367, 0x46858cf2, 0x7ddc02fe,
  0x0b197162, 0x9a39dfde, 0x664cb07c, 0x7f2acac8, 0x5cafe9ae, 0x079fdb0c, 0x17213980, 0xd96d73a0, 0x9e9f9684,
  0xbe0ff4d4, 0x20c813f3, 0x537bdbcc, 0x4777e75a, 0xfa76f81c, 0x51568018, 0xc715c253, 0x719d0281, 0x0f23bd17,
  0x3b1cd2bc, 0x25ff290f, 0x852ccdc6, 0x6b77efef, 0xe71bcb12, 0xcbf828f6, 0xbf3c50a6, 0x4bf0fd85, 0x91bbb77b,
  0xcf40287c, 0x5bda5ae1, 0x2f11b017, 0x667944fe, 0x4f57777e, 0xf29608c9, 0x97223d1a, 0x0a10d077, 0xffa1a5cd,
  0x836f4e78, 0xf824253a, 0x99c63bf5, 0x0118850a, 0xcd535748, 0xd693ac11, 0x39a8150d, 0x761cc517, 0x5fd85c97,
  0xcea06263, 0x44d29dfa, 0x18a55eb8, 0x6218d570, 0x0edc42b0, 0x669ccb55, 0xf02e3c96, 0xf3035620, 0x0c8921a6,
  0x3eb71c16, 0x0a4b85e4, 0xfa1192e1, 0x8fc76690, 0x21716b86, 0x5a98e2e0, 0xc7f98f2d, 0x7423588d, 0x2f68c265,
  0x365d330d, 0xab0647b1, 0x56760ab0, 0x2bde31bf, 0xae1beb55, 0x48f0e569, 0xeff011fc, 0x7ec00e5a, 0xaece5f55,
  0xfa48e8a2, 0xd7fec37f, 0x0998a20f, 0xfaa4d070, 0x01493af2, 0x3e434950, 0xaec4e731, 0x73418255, 0x59fc252d,
  0x6ac2448c, 0x52e9d188, 0x34db00c9, 0x93c99a6f, 0xeb46af51, 0x9a2bd1fa, 0xf82ac972, 0x7fa917fe, 0x1087b8f3,
  0x7cc112f3, 0xa072e9f2, 0x8c74ca76, 0xdf995373, 0xc83d8446, 0xc2e7303e, 0xc3191e22, 0x2bac3af1, 0x31cf650c,
  0x6161dfee, 0xa123d42f, 0x73eca808, 0x417fbefa, 0x7be945dd, 0xd1913b89, 0x88f18297, 0x04d3bd6a, 0xc12fa1b3,
  0x625a9b3a, 0xfb7a7422, 0xee39d29b, 0x41f6e883, 0x385ad77a, 0xf3da0318, 0xe5bb13a7, 0xc6a6a23d, 0x28777bde,
  0x82842891, 0x881cc5ee, 0x4a7c9851, 0x5058cfd8, 0xd77ab3e2, 0xefdab318, 0x463a334f, 0xf8bfd9d3, 0x1cd1e309,
  0x599bac1e, 0xeb441cf6, 0x37b57697, 0x2be4eae3, 0x05541eab, 0xbba9d7bb, 0x75ab4968, 0x93c3ee5f, 0x0e9a1942,
  0x1e009a52, 0x6e298326, 0x5db5ac23, 0x9b5f8422, 0xa3125042, 0x958bb02a, 0x5cecf7c9, 0x89715a15, 0x71765dde,
  0xffa967d3, 0xe633b1fe, 0xa9e179bf, 0x198535c6, 0x75dd65b9, 0x371f1208, 0xb6172d74, 0x74de7e9c, 0xd6f6a3e5,
  0x381d2278, 0x40cbf389, 0x570ace2f, 0x139f5f3f, 0xf216519c, 0x5694cac1, 0x8d78b1e7, 0x07736ffd, 0x46b31ec6,
  0x048158df, 0xe0d1e2a8, 0x07fb4e7a, 0xee6abc35, 0x58c0df0a, 0x6a2f64ac, 0xd5861f42, 0x9d15ee53, 0x9d79de66,
  0x9ca7a57b, 0xc4d571bc, 0x5ad42c99, 0xe68524b2, 0x5794758b, 0x1710faf1, 0x05be0d4d, 0xea416cae, 0xa7342289,
  0x9e0a5977, 0x1cdd0f71, 0xec394eae, 0x0e4dba85, 0x443c4aab, 0xb93fa7ab, 0xd060c797, 0x2f8903e6, 0x1bb7c857,
  0x47f474b9, 0xe2ef76c6, 0xca34890b, 0x24fb5426, 0x35e594a5, 0x7b54ee93, 0xab87c4ec, 0x895b7672, 0xc015ad63,
  0x01211cfc, 0xd9592496, 0x6e008aae, 0xdbeb1761, 0x63d334f1, 0x63fa9822, 0x1fe47d0e, 0x2faa2b57, 0xd435487f,
  0xc386e190, 0xc9ef5a17, 0x12c769a6, 0x7f4199b8, 0x93f3b5d3, 0x4241c936, 0xf5320a9a, 0xb8aa96b5, 0x4deb289a,
  0x0c16c8cf, 0xad3e2069, 0xd6088981, 0x89beca80, 0xf4ec34d0, 0x8fd22049, 0x328709da, 0x9f337f9b, 0x88b6019a,
  0x3166ba5b, 0x39a32da8, 0xb78c8799, 0x3b9fdc59, 0x7eaefaed, 0xf0ae77c8, 0x7d914386, 0x763e6d37, 0x44dcd7df,
  0xf959fbb5, 0x8ef09ebf, 0x7aa07169, 0xb2c07e91, 0x165caeea, 0xb31de3f1, 0x2bd25c09, 0xb9eb6d55, 0x09084b5d,
  0x94f3b329, 0x9a363da5, 0x6e796824, 0x7b33d997, 0xcacafba8, 0x02bdefa5, 0xe13c4bc2, 0xb321a08c, 0x90d1152f,
  0x00d7dfac, 0x52165de2, 0xa030c916, 0x35fc4cfb, 0x5237c4a6, 0x2774cddf, 0xf97a8886, 0x0dde4dff, 0x104ab2c7,
  0x581966dd, 0x0dee4d60, 0x74e2a1cf, 0xd66047ee, 0xfbe21da4, 0x3bd690df, 0x73cd6842, 0x7abe4301, 0x15148e28,
  0x7085e33c, 0x172bfd77, 0xb67caf5c, 0xd88cb192, 0x12678294, 0x0e47a14a, 0xacf00ec7, 0x25090f41, 0x03e51354,
  0x3e4662cf, 0xa512243b, 0x66b43b12, 0x41c3a19a, 0xd3833d98, 0x48a29f36, 0x79aab465, 0x2f9c20bb, 0xeb926d50,
  0x8eeb9c56, 0xe5e0ca2c, 0x9d8a2746, 0x2a834bf2, 0xe071600e, 0xe9090756, 0xd8e16aee, 0xc4dffdfd, 0xcf388f5a,
  0x455c2732, 0x7922da44, 0x40b342c0, 0xa7f4dd22, 0x9b0729a0, 0x6a522a1b, 0xe846fa27, 0x41ade552, 0x95405f0b,
  0x6bf462c6, 0x44857736, 0xb741ab7a, 0x547a4c2e, 0x159703f1, 0x6ed670d9, 0x2b43ece1, 0x587d185f, 0x234392fd,
  0x223cd937, 0x1009dce1, 0xdd47ffa9, 0x1809695f, 0xcee0ce5f, 0xbaa5ef4c, 0x9d6d3cd5, 0x28b5dc3d, 0x4c6e420e,
  0x01161482, 0xe822fd13, 0xbd025bd2, 0xe14c5baa, 0x492d7a18, 0x0c56eb05, 0x2886119e, 0x50a40094, 0xb0c71c6d,
  0xf781e181, 0x859c765d, 0x224c07d7, 0xdb5528b2, 0x5e76bfd4, 0x2bc5c85d, 0xf87a9dc8, 0x92dd71ba, 0x4c0c3829,
  0xf30c9597, 0xfef8f9c0, 0x55c4e5fb, 0xcfa5b5d4, 0x8fa609a4, 0xb081ec82, 0xbae13c84, 0xb5a14f9c, 0xf2e4c518,
  0x42a52024, 0xb6643ce5, 0x75e362cd, 0xc4a491d9, 0x58dc527d, 0xbd427d0c, 0xd1fde4ca, 0x16a66af2, 0xee399597,
  0x47c1169e, 0x28a5d147, 0xe1085460, 0x4f719582, 0xbf6f92d3, 0x8a0f8224, 0x84ac742e, 0x9a338a81, 0x552acb3c,
  0x657eb10f, 0x0b1469d4, 0xc8be203a, 0xd3e842fe, 0xdea2c318, 0x7c231c32, 0x735df2b0, 0x804b275f, 0x584e0e52,
  0x6284d0f4, 0x3f2d6d8a, 0x623e2090, 0x4781eb98, 0xc9de7b3f, 0x221f4233, 0x10eb2e08, 0xca9d4931, 0x9276cc56,
  0x26c6bf27, 0xb47c1c66, 0x028bf9bb, 0xf6fb5417, 0x386315ca, 0x141ae572, 0x6819cd49, 0x75bc9e3a, 0x34e73421,
  0x283a0432, 0xd59a40ec, 0x12f47770, 0xb930aa03, 0x68f61597, 0x13cb3299, 0xce15d54c, 0xf08e37a7, 0x9cd2d77b,
  0xf9e85d24, 0x98502383, 0xc02a3791, 0x8d9d20d3, 0x836d5569, 0xd358e01f, 0x6d62d82c, 0x445ed36c, 0xe8e43dd7,
  0xcbe56280, 0x7f5dc734, 0xd84d5384, 0x8c0fbc04, 0x7734eff2, 0x42fd93c9, 0x110e7b4b, 0x727a8473, 0x9e3a1d31,
  0x66ca5959, 0xa0350d99, 0xe40d1cc2, 0x9fb56da8, 0x554986fc, 0xfae1a98b, 0x9a9395b3, 0x713a662f, 0x2c999e10,
  0x6b1a604b, 0xbfbb0059, 0xddd945c2, 0x5f93f780, 0xb50fa3f5, 0xaf2ba889, 0x7e150eff, 0xea9b04e3, 0x5bb6aaca,
  0x78674a38, 0x851a2ac9, 0x26c7a625, 0x76c87280, 0xd056519d, 0x2664bc17, 0xb15d568b, 0xd1ba48d2, 0x178629d3,
  0xcd97ddd6, 0x81550c6b, 0xaa3eb2c7, 0x0bcb6fba, 0xaac0b5a6, 0x7fe3b480, 0x870df72a, 0x49a34d95, 0x4936982b,
  0x021ca135, 0x60440a48, 0xc6da023d, 0x9896f6ba, 0x6ab52a0c, 0x7964b3f4, 0xef3fe407, 0x434d65b0, 0x0779def0,
  0x2c98d742, 0x7fe83160, 0xb497eca9, 0x2053bee9, 0xcf9ba4f0, 0x166b324a, 0xa3924143, 0x09e3091a, 0x6cd3d28c,
  0x70d82cf2, 0x0891d7a3, 0x3aaf5a4b, 0x5f92ad2c, 0x13f42cf9, 0xee0578a3, 0x08c3066a, 0x592ce0dc, 0xb056e9f1,
  0x9b8a9bbc, 0x3079e952, 0xc60a7172, 0xc7458d39, 0xcf6aa29f, 0x488b5c4d, 0x2a73cd50, 0xd2f7ec89, 0x0b140d0f,
  0x4352665d, 0xeab51fda, 0x8a83ac8a, 0x010b7514, 0x7e44deb4, 0xec0b2385, 0x53d5e52b, 0xc85ce4bf, 0x4e36099b,
  0x80f96da9, 0x70e67964, 0x58fa9fbf, 0x0015db39, 0x8e677d34, 0x30765a86, 0xe16f57f8, 0xd6340f04, 0x5058f085,
  0xda387763, 0x76eb113c, 0x4ff70b36, 0xc882ee44, 0xce070543, 0xde10db6d, 0x3b610c6c, 0xa999a501, 0xc818013e,
  0x1d1e5406, 0x283e7c06, 0xeda9ba98, 0x240fbf03, 0x000c30ff, 0xf4aded18, 0x9f7b0c62, 0xf7f3c092, 0x651bfec8,
  0xcbf26af0, 0x5b4730d4, 0x5e43416d, 0x095fece8, 0xf7b46005, 0x355a672e, 0xb433bc02, 0x0f6ae7ca, 0x2724cf9f,
  0xbd899122, 0x47f74141, 0xe960472b, 0x0af6890e, 0xf9062e9f, 0x5229366f, 0xe9868844, 0xf6076778, 0x876b7aaf,
  0xa0f955c5, 0x3cf7dff4, 0xcfe1b273, 0x62f1dbab, 0x52cd6f79, 0xa96453f8, 0x2d4401cf, 0x91d1c31a, 0x03df0c4d,
  0x92543b3d, 0x8603f150, 0xaec614a7, 0xc72a4045, 0x3fe574cc, 0x937fe54f, 0xc1e1e7b1, 0x83179310, 0x3b27b9dc,
  0xed0b647c, 0x26d891bd, 0xa9162ccf, 0x44600ff7, 0x1b3db5f0, 0xeb200c7d, 0xc9e13430, 0xc5d3dbfd, 0x7c2f101f,
  0xecddee41, 0xd108c96e, 0xc548e9e0, 0x6bd82b5a, 0x0b3a8b01, 0x8a929e0e, 0xd815d5ba, 0x7a02e56e, 0xfeb7fe3e,
  0xe84cfe0c, 0x963ead40, 0x7fc8a5bb, 0x22adbace, 0x34e78cc7, 0x2689f6e5, 0xa93acff6, 0xe6795a7a, 0x82b14de9,
  0x62c71aae, 0x8215f853, 0xabd29911, 0x50310ca2, 0x49dd602f, 0x7c44da2f, 0xe813366a, 0x2b425319, 0xe512c43c,
  0x8260c2de, 0x95193709, 0x401980c3, 0x4b5e8f52, 0xa24be029, 0xbca6d7ea, 0xb009fe2b, 0xc62c9340, 0xaebbc5b9,
  0x1787e4d0, 0xf3d3bf10, 0x3329af9e, 0x33685293, 0xa287d6a3, 0x0fc60a74, 0x2c0066bf, 0x86486ec7, 0x729eb047,
  0x0a2f4484, 0xcee3bbc0, 0xf4ef4e4d, 0xca90b130, 0x4de72f8f, 0xa0f99c79, 0x39149cff, 0x10014046, 0x936c03d0,
  0x973be9b8, 0x244fc718, 0x11b100fb, 0x669be4ab, 0x7c09ee66, 0x5550885d, 0x80439403, 0x2604b48f, 0xea5066b6,
  0x326dc8a1, 0x6cf259b0, 0xa7eef94e, 0x47288d13, 0x625a248d, 0x5d404166, 0x1c56dd13, 0x298887c3, 0x210b5f0d,
  0x73cdc41b, 0xb30d7a43, 0x358efa16, 0x151ebf5d, 0xa0074b9a, 0x9b057fdf, 0x8dcd8ca6, 0x22e74776, 0x5c2ab9bf,
  0xc1b99f59, 0xffe29375, 0xfcba1b45, 0x6f851476, 0x3ec023f0, 0x22f788b1, 0x4da31b71, 0x93252845, 0x7a706c99,
  0xe35cf844, 0xc90e3935, 0xc9f0a005, 0xdd81f955, 0xa56121f8, 0x7f0787c5, 0x96ac8dfa, 0xf45de160, 0x3140f23e,
  0x71fe948a, 0xc92dee9d, 0x3f68d7d1, 0x18cb08fe, 0x71df80b7, 0xc42779a0, 0x293a6acf, 0xf9d05b99, 0x7310b8ee,
  0x2f327b18, 0x2e31636a, 0x86730f1c, 0xccf2a946, 0x115340da, 0xbcc541f3, 0x7f51e8ef, 0x7e65f0ea, 0x6c499ef7,
  0x0b791c34, 0x1d895246, 0xde154e8a, 0x29f90979, 0x32237c52, 0xd4bd58cc, 0xb6da7039, 0xf0845aaa, 0x7bc511c7,
  0x87627fd2, 0xbb200341, 0x022ca3fc, 0x84d037c4, 0x0530e1a4, 0x6ed2c548, 0x5159d444, 0xaa037528, 0xf93fcd43,
  0xca87b830, 0x0d00e372, 0xcc3d9b47, 0xd56077dc, 0x550ca65b, 0x5e0d2479, 0x3d09b749, 0x918fa615, 0xcc1c19e5,
  0x82e7b05e, 0x672e0458, 0xc24c7cd0, 0xea4d09e8, 0x90918e55, 0x50d10751, 0x0d5b33e6, 0x4473c233, 0x2d11d11a,
  0xba47a88d, 0x182f361d, 0xcfaa0a54, 0x231002f7, 0xbda9aa7e, 0xb1f412d4, 0xfc8f5db3, 0x08dafa44, 0x57d8fb44,
  0x0446ef6c, 0xa8c845ac, 0xc7d0b248, 0x5872dc04, 0xdb441d0b, 0xc8b6b043, 0x4a7c8ebf, 0xe69f611f, 0x9fced068,
  0xe6162edd, 0xe03d33b9, 0x2f22e4b9, 0x12001b83, 0xcae7c566, 0x194fcad2, 0x9d7d2504, 0xd127d71a, 0xd065c935,
  0x4809741c, 0x468807c1, 0xe14c11e0, 0xe4438a11, 0x1a67fa22, 0x5be8ce84, 0x3fcda6fb, 0x66dee3af, 0xfc874440,
  0xa39fd914, 0x4ea74edb, 0x855c3f5e, 0xc6d33767, 0x0e6f2045, 0xeaf14eb2, 0x248cd27e, 0xf92bd623, 0xc75cc907,
  0xaf25a963, 0x5cd64fc1, 0x0aab5166, 0x6b2e8c49, 0x5b30b879, 0x0088172c, 0x975b5416, 0xdf0684b5, 0x67e0c05e,
  0x7e31b217, 0x3af36834, 0x8f2df48a, 0x652ce0b6, 0x2c01aa66, 0x2583196e, 0x091bfa12, 0x37e5a953, 0x06a0cfb8,
  0xf52fd3b5, 0xeb1203a2, 0xa4b158dc, 0x6dc80df4, 0x73bc65fc, 0x8f58c282, 0x94920c7c, 0x29231a1a, 0x7d42537d,
  0x5328ee3b, 0xd901e247, 0xfa2411ef, 0xcdd62876, 0x56cf06b2, 0x0e32e5b4, 0xb8ce276a, 0x12e12960, 0x68d48f89,
  0xe2a57169, 0xa00308e5, 0x72dc555f, 0xff1b0003, 0x579d13f5, 0x29f09544, 0x708abbec, 0x542e21d0, 0x41ac9e24,
  0x3cddc16d, 0xa47d6b21, 0x8a2f2c42, 0xd12dad26, 0x6b8a9b82, 0x258be83d, 0xa32d77ad, 0x3700b152, 0xbafa2cd8,
  0xa25105b8, 0xcf4af33c, 0x6ccf8bbf, 0x17c3b208, 0xeeb056fa, 0xbc866e7a, 0xc482f4e0, 0x1153ef23, 0x06b502e1,
  0x00d6d59d, 0x153265ae, 0xe9dde3d6, 0x2c862c9c, 0xc0e4ba30, 0x92ae2ad3, 0x55d4d70e, 0x186795ba, 0xcb479f6f,
  0xb7477313, 0xc6e940ec, 0xd4e8fc7d, 0x28dc3ee8, 0x21fd4084, 0x5ecd5ae6, 0xb65bbbe6, 0x597dc5fc, 0xa97e2f2f,
  0x2ea536d7, 0x22a7f3f9, 0x497a6088, 0x2b1bbfb2, 0x13338933, 0x01507bbd, 0x8ccd7225, 0x21a9818d, 0x49e648de,
  0x86eff0e3, 0x3697d285, 0x7da612e7, 0xfe9943f5, 0xb723cdb4, 0x34513a4d, 0xbb71e1fb, 0x4c7bb7d5, 0xa08ed8d2,
  0x67534eac, 0x98176368, 0x13c34d17, 0x67cb2942, 0xbf64ce1c, 0xee6fdd1d, 0xa5240020, 0xbcf2a215, 0x2d556f79,
  0xc2958746, 0xc8f6df34, 0x96c9ae6a, 0x76199ac6, 0x335af41e, 0x1da3be21, 0x1b1b4005, 0x94a27d23, 0x4da9ff64,
  0xe4322fac, 0x541c9099, 0x1fe8944b, 0xd1aa2daf, 0x6866399e, 0xe6a5e474, 0x87428960, 0xcc05bf7f, 0xf0584561,
  0x170bfd7a, 0x2d5c9009, 0x437552ed, 0xe0e627f2, 0x265b71c3, 0x1e8794d4, 0xe388157c, 0x8e70dbf2, 0x326d5b6e,
  0xed344159, 0xa869b631, 0xde4fa650, 0x3a11c341, 0x54b1e414, 0xeeea5713, 0x12b41c5f, 0xf235e842, 0x5ed41fe1,
  0xd8e0144f, 0xfd359e03, 0x40baeae2, 0x29482a3c, 0xe5987d6c, 0x64d82009, 0x12ec6f48, 0x7acddb94, 0xbd8ee274,
  0xc298d7ac, 0x84fbf5db, 0x5bc7ff48, 0x87ac6c03, 0x2b1244d4, 0xffeafdd6, 0x44142436, 0xf62073bd, 0xacf4faa8,
  0x7f56c994, 0xd0ceb414, 0x9259d337, 0xfbecad13, 0x26cc56f8, 0xab3ebd29, 0xbb5c27af, 0x1dcc89c2, 0x460219a1,
  0x6cbff94c, 0x03cab521, 0x306f5c87, 0x307a0db6, 0xbd2b9b2c, 0x0d93a83e, 0x3cab40d4, 0xa2409dc7, 0x3b6646f2,
  0x7b94d65d, 0xf06797c3, 0xd44d9fce, 0x768a930c, 0x6008e193, 0x3675e045, 0x56250ba7, 0xabb192b3, 0x1d4be596,
  0x4c0888eb, 0xf0e6ba63, 0x31b5c72c, 0x03dd4788, 0x01747419, 0x0aee820b, 0x95a60359, 0x4b4cfae3, 0x5984d5ee,
  0x6f7531a1, 0xe0415b28, 0x9985d18a, 0xa7082eaa, 0xa1e01dac, 0x918f4c8b, 0xc8747a86, 0x80960a64, 0xef567aee,
  0x76704a99, 0x04bd36d4, 0xeae5638d, 0x7a8a4dad, 0x6338cf40, 0x2a97236a, 0x7bf0c879, 0xdf2d8a60, 0x1a89640c,
  0xfb1a999c, 0xc7c6613b, 0x094cbd63, 0xcae6d250, 0x4e6e89c1, 0x95a963a2, 0xf06b89fc, 0x5c1e3e13, 0xc35c57ab,
  0xfd498208, 0x16de663f, 0x7b1672bd, 0x273476bd, 0x473107ce, 0xf599c82a, 0x0c53b43c, 0x8afb0e68, 0x6d835851,
  0x97f34b4d, 0xe86dcc08, 0xdb4bcd98, 0x40ec458e, 0xa7e910f7, 0x01dac253, 0x94d58529, 0x8bb67bdb, 0x359cd241,
  0x1ccce2d9, 0x179effc3, 0x18199ddf, 0x7469482d, 0x0f99205d, 0x80a7cd86, 0x034e5321, 0xde3dddfa, 0xc8d0a264,
  0x76b27cb5, 0x97ae9f61, 0x0ff0bc32, 0x3090ec2e, 0xc194d447, 0xf734f606, 0x7e3a3616, 0x02f60894, 0x78d4cec1,
  0x6f6d70cb, 0x411204a8, 0x05a6ec4d, 0xbfaffa08, 0xcb1da686, 0x60e92ac4, 0xbfae490e, 0x7d418477, 0x3e606f06,
  0x16b7f1b4, 0x2c5fbcf5, 0x0cd31f64, 0x748f159a, 0xe8a49197, 0x8292ef36, 0x52766a8d, 0xcf8855ca, 0x3987931f,
  0x6ccd79cc, 0xff0c5bbe, 0x3f3c1ef0, 0x36495254, 0xc16f5d4e, 0xe8d848d1, 0xbe3b5e8e, 0x2eac0c12, 0x147a46b4,
  0xf78bc6b2, 0x281fecf6, 0x74efa3a5, 0x6e4e474b, 0xac363b25, 0xb1e60108, 0xa8698a62, 0x577769c8, 0x96be195e,
  0xe8545561, 0x99c504d8, 0xf3562aaa, 0x7e186562, 0x0d838b01, 0xbddabfc2, 0xfca93b9d, 0xecae1f36, 0x00324241,
  0xe0febf17, 0x284bbfd2, 0x4714aacd, 0x45538e4b, 0xccc8f1bb, 0xddbeb8bb, 0x38e84c8b, 0x488102c8, 0x06973ed2,
  0xae3a89c3, 0xcb9a3a9f, 0xba185485, 0x264ea498, 0xcc4a0265, 0x52cac672, 0xf899f27d, 0x45f7a211, 0xc525dda9,
  0xb69ca55d, 0x1dbe63b8, 0xe1168707, 0x7c20c976, 0x39767288, 0x86e5b1ba, 0xee0107ee, 0x93b9fdc5, 0x05f6cfd2,
  0x071aac08, 0xe2294a3a, 0xbf2923d6, 0x85902fed, 0x9d9dc398, 0xe7baa646, 0xd784bc2b, 0xd7579aef, 0xe71d14a2,
  0x03795e17, 0xea2af8ff, 0xb120f7db, 0xbbb8a7ac, 0x2c610272, 0x230f971d, 0xe3c5f2b2, 0x80e99299, 0x893dff3a,
  0x80ca26f4, 0x985dc538, 0xc3e9e58d, 0xd61b60e0, 0x49c16e50, 0x18cdfcf4, 0x600f021d, 0x02735dae, 0xcd5b1e1d,
  0x8761db38, 0xcf803f5a, 0x2c7a5bb3, 0xc470948c, 0x41273258, 0x50327407, 0x8f6d6686, 0xf0c347d8, 0xecabac98,
  0x7ddeaab7, 0x525f854c, 0x10702eee, 0x0db6bc4a, 0x101bdea0, 0x4850094a, 0x7dba68f4, 0x77e4d1e7, 0xd108d3c3,
  0x11f898b3, 0xef4a8dae, 0x02f485d8, 0x1b74c4e3, 0xd9a2cd22, 0xc63a790e, 0x91ad4326, 0xf07a86ae, 0xa5099a1f,
  0xe620266f, 0xe9675843, 0x97bf0b09, 0xeb32e226, 0xd6f9c6d2, 0xa41d466f, 0x1b0592c3, 0x3df7414c, 0x69e0ee55,
  0x0651c679, 0xa5d8c6fd, 0xf8680dc2, 0x37196c4c, 0xe81764ca, 0x50b88fa7, 0xabfba8e6, 0x506600f4, 0x4f44650e,
  0x1b5520d9, 0xb8dac50b, 0xb9dd93ec, 0xaa8ffcd3, 0x72411604, 0xcadebec6, 0x231b9919, 0x4adcb479, 0x2beaa858,
  0xdc2cfe91, 0x522c7694, 0x47075be7, 0xb59889b4, 0x191acb91, 0x026eec17, 0xbddb8dd1, 0x6ffe981d, 0xe296fa3b,
  0x5027812f, 0x3f63c673, 0xcaa49f3e, 0xcf0172c8, 0x35f102c6, 0x0160140c, 0x3a8ff57a, 0x24f6c530, 0x410cd23c,
  0xb85f2b94, 0x92aac8ad, 0x8e36af07, 0x8b958306, 0xe507095a, 0x1bf5e999, 0xab3c0fbd, 0xe0a9b05d, 0x32742fd8,
  0xf49b000a, 0x08829246, 0x08d642ff, 0x2670fa1e, 0x7f33b877, 0x2b7c754a, 0xd153dccb, 0xe835369c, 0x8fa00597,
  0xebefb3aa, 0x085f7f62, 0x062901ce, 0x61b620cf, 0xe321758b, 0x3e93ddd9, 0x9a5aa64b, 0x79baa1ec, 0x9bccb0a2,
  0x8b847954, 0xd8fb5569, 0x8bdb149b, 0xea825baf, 0x45d41ff8, 0x8483cb3b, 0xbcd94042, 0xaf6a35de, 0xe9764238,
  0x9d0a241b, 0xb5db6413, 0x662a56b2, 0x20a6bf7a, 0xc894adbd, 0x11a86dd7, 0xc84d45b1, 0x57ede14d, 0x6804a4ee,
  0xd975ccd0, 0x9f3599e2, 0xae0fe2df, 0x79296d88, 0x482c87cb, 0x34b1d725, 0x744728b2,
]
// gen-p256-table:end

/** The limbs one comb table entry takes: X and Y, eight each (Z is 1). */
const P256_BASE_ENTRY: i32 = 16

/**
 * `m = (k + 2^B - 1) / 2 mod n` for the 32 big-endian bytes `k`, `B` the
 * comb's bit count, so that `2m - (2^B - 1)` is `k` mod n: read as signed
 * digits, every bit of `m` counts +1 when set and -1 when clear (ECC-7). `k`
 * is first taken mod n by a subtraction kept or dropped by fiat's
 * conditional move; the halving is a scalar Montgomery multiply by
 * `2^-1 R`. Every step runs whatever `k` is. `s.t0` (`k - n`) and `s.t1`
 * (the constants) are left to the caller's `p256WipeScratch`.
 */
const p256BaseRecode = (m: u32[], k: u8[], s: P256PointScratch): void => {
  p256LimbsFromBytes(m, k, 0)
  p256SetOrder(s.t1)
  p256FiatSelectznz(m, p256SubBorrow(s.t0, m, s.t1), s.t0, m)
  p256BaseOffset(s.t1)
  p256FiatScalarAdd(m, m, s.t1)
  p256BaseHalf(s.t1)
  p256FiatScalarMul(m, m, s.t1)
}

/**
 * Digit `i` (0 to `P256_COMB_SPACING - 1`) of comb `c`: bit
 * `c TS + j S + i` of the recoded scalar `m` as bit `j`, for each tooth `j`
 * below `T`. A position past bit 255 reads as 0. The positions are the
 * caller's loop position; the bits only reach `digit`.
 */
const p256BaseDigit = (m: u32[], c: i32, i: i32): u32 => {
  if (toI32(m.length) < 8) {
    return 0
  }
  let digit: u32 = 0
  for (let j: i32 = 0; j < P256_COMB_TEETH; j++) {
    const bit: i32 = (c * P256_COMB_TEETH + j) * P256_COMB_SPACING + i
    const limb: i32 = bit >> 5
    // `limb` is below 16 (the comb covers fewer than 512 bits), so
    // `(limb >> 3) - 1` is all ones below 8 and 0 past the top, with no branch.
    const at: i32 = limb & 7
    const word: u32 = m[at] & toU32((limb >> 3) - 1)
    digit = digit | (((word >> toU32(bit & 31)) & 1) << toU32(j))
  }
  return digit
}

/**
 * `out.x |= X & mask` and `out.y |= Y & mask` for the entry at limb `at`:
 * with `mask` all ones for the one entry the scan keeps and 0 for every
 * other, OR-ing over every entry into a zeroed `out` leaves that entry. The
 * sixteen loads happen whatever the mask, at an offset that is the caller's
 * loop position, never the secret.
 */
const p256BaseMove = (out: P256ProjectivePoint, table: u32[], at: i32, mask: u32): void => {
  const x: u32[] = out.x
  const y: u32[] = out.y
  if (toI32(x.length) < 8 || toI32(y.length) < 8 || at < 0 || at > toI32(table.length) - P256_BASE_ENTRY) {
    return
  }
  const p: u32 = toU32(at)
  for (let i: u32 = 0; i < 8; i++) {
    x[i] = x[i] | (table[p + i] & mask)
    y[i] = y[i] | (table[p + 8 + i] & mask)
  }
}

/**
 * The signed entry of comb `c` that `digit` names, into `out.x` and `out.y`,
 * without indexing or branching by `digit`. Its top bit is the top tooth's:
 * set, the entry is table entry `u`, the digit's low bits; clear, it is the
 * negation of entry `~u`, every tooth's sign flipped. All entries of the comb
 * are read, and `p256BaseMove` keeps the one `ctEq` names; `-Y` is computed
 * whatever the digit and kept or dropped by fiat's conditional move, so the
 * same loads and arithmetic run for every digit (ECC-7). `s.t0` (`-Y`) and
 * `s.t1` are left to the caller's `p256WipeScratch`.
 */
const p256BaseSelect = (
  out: P256ProjectivePoint,
  table: u32[],
  c: i32,
  digit: u32,
  s: P256PointScratch
): void => {
  const entries: i32 = P256_COMB_ENTRIES
  const low: u32 = toU32(entries - 1)
  const top: u32 = digit >> toU32(P256_COMB_TEETH - 1)
  const u: u32 = (digit ^ ctEq(top, 0)) & low
  p256SetZero(out.x)
  p256SetZero(out.y)
  for (let j: i32 = 0; j < entries; j++) {
    p256BaseMove(out, table, (c * entries + j) * P256_BASE_ENTRY, ctEq(toU32(j), u))
  }
  p256SetZero(s.t1)
  p256FiatSub(s.t0, s.t1, out.y)
  p256FiatSelectznz(out.y, top, s.t0, out.y)
}

/**
 * `s.sum = p + q` for an affine `q` (its Z taken as 1 and never read), by
 * Renes, Costello and Batina's Algorithm 5 (complete mixed addition for
 * a = -3), step for step in the paper's order. Complete for every `p`, the
 * identity included, and every `q` but the identity, which the comb table
 * never holds.
 */
const p256PointAddMixed = (p: P256ProjectivePoint, q: P256ProjectivePoint, s: P256PointScratch): void => {
  const t0: u32[] = s.t0
  const t1: u32[] = s.t1
  const t2: u32[] = s.t2
  const t3: u32[] = s.t3
  const t4: u32[] = s.t4
  const x3: u32[] = s.sum.x
  const y3: u32[] = s.sum.y
  const z3: u32[] = s.sum.z
  p256FiatMul(t0, p.x, q.x) // 1
  p256FiatMul(t1, p.y, q.y)
  p256FiatAdd(t3, q.x, q.y)
  p256FiatAdd(t4, p.x, p.y)
  p256FiatMul(t3, t3, t4) // 5
  p256FiatAdd(t4, t0, t1)
  p256FiatSub(t3, t3, t4)
  p256FiatMul(t4, q.y, p.z)
  p256FiatAdd(t4, t4, p.y)
  p256FiatMul(y3, q.x, p.z) // 10
  p256FiatAdd(y3, y3, p.x)
  p256FiatMul(z3, s.b, p.z)
  p256FiatSub(x3, y3, z3)
  p256FiatAdd(z3, x3, x3)
  p256FiatAdd(x3, x3, z3) // 15
  p256FiatSub(z3, t1, x3)
  p256FiatAdd(x3, t1, x3)
  p256FiatMul(y3, s.b, y3)
  p256FiatAdd(t1, p.z, p.z)
  p256FiatAdd(t2, t1, p.z) // 20
  p256FiatSub(y3, y3, t2)
  p256FiatSub(y3, y3, t0)
  p256FiatAdd(t1, y3, y3)
  p256FiatAdd(y3, t1, y3)
  p256FiatAdd(t1, t0, t0) // 25
  p256FiatAdd(t0, t1, t0)
  p256FiatSub(t0, t0, t2)
  p256FiatMul(t1, t4, y3)
  p256FiatMul(t2, t0, y3)
  p256FiatMul(y3, x3, z3) // 30
  p256FiatAdd(y3, y3, t2)
  p256FiatMul(x3, t3, x3)
  p256FiatSub(x3, x3, t1)
  p256FiatMul(z3, t4, z3)
  p256FiatMul(t1, t3, t0) // 35
  p256FiatAdd(z3, z3, t1)
}

/**
 * `out = k * G` for 32 big-endian bytes `k`, in constant time, by the signed
 * comb described in the module's header: `k` recoded by `p256BaseRecode`,
 * then `P256_COMB_SPACING` rows from the top down, a doubling between rows,
 * and in each row one signed entry of each comb, read by `p256BaseSelect` and
 * added by `p256PointAddMixed`. Every digit names an entry, so every addition
 * is kept and every one costs what any other does. The same point as
 * `p256ScalarMult(out, k, G, s)`, which tests/link/crypto_p256_agree checks
 * bit for bit.
 */
const p256BaseMult = (out: P256ProjectivePoint, k: u8[], s: P256PointScratch): void => {
  const table: u32[] = p256BaseTable()
  p256BaseMultWith(out, k, s, table)
}

/**
 * `p256BaseMult` in the caller's table (`p256BaseTable()`), so that it
 * allocates nothing: what `P256SignScratch` signs with. `out` is the
 * accumulator, overwritten step by step until it holds `k * G`. The recoded
 * scalar in `s.comb` and the entry selected into `s.entry` follow `k`, so
 * both are wiped before this returns, and `s.sum` with the rest of `s` by
 * the caller's `p256WipeScratch`; the table is a function of G alone, and
 * kept.
 */
const p256BaseMultWith = (out: P256ProjectivePoint, k: u8[], s: P256PointScratch, table: u32[]): void => {
  if (toI32(k.length) < 32) {
    return
  }
  const m: u32[] = s.comb
  p256BaseRecode(m, k, s)
  p256SetIdentity(out)
  for (let i: i32 = P256_COMB_SPACING - 1; i >= 0; i--) {
    if (i < P256_COMB_SPACING - 1) {
      p256PointDouble(out, out, s)
    }
    for (let c: i32 = 0; c < P256_COMBS; c++) {
      p256BaseSelect(s.entry, table, c, p256BaseDigit(m, c, i), s)
      p256PointAddMixed(out, s.entry, s)
      p256PointCopy(out, s.sum)
    }
  }
  wipe(m)
  p256WipePoint(s.entry)
}

/**
 * The affine x of `p` as plain limbs, `X / Z` out of the Montgomery domain,
 * which is all ECDSA reads of a point. The identity has no affine form; its Z
 * inverts to zero and so does the answer, which callers rule out first.
 */
const p256AffineX = (x: u32[], p: P256ProjectivePoint): void => {
  const zInverse: u32[] = p256Limbs()
  p256FieldInvert(zInverse, p.z)
  p256FiatMul(x, p.x, zInverse)
  p256FiatMul(x, x, p256PlainOne())
}

/**
 * The point a SEC 1 §2.3.4 uncompressed encoding names, or `null` when it
 * names none: a length other than 65, a first byte other than 0x04, a
 * coordinate of p or more, or a pair that is not on the curve. The identity
 * has no 65-byte encoding (SEC 1 writes it as the single byte 0x00), so it is
 * refused by the length, and its would-be spelling as (0, 0) is not on the
 * curve. Everything here is public — it is a key someone sent — so it may
 * branch.
 */
const p256DecodePoint = (bytes: u8[]): P256ProjectivePoint | null => {
  if (toI32(bytes.length) !== 65 || toI32(bytes[0]) !== 4) {
    return null
  }
  const prime: u32[] = p256Prime()
  const r2: u32[] = p256FieldR2()
  const p = new P256ProjectivePoint()
  p256LimbsFromBytes(p.x, bytes, 1)
  p256LimbsFromBytes(p.y, bytes, 33)
  if (p256Below(p.x, prime) === 0 || p256Below(p.y, prime) === 0) {
    return null
  }
  p256FiatMul(p.x, p.x, r2)
  p256FiatMul(p.y, p.y, r2)
  p256FiatSetOne(p.z)
  // y^2 = x^3 - 3x + b, both sides in the Montgomery domain.
  const lhs: u32[] = p256Limbs()
  const rhs: u32[] = p256Limbs()
  const t: u32[] = p256Limbs()
  p256FiatSquare(lhs, p.y)
  p256FiatSquare(rhs, p.x)
  p256FiatMul(rhs, rhs, p.x)
  p256FiatAdd(t, p.x, p.x)
  p256FiatAdd(t, t, p.x)
  p256FiatSub(rhs, rhs, t)
  p256FiatAdd(rhs, rhs, p256CurveB())
  p256FiatSub(t, lhs, rhs)
  if (p256FiatNonzero(t) !== 0) {
    return null
  }
  return p
}

/** `p` as its 65-byte uncompressed SEC 1 encoding; `p` is never the identity here. */
const p256EncodePoint = (p: P256ProjectivePoint): u8[] => {
  const zInverse: u32[] = p256Limbs()
  const one: u32[] = p256PlainOne()
  const x: u32[] = p256Limbs()
  const y: u32[] = p256Limbs()
  p256FieldInvert(zInverse, p.z)
  p256FiatMul(x, p.x, zInverse)
  p256FiatMul(y, p.y, zInverse)
  p256FiatMul(x, x, one)
  p256FiatMul(y, y, one)
  const out: u8[] = new Array<u8>(65)
  out[0] = 4
  p256LimbsToBytes(out, 1, x)
  p256LimbsToBytes(out, 33, y)
  return out
}

/**
 * Whether 32 big-endian bytes hold a scalar in [1, n), the range of a private
 * key, a nonce and each half of a signature. Constant time in the value; the
 * caller branches on the answer, which says only that the input was usable.
 */
const p256ScalarInRange = (bytes: u8[]): boolean => {
  if (toI32(bytes.length) !== 32) {
    return false
  }
  const a: u32[] = p256Limbs()
  p256LimbsFromBytes(a, bytes, 0)
  const below: u32 = p256Below(a, p256Order())
  const zero: u32 = ctEq(p256FiatNonzero(a), 0) & 1
  wipe(a) // a private key's limbs, when `bytes` is one
  return (below & (zero ^ 1)) === 1
}

/**
 * bits2int of RFC 6979 §2.3.2 for qlen = 256, then reduced mod n: the leftmost
 * 256 bits of `digest` as an integer, as FIPS 186-4 §6.4 takes a hash, and
 * then n subtracted once if it is at least n. A digest shorter than 32 bytes
 * is its own value, zero-extended on the left. Answers plain limbs.
 */
const p256DigestScalar = (out: u32[], digest: u8[]): void => {
  const length: i32 = toI32(digest.length)
  const bytes: u8[] = new Array<u8>(32)
  const take: i32 = length < 32 ? length : 32
  const skip: i32 = 32 - take
  for (let i: i32 = 0; i < take && i < length && skip + i < 32; i++) {
    bytes[skip + i] = digest[i]
  }
  const a: u32[] = p256Limbs()
  p256LimbsFromBytes(a, bytes, 0)
  p256ReduceOnce(out, a, p256Order())
}

/** RFC 2104's key block for SHA-256: `k` zero-extended to 64 bytes, each byte XOR `pad`. */
const p256PadBlock = (k: u8[], pad: u8): u8[] => {
  const out: u8[] = new Array<u8>(64)
  const outLength: i32 = toI32(out.length)
  const keyLength: i32 = toI32(k.length)
  for (let i: i32 = 0; i < outLength; i++) {
    if (i < keyLength) {
      out[i] = k[i] ^ pad
    } else {
      out[i] = pad
    }
  }
  return out
}

/** Zero what a SHA-256 in progress holds: its chaining value, its pending block and its schedule. */
const p256WipeHash = (h: Sha256): void => {
  wipe(h.state)
  wipe(h.block)
  wipe(h.schedule)
}

/**
 * HMAC-SHA-256 keyed by `k` over `a || b || c || d` (RFC 2104), the one MAC
 * RFC 6979 runs. It is written out over `Sha256` here rather than taken from
 * `nish/crypto/hmac` so that every buffer the key reaches — the two key
 * blocks, both hashers' state, block and schedule, and the inner digest — is
 * this function's to wipe before it returns (ECC-2). `k` is always 32 bytes,
 * under SHA-256's 64-byte block, so it is never hashed first.
 */
const p256Mac = (k: u8[], a: u8[], b: u8[], c: u8[], d: u8[]): u8[] => {
  const ipad: u8[] = p256PadBlock(k, 0x36)
  const opad: u8[] = p256PadBlock(k, 0x5c)
  const inner = new Sha256()
  inner.update(ipad, P256_FROM, toI32(ipad.length))
  inner.update(a, P256_FROM, toI32(a.length))
  inner.update(b, P256_FROM, toI32(b.length))
  inner.update(c, P256_FROM, toI32(c.length))
  inner.update(d, P256_FROM, toI32(d.length))
  const innerDigest: u8[] = inner.digest()
  const outer = new Sha256()
  outer.update(opad, P256_FROM, toI32(opad.length))
  outer.update(innerDigest, P256_FROM, toI32(innerDigest.length))
  const tag: u8[] = outer.digest()
  wipe(ipad)
  wipe(opad)
  wipe(innerDigest)
  p256WipeHash(inner)
  p256WipeHash(outer)
  return tag
}

/**
 * HMAC_K(V || sep || x || h), the key update of RFC 6979 §3.2 steps d and f
 * (with `sep` 0 and then 1) and, with `x` and `h` empty, step h.3.
 */
const p256NonceKey = (k: u8[], v: u8[], sep: u8, x: u8[], h: u8[]): u8[] => {
  const separator: u8[] = new Array<u8>(1)
  separator[0] = sep
  return p256Mac(k, v, separator, x, h)
}

/** HMAC_K(V), RFC 6979 §3.2 steps e, g and h.2. */
const p256NonceValue = (k: u8[], v: u8[]): u8[] => {
  const empty: u8[] = new Array<u8>(0)
  return p256Mac(k, v, empty, empty, empty)
}

/**
 * The signature of the plain scalar `z` (a digest mod n) under the private key
 * `priv`, already checked to be in [1, n), with the nonce of RFC 6979 §3.2 for
 * HMAC-SHA-256. For P-256 and SHA-256, qlen = hlen = 256, so one HMAC output
 * is one candidate `k` (step h.2 runs once) and bits2int is the identity.
 *
 * A candidate at or above n, and a `k` that gives `r = 0` or `s = 0`, go round
 * again through step h.3, as the RFC says. Whether a candidate is below n is a
 * branch on the secret, and the one the RFC prescribes: it is taken once in
 * about 2^32 signatures and says only that a discarded value was large.
 */
const p256SignScalar = (priv: u8[], z: u32[]): u8[] => {
  const n: u32[] = p256Order()
  const r2: u32[] = p256ScalarR2()
  const h1: u8[] = new Array<u8>(32)
  p256LimbsToBytes(h1, 0, z)
  const empty: u8[] = new Array<u8>(0)
  let v: u8[] = new Array<u8>(32)
  let k: u8[] = new Array<u8>(32)
  for (let i: i32 = 0; i < 32; i++) {
    v[i] = 1
  }
  // Each K and V is wiped as the next replaces it (ECC-2): both are derived
  // from the private key, and the last V is the nonce.
  let next: u8[] = p256NonceKey(k, v, 0, priv, h1) // step d
  wipe(k)
  k = next
  next = p256NonceValue(k, v) // step e
  wipe(v)
  v = next
  next = p256NonceKey(k, v, 1, priv, h1) // step f
  wipe(k)
  k = next
  next = p256NonceValue(k, v) // step g
  wipe(v)
  v = next

  const dM: u32[] = p256Limbs()
  p256LimbsFromBytes(dM, priv, 0)
  p256FiatScalarMul(dM, dM, r2)
  const scratch = new P256PointScratch()
  const point = new P256ProjectivePoint()
  const x: u32[] = p256Limbs()
  const r: u32[] = p256Limbs()
  const kM: u32[] = p256Limbs()
  const s: u32[] = p256Limbs()
  while (true) {
    next = p256NonceValue(k, v) // step h.2
    wipe(v)
    v = next
    if (p256ScalarInRange(v)) {
      p256BaseMult(point, v, scratch)
      p256AffineX(x, point)
      p256ReduceOnce(r, x, n)
      // s = k^-1 (z + r d) mod n. A Montgomery multiply of a plain value by
      // one in the Montgomery domain answers a plain value, so only d and
      // k^-1 are converted: r d and then (z + r d) k^-1 come out plain.
      p256LimbsFromBytes(kM, v, 0)
      p256FiatScalarMul(kM, kM, r2)
      p256ScalarInverse(kM, kM)
      p256FiatScalarMul(s, r, dM)
      p256FiatScalarAdd(s, s, z)
      p256FiatScalarMul(s, s, kM)
      if (p256FiatNonzero(r) !== 0 && p256FiatNonzero(s) !== 0) {
        const sig: u8[] = new Array<u8>(64)
        p256LimbsToBytes(sig, 0, r)
        p256LimbsToBytes(sig, 32, s)
        // ECC-2: the private key's limbs, the nonce and its inverse, RFC
        // 6979's K and V, the nonce point and the scratch it was built in.
        wipe(k)
        wipe(v)
        wipe(dM)
        wipe(kM)
        p256WipePoint(point)
        p256WipeScratch(scratch)
        return sig
      }
    }
    next = p256NonceKey(k, v, 0, empty, empty) // step h.3
    wipe(k)
    k = next
    next = p256NonceValue(k, v)
    wipe(v)
    v = next
  }
}

/**
 * The public key of `priv`: `priv * G` in the 65-byte uncompressed SEC 1
 * encoding. Answers `null` unless `priv` is `P256_SCALAR_SIZE` bytes holding a
 * scalar in [1, n) — 0 and n and everything above are not private keys.
 *
 * @param priv The private key, 32 big-endian bytes.
 * @returns The 65-byte public key, or `null` for a key that is not one.
 */
export const p256PublicKey = (priv: Secret<u8[]>): u8[] | null => expose(priv, p256PublicKeyExposed)

/**
 * `p256PublicKey` on the plain key, for `expose` to run: the scratch the key's
 * digits steered is wiped, and so is the projective point, whose Z they steered
 * too; only its affine encoding, the public key, is kept.
 */
const p256PublicKeyExposed = (priv: u8[]): u8[] | null => {
  if (!p256ScalarInRange(priv)) {
    return null
  }
  const point = new P256ProjectivePoint()
  const scratch = new P256PointScratch()
  p256BaseMult(point, priv, scratch)
  p256WipeScratch(scratch)
  const encoded: u8[] = p256EncodePoint(point)
  p256WipePoint(point)
  return encoded
}

/**
 * The ECDH shared secret of `priv` and the peer's public key `peerPoint`
 * (SEC 1 §3.3.1): the 32-byte big-endian x coordinate of `priv * peerPoint`,
 * as TLS 1.3 uses it (RFC 8446 §7.4.2). Answers `null` unless `priv` is a
 * private key `p256PublicKey` would take and `peerPoint` is a 65-byte
 * uncompressed point on the curve, and for a product at infinity, which a
 * valid key and point cannot give. An x of zero is a point like any other
 * and is answered.
 *
 * @param priv This side's private key, 32 big-endian bytes.
 * @param peerPoint The peer's 65-byte uncompressed public key.
 * @returns The 32-byte shared secret, or `null` for a refused key or point and
 *   a product at infinity.
 */
export const p256Ecdh = (priv: Secret<u8[]>, peerPoint: u8[]): Secret<u8[]> | null => {
  const shared: u8[] | null = exposeWith(priv, peerPoint, p256EcdhExposed)
  if (shared === null) {
    return null
  }
  return secret(shared)
}

/**
 * `p256Ecdh` on the plain key, for `exposeWith` to run. The scratch, the
 * product and every limb of `X / Z` follow the key, so all are wiped; Z is
 * inverted here, rather than through `p256AffineX`, so that its inverse is this
 * function's to wipe (`p256FieldInvert` wipes its own intermediates).
 */
const p256EcdhExposed = (priv: u8[], peerPoint: u8[]): u8[] | null => {
  if (!p256ScalarInRange(priv)) {
    return null
  }
  const peer: P256ProjectivePoint | null = p256DecodePoint(peerPoint)
  if (peer === null) {
    return null
  }
  const point = new P256ProjectivePoint()
  const scratch = new P256PointScratch()
  p256ScalarMult(point, priv, peer, scratch)
  p256WipeScratch(scratch)
  const infinity: boolean = p256FiatNonzero(point.z) === 0
  // 1 / Z, over limbs wiped below.
  const acc: u32[] = p256Limbs()
  p256FieldInvert(acc, point.z)
  const x: u32[] = p256Limbs()
  p256FiatMul(x, point.x, acc)
  p256FiatMul(x, x, p256PlainOne())
  const out: u8[] = new Array<u8>(P256_SCALAR_SIZE)
  p256LimbsToBytes(out, 0, x)
  wipe(x)
  wipe(acc)
  p256WipePoint(point)
  if (infinity) {
    wipe(out)
    return null
  }
  return out
}

/**
 * The ECDSA signature (FIPS 186-4 §6.4) of `digest` under `priv`, as `r || s`,
 * 64 bytes, with the deterministic nonce of RFC 6979 §3.2 over HMAC-SHA-256.
 * `digest` is the message's hash, taken as bits2int does: its leftmost 256
 * bits. The same key and digest always give the same signature, and `s` is
 * not normalised to the lower half. Answers `null` for a private key
 * `p256PublicKey` would refuse.
 *
 * @param priv The private key, 32 big-endian bytes.
 * @param digest The message's hash; only its leftmost 256 bits count.
 * @returns The 64-byte signature `r || s`, or `null` for a refused key.
 */
export const p256Sign = (priv: Secret<u8[]>, digest: u8[]): u8[] | null =>
  exposeWith(priv, digest, p256SignExposed)

/** `p256Sign` on the plain key, for `exposeWith` to run. */
const p256SignExposed = (priv: u8[], digest: u8[]): u8[] | null => {
  if (!p256ScalarInRange(priv)) {
    return null
  }
  const z: u32[] = p256Limbs()
  p256DigestScalar(z, digest)
  return p256SignScalar(priv, z)
}

/** The width of `p256Verify`'s window: its digits are odd, in [-15, 15]. */
const P256_WNAF_WIDTH: i32 = 5

/** The bits of a scalar `p256Wnaf` reads; its form has one more digit, for the last carry. */
const P256_WNAF_BITS: i32 = 256

/** The number of odd multiples `p256OddMultiples` builds: 1, 3, ..., 15 times a point. */
const P256_WNAF_TABLE: i32 = 8

/**
 * The width-5 non-adjacent form of the 32 big-endian bytes `k`: `out[i]`, for
 * `i` from 0 to 256, is zero or an odd digit in [-15, 15], `k` is the sum of
 * `out[i] * 2^i`, and of any five digits in a row at most one is nonzero. Read
 * from the bottom bit up, a window opening at each bit that differs from the
 * carry (libsecp256k1's `secp256k1_ecmult_wnaf`). Variable time: `k` is
 * public wherever this is used.
 */
const p256Wnaf = (out: i32[], k: u8[]): void => {
  if (toI32(out.length) <= P256_WNAF_BITS || toI32(k.length) < 32) {
    return
  }
  let carry: i32 = 0
  let bit: i32 = 0
  while (bit < P256_WNAF_BITS) {
    if (p256ByteBit(k, bit) === carry) {
      bit++
      continue
    }
    const left: i32 = P256_WNAF_BITS - bit
    const now: i32 = left < P256_WNAF_WIDTH ? left : P256_WNAF_WIDTH
    let word: i32 = carry
    for (let j: i32 = 0; j < now; j++) {
      word = word + (p256ByteBit(k, bit + j) << j)
    }
    carry = (word >> (P256_WNAF_WIDTH - 1)) & 1
    if (bit >= 0 && bit < toI32(out.length)) {
      out[bit] = word - (carry << P256_WNAF_WIDTH)
    }
    bit = bit + now
  }
  out[P256_WNAF_BITS] = carry
}

/** Bit `i` of the 32 big-endian bytes `k`, 0 the least significant. */
const p256ByteBit = (k: u8[], i: i32): i32 => {
  const at: i32 = (P256_WNAF_BITS >> 3) - 1 - (i >> 3)
  if (at < 0 || at >= toI32(k.length)) {
    return 0
  }
  return toI32((toU32(k[at]) >> toU32(i & 7)) & 1)
}

/** `table[j] = (2 j + 1) p` for each `j` in `table`, eight of them: one doubling and seven additions. */
const p256OddMultiples = (
  table: P256ProjectivePoint[],
  p: P256ProjectivePoint,
  s: P256PointScratch
): void => {
  if (toI32(table.length) < P256_WNAF_TABLE) {
    return
  }
  const twice = new P256ProjectivePoint()
  p256PointDouble(twice, p, s)
  p256PointCopy(table[0], p)
  for (let j: i32 = 1; j < toI32(table.length); j++) {
    p256PointAdd(table[j], table[j - 1], twice, s)
  }
}

/**
 * `acc += digit * p`, `digit` odd in [-15, 15], read from `p256OddMultiples`'
 * `table`; a negative digit adds the entry's negation (X : -Y : Z), built in
 * `neg`. Variable time: which entry is read, and its sign, follow the digit.
 */
const p256WnafAdd = (
  acc: P256ProjectivePoint,
  table: P256ProjectivePoint[],
  digit: i32,
  neg: P256ProjectivePoint,
  s: P256PointScratch
): void => {
  const at: i32 = (digit < 0 ? -digit : digit) >> 1
  if (at < 0 || at >= toI32(table.length)) {
    return
  }
  if (digit > 0) {
    p256PointAdd(acc, acc, table[at], s)
    return
  }
  p256Copy(neg.x, table[at].x)
  p256SetZero(neg.y)
  p256FiatSub(neg.y, neg.y, table[at].y)
  p256Copy(neg.z, table[at].z)
  p256PointAdd(acc, acc, neg, s)
}

/**
 * `out = a * G + b * q` for 32 big-endian bytes `a` and `b`, by Shamir's trick
 * over width-5 NAFs: one shared chain of doublings from the top digit down,
 * and an addition from the odd multiples of G or of `q` wherever a digit is
 * nonzero. The doublings before the first nonzero digit are skipped. **Not
 * constant time**: the additions, their table reads and their signs follow
 * the scalars' digits, so this is only for public scalars and points, as in
 * `p256Verify`.
 */
const p256DoubleMultPublic = (
  out: P256ProjectivePoint,
  a: u8[],
  b: u8[],
  q: P256ProjectivePoint,
  s: P256PointScratch
): void => {
  const wa: i32[] = new Array<i32>(P256_WNAF_BITS + 1)
  const wb: i32[] = new Array<i32>(P256_WNAF_BITS + 1)
  p256Wnaf(wa, a)
  p256Wnaf(wb, b)
  const tableG: P256ProjectivePoint[] = []
  const tableQ: P256ProjectivePoint[] = []
  for (let j: i32 = 0; j < P256_WNAF_TABLE; j++) {
    tableG.push(new P256ProjectivePoint())
    tableQ.push(new P256ProjectivePoint())
  }
  p256OddMultiples(tableG, p256Generator(), s)
  p256OddMultiples(tableQ, q, s)
  const neg = new P256ProjectivePoint()
  p256SetIdentity(out)
  let started: boolean = false
  for (let i: i32 = P256_WNAF_BITS; i >= 0; i--) {
    if (started) {
      p256PointDouble(out, out, s)
    }
    if (i < toI32(wa.length) && wa[i] !== 0) {
      p256WnafAdd(out, tableG, wa[i], neg, s)
      started = true
    }
    if (i < toI32(wb.length) && wb[i] !== 0) {
      p256WnafAdd(out, tableQ, wb[i], neg, s)
      started = true
    }
  }
}

/**
 * Whether `sig` (`r || s`) is a valid ECDSA signature of `digest` under the
 * public key `pub` (FIPS 186-4 §6.4.2): `r` and `s` in [1, n), and the
 * x-coordinate of `u1 * G + u2 * Q` equal to `r` mod n, with `w = s^-1`,
 * `u1 = z w` and `u2 = r w`. A key or signature of the wrong length, a key
 * that is not a point on the curve, and a sum that is the identity all answer
 * `false`. Every value here is public, so the answer may be reached by
 * branches, and `u1 * G + u2 * Q` is one variable-time Shamir pass over
 * width-5 NAFs (`p256DoubleMultPublic`), not two constant-time
 * multiplications: its time follows `u1` and `u2`, which the signature and
 * digest already disclose.
 *
 * ECDSA is malleable, and so is this: when `(r, s)` verifies, `(r, n - s)`
 * verifies too, as FIPS 186-4 and SEC 1 have it. Nothing here asks for the
 * lower `s`, so a protocol that needs one signature per message and key (a
 * signature used as an identifier, say) has to refuse the upper half itself.
 *
 * @param pub The signer's 65-byte uncompressed public key.
 * @param digest The message's hash; only its leftmost 256 bits count.
 * @param sig The 64-byte signature `r || s`.
 * @returns `true` when the signature is valid, `false` for anything else.
 */
export const p256Verify = (pub: u8[], digest: u8[], sig: u8[]): boolean => {
  if (toI32(sig.length) !== 64) {
    return false
  }
  const q: P256ProjectivePoint | null = p256DecodePoint(pub)
  if (q === null) {
    return false
  }
  const rBytes: u8[] = new Array<u8>(32)
  const sBytes: u8[] = new Array<u8>(32)
  for (let i: i32 = 0; i < 32; i++) {
    rBytes[i] = sig[i]
    sBytes[i] = sig[i + 32]
  }
  if (!p256ScalarInRange(rBytes) || !p256ScalarInRange(sBytes)) {
    return false
  }
  const n: u32[] = p256Order()
  const r2: u32[] = p256ScalarR2()
  const r: u32[] = p256Limbs()
  const w: u32[] = p256Limbs()
  const z: u32[] = p256Limbs()
  p256LimbsFromBytes(r, rBytes, 0)
  p256LimbsFromBytes(w, sBytes, 0)
  p256DigestScalar(z, digest)
  // w = s^-1 in the Montgomery domain; u1 = z w and u2 = r w multiply a
  // plain value by it, so they come out plain.
  p256FiatScalarMul(w, w, r2)
  p256ScalarInverse(w, w)
  const u1: u32[] = p256Limbs()
  const u2: u32[] = p256Limbs()
  p256FiatScalarMul(u1, z, w)
  p256FiatScalarMul(u2, r, w)
  const u1Bytes: u8[] = new Array<u8>(32)
  const u2Bytes: u8[] = new Array<u8>(32)
  p256LimbsToBytes(u1Bytes, 0, u1)
  p256LimbsToBytes(u2Bytes, 0, u2)

  const scratch = new P256PointScratch()
  const sum = new P256ProjectivePoint()
  p256DoubleMultPublic(sum, u1Bytes, u2Bytes, q, scratch)
  if (p256FiatNonzero(sum.z) === 0) {
    return false
  }
  const x: u32[] = p256Limbs()
  p256AffineX(x, sum)
  p256ReduceOnce(x, x, n)
  const vBytes: u8[] = new Array<u8>(32)
  p256LimbsToBytes(vBytes, 0, x)
  return timingSafeEqual(vBytes, rBytes)
}

/**
 * `p256Sign` of the SHA-256 of `msg`: ECDSA with SHA-256 over the whole message.
 *
 * @param priv The private key, 32 big-endian bytes.
 * @param msg The whole message, hashed here.
 * @returns The 64-byte signature `r || s`, or `null` for a refused key.
 */
export const p256SignSha256 = (priv: Secret<u8[]>, msg: u8[]): u8[] | null => p256Sign(priv, sha256(msg))

/**
 * `p256Verify` of the SHA-256 of `msg`.
 *
 * @param pub The signer's 65-byte uncompressed public key.
 * @param msg The whole message, hashed here.
 * @param sig The 64-byte signature `r || s`.
 * @returns `true` when the signature is valid, `false` for anything else.
 */
export const p256VerifySha256 = (pub: u8[], msg: u8[], sig: u8[]): boolean =>
  p256Verify(pub, sha256(msg), sig)

// ---- Signing over caller-owned scratch --------------------------------------
//
// `p256SignSha256` makes its points, its point scratch and RFC 6979's hashers
// with `new`, which stores fresh arrays into their fields, so it stores
// allocations of its own: no automatic arena scope and no `using a = arena()`
// block may release around it (docs/LANGUAGE.md, "`using a = arena()`",
// NL2424), and every signature keeps what it made. `P256SignScratch` holds all
// of that, made once, and `p256SignSha256Into` signs in it and writes `r || s`
// into the caller's array, inside an arena block of its own: a signature keeps
// nothing, and it is byte for byte `p256SignSha256`'s, because RFC 6979 is
// deterministic.
//
// The private key is still read only inside `expose` / `exposeWith`, and a
// function `exposeWith` runs may not write the argument it is handed (NL2450),
// so the three steps that read the key — the range check, RFC 6979 §3.2 steps
// d and f, and `s = k^-1 (z + r d)` — compute on fresh arrays, wipe them, and
// answer a value the caller copies into the scratch. That is why the hashing
// below is SHA-256 written out over plain arrays (FIPS 180-4) rather than
// `Sha256` or `HmacSha256Scratch`: a hasher is an object whose state a step
// inside `expose` would have to write. Everything else — the message hash,
// steps e, g and h, the nonce's multiple of G and its inverse — runs on the
// scratch outside `expose`, on values derived from the key but not the key.

/** The shift of a word's top byte, typed for `--number-mode f64`. */
const P256_WORD_TOP: i32 = 24

/** RFC 6979 §3.2 steps d and f hash `V || sep || x || h1`: 32 + 1 + 32 + 32 bytes. */
const P256_NONCE_MESSAGE: i32 = 97

/** ROTR^n(x) of FIPS 180-4 §3.2, `0 < n < 32`. */
const p256Rotr = (x: u32, n: u32): u32 => (x >>> n) | (x << (32 - n))

/** The big-endian word at `buf[at .. at + 4)`; the caller has checked the window. */
const p256LoadWord = (buf: u8[], at: i32): u32 =>
  (toU32(buf[at]) << 24) | (toU32(buf[at + 1]) << 16) | (toU32(buf[at + 2]) << 8) | toU32(buf[at + 3])

/**
 * FIPS 180-4 §6.2.2 steps 1 to 4 for the block at `src[at .. at + 64)`, folded
 * into the hash value `h` (8 words) with the schedule `w` (64 words) and the
 * round constants `kt` (§4.2.2, 64 words), all the caller's.
 */
const p256ShaCompress = (h: u32[], w: u32[], kt: u32[], src: u8[], at: i32): void => {
  if (
    toI32(h.length) >= 8 &&
    toI32(w.length) >= 64 &&
    toI32(kt.length) >= 64 &&
    at >= 0 &&
    at <= toI32(src.length) - SHA256_BLOCK
  ) {
    for (let t: i32 = 0; t < 16; t++) {
      w[t] = p256LoadWord(src, at + 4 * t)
    }
    for (let t: i32 = 16; t < 64; t++) {
      const w2: u32 = w[t - 2]
      const w15: u32 = w[t - 15]
      const sigma1: u32 = p256Rotr(w2, 17) ^ p256Rotr(w2, 19) ^ (w2 >>> 10)
      const sigma0: u32 = p256Rotr(w15, 7) ^ p256Rotr(w15, 18) ^ (w15 >>> 3)
      w[t] = sigma1 + w[t - 7] + sigma0 + w[t - 16]
    }
    let a: u32 = h[0]
    let b: u32 = h[1]
    let c: u32 = h[2]
    let d: u32 = h[3]
    let e: u32 = h[4]
    let f: u32 = h[5]
    let g: u32 = h[6]
    let hh: u32 = h[7]
    for (let t: i32 = 0; t < 64; t++) {
      const bigSigma1: u32 = p256Rotr(e, 6) ^ p256Rotr(e, 11) ^ p256Rotr(e, 25)
      const choose: u32 = (e & f) ^ (~e & g)
      const t1: u32 = hh + bigSigma1 + choose + kt[t] + w[t]
      const bigSigma0: u32 = p256Rotr(a, 2) ^ p256Rotr(a, 13) ^ p256Rotr(a, 22)
      const majority: u32 = (a & b) ^ (a & c) ^ (b & c)
      hh = g
      g = f
      f = e
      e = d + t1
      d = c
      c = b
      b = a
      a = t1 + bigSigma0 + majority
    }
    h[0] += a
    h[1] += b
    h[2] += c
    h[3] += d
    h[4] += e
    h[5] += f
    h[6] += g
    h[7] += hh
  }
}

/**
 * The SHA-256 of `data[off .. off + len)` into `out[at .. at + 32)`, on the
 * caller's hash value `h`, schedule `w` and `tail` (128 bytes, where the last
 * part block is padded as §5.1.1 says). Whole blocks are compressed where
 * they lie, so the message is never copied. `out` may be `data`: the digest is
 * written once every byte has been read. The caller has checked both windows.
 */
const p256ShaInto = (
  out: u8[],
  at: i32,
  data: u8[],
  off: i32,
  len: i32,
  kt: u32[],
  h: u32[],
  w: u32[],
  tail: u8[]
): void => {
  p256SetLimbs(
    h,
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19
  )
  let from: i32 = off
  while (len - (from - off) >= SHA256_BLOCK) {
    p256ShaCompress(h, w, kt, data, from)
    from = from + SHA256_BLOCK
  }
  const rest: i32 = len - (from - off)
  const tailLength: i32 = toI32(tail.length)
  const dataLength: i32 = toI32(data.length)
  for (let i: i32 = 0; i < tailLength; i++) {
    tail[i] = 0
  }
  for (let i: i32 = 0; i < rest && i < tailLength && from + i >= 0 && from + i < dataLength; i++) {
    tail[i] = data[from + i]
  }
  if (rest >= 0 && rest < tailLength) {
    tail[rest] = 0x80
  }
  const end: i32 = rest < SHA256_BLOCK - 8 ? SHA256_BLOCK : 2 * SHA256_BLOCK
  const bits: u64 = toU64(len) << 3
  for (let i: i32 = 0; i < 8; i++) {
    const j: i32 = end - 1 - i
    if (j >= 0 && j < tailLength) {
      tail[j] = toU8(bits >>> toU64(8 * i))
    }
  }
  p256ShaCompress(h, w, kt, tail, 0)
  if (end > SHA256_BLOCK) {
    p256ShaCompress(h, w, kt, tail, SHA256_BLOCK)
  }
  const outLength: i32 = toI32(out.length)
  for (let i: i32 = 0; i < 8 && i < toI32(h.length); i++) {
    const word: u32 = h[i]
    for (let b: i32 = 0; b < 4; b++) {
      const j: i32 = at + 4 * i + b
      if (j >= 0 && j < outLength) {
        out[j] = toU8(word >>> toU32(P256_WORD_TOP - 8 * b))
      }
    }
  }
}

/**
 * HMAC-SHA-256 (RFC 2104) keyed by the 32-byte `key` over `message[0 .. len)`,
 * into `out[0 .. 32)`: the inner hash of `K XOR ipad || message` in `block`,
 * its digest put where the outer hash of `K XOR opad || inner` reads it. `out`
 * may be `key` or `message`, which are read first. Every work array the key
 * reached — `block`, `h`, `w` and `tail` — is wiped before it returns (ECC-2).
 */
const p256HmacInto = (
  out: u8[],
  key: u8[],
  message: u8[],
  len: i32,
  kt: u32[],
  h: u32[],
  w: u32[],
  tail: u8[],
  block: u8[]
): void => {
  const blockLength: i32 = toI32(block.length)
  const keyLength: i32 = toI32(key.length)
  const messageLength: i32 = toI32(message.length)
  if (blockLength < SHA256_BLOCK + len || keyLength > SHA256_BLOCK || len > messageLength) {
    panic("p256HmacInto: a key, message or block outside its bounds")
  }
  for (let i: i32 = 0; i < SHA256_BLOCK && i < blockLength; i++) {
    block[i] = i < keyLength ? key[i] ^ 0x36 : 0x36
  }
  for (let i: i32 = 0; i < len && i < messageLength && SHA256_BLOCK + i < blockLength; i++) {
    block[SHA256_BLOCK + i] = message[i]
  }
  p256ShaInto(block, SHA256_BLOCK, block, P256_FROM, SHA256_BLOCK + len, kt, h, w, tail)
  for (let i: i32 = 0; i < SHA256_BLOCK && i < blockLength; i++) {
    block[i] = i < keyLength ? key[i] ^ 0x5c : 0x5c
  }
  p256ShaInto(out, P256_FROM, block, P256_FROM, SHA256_BLOCK + SHA256_SIZE, kt, h, w, tail)
  wipe(block)
  wipe(h)
  wipe(w)
  wipe(tail)
}

/** `out[0 .. n) = from[0 .. n)`. */
const p256CopyBytes = (out: u8[], from: u8[], n: i32): void => {
  for (let i: i32 = 0; i < n && i < toI32(out.length) && i < toI32(from.length); i++) {
    out[i] = from[i]
  }
}

/** Whether `[at, at + len)` is a window inside an array of `length` elements. */
const p256WindowFits = (length: i32, at: i32, len: i32): boolean => at >= 0 && len >= 0 && at <= length - len

/**
 * Everything `p256SignSha256Into` signs in, made once and reused: RFC 6979's
 * `K` and `V`, the hashing's work arrays and round constants, the nonce's
 * multiple of G with the comb table and point scratch, and the scalars of
 * the signature. One per signer, not per connection: signing is synchronous,
 * and every secret it held is wiped before `p256SignSha256Into` returns.
 *
 *     const scratch = new P256SignScratch();            // once, outside the loop
 *     const sig: u8[] = new Array<u8>(P256_SIGNATURE_SIZE);
 *     const ok: boolean = p256SignSha256Into(scratch, priv, msg, 0, msg.length, sig, 0);
 */
export class P256SignScratch {
  /**
   * FIPS 180-4 §4.2.2's round constants.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  kt: u32[]
  /**
   * A SHA-256 hash value.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  hash: u32[]
  /**
   * A SHA-256 message schedule.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  schedule: u32[]
  /**
   * A SHA-256 message's padded tail.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  tail: u8[]
  /**
   * An HMAC key block and the message after it.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  block: u8[]
  /**
   * `V || sep`, where every key update's message starts (RFC 6979 §3.2 steps d, f and h.3).
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  message: u8[]
  /**
   * RFC 6979's `K`.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  k: u8[]
  /**
   * RFC 6979's `V`; the last `V` is the nonce.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  v: u8[]
  /**
   * The message's digest, then int2octets of it mod n: RFC 6979's `h1`.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  h1: u8[]
  /**
   * The digest mod n.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  z: u32[]
  /**
   * The signature's `r`.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  r: u32[]
  /**
   * The nonce point's affine x.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  x: u32[]
  /**
   * The nonce `k`, then `k^-1`, in the Montgomery domain.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  kM: u32[]
  /**
   * The order n.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  n: u32[]
  /**
   * R^2 mod n.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  r2: u32[]
  /**
   * The nonce's multiple of G.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  point: P256ProjectivePoint
  /**
   * The comb table of G, built by the first signature and empty until then,
   * so a server that holds a signer does not carry its 22 KiB before its first
   * handshake.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  table: u32[]
  /**
   * The point arithmetic's scratch.
   *
   * @internal Read and written by `p256SignSha256Into` and its steps alone.
   */
  points: P256PointScratch

  /**
   * Makes the arrays every signature reuses, the round constants and the
   * base point's comb table included, so the base-point multiplication works
   * in them; what `p256SignSha256Into` still allocates per call is released
   * when its arena block ends, so nothing is kept.
   */
  constructor() {
    this.kt = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ]
    this.hash = p256Limbs()
    this.schedule = new Array<u32>(64)
    this.tail = new Array<u8>(2 * SHA256_BLOCK)
    this.block = new Array<u8>(SHA256_BLOCK + P256_NONCE_MESSAGE)
    this.message = new Array<u8>(SHA256_SIZE + 1)
    this.k = new Array<u8>(SHA256_SIZE)
    this.v = new Array<u8>(SHA256_SIZE)
    this.h1 = new Array<u8>(SHA256_SIZE)
    this.z = p256Limbs()
    this.r = p256Limbs()
    this.x = p256Limbs()
    this.kM = p256Limbs()
    this.n = p256Order()
    this.r2 = p256ScalarR2()
    this.point = new P256ProjectivePoint()
    this.table = new Array<u32>(0)
    this.points = new P256PointScratch()
  }
}

/** `out = HMAC_K(message[0 .. len))` with the scratch's `K` and work arrays. */
const p256SignMac = (sc: P256SignScratch, out: u8[], message: u8[], len: i32): void =>
  p256HmacInto(out, sc.k, message, len, sc.kt, sc.hash, sc.schedule, sc.tail, sc.block)

/**
 * HMAC_K(V || sep || x || h1) for RFC 6979 §3.2 steps d and f, on the plain
 * key `x`, for `exposeWith` to run: `V || sep` is the scratch's `message`,
 * which is only read, as the rest of the scratch is; the message and the
 * hashing's work arrays are fresh and wiped, and the new `K` is the answer.
 */
const p256NonceKeyExposed = (priv: u8[], sc: P256SignScratch): u8[] => {
  const message: u8[] = new Array<u8>(P256_NONCE_MESSAGE)
  p256CopyBytes(message, sc.message, SHA256_SIZE + 1)
  for (let i: i32 = 0; i < SHA256_SIZE && i < toI32(priv.length) && i < toI32(sc.h1.length); i++) {
    const j: i32 = SHA256_SIZE + 1 + i
    const l: i32 = j + SHA256_SIZE
    if (j >= 0 && l >= 0 && j < toI32(message.length) && l < toI32(message.length)) {
      message[j] = priv[i]
      message[l] = sc.h1[i]
    }
  }
  const key: u8[] = new Array<u8>(SHA256_SIZE)
  p256HmacInto(
    key,
    sc.k,
    message,
    P256_NONCE_MESSAGE,
    sc.kt,
    p256Limbs(),
    new Array<u32>(64),
    new Array<u8>(2 * SHA256_BLOCK),
    new Array<u8>(SHA256_BLOCK + P256_NONCE_MESSAGE)
  )
  wipe(message)
  return key
}

/**
 * `s = k^-1 (z + r d) mod n` on the plain key `d`, for `exposeWith` to run,
 * with `p256SignScalar`'s arithmetic: `d` taken into the Montgomery domain,
 * multiplied by the plain `r`, `z` added, and the sum multiplied by `k^-1`,
 * which is in the Montgomery domain, so `s` comes out plain. The key's limbs
 * are wiped; `s` is half of the signature, and public.
 */
const p256SignSExposed = (priv: u8[], sc: P256SignScratch): u32[] => {
  const dM: u32[] = p256Limbs()
  p256LimbsFromBytes(dM, priv, 0)
  p256FiatScalarMul(dM, dM, sc.r2)
  const s: u32[] = p256Limbs()
  p256FiatScalarMul(s, sc.r, dM)
  p256FiatScalarAdd(s, s, sc.z)
  p256FiatScalarMul(s, s, sc.kM)
  wipe(dM)
  return s
}

/** `sc.message = V || sep`, the start of every key update's message (RFC 6979 §3.2 steps d, f and h.3). */
const p256NonceSeparated = (sc: P256SignScratch, sep: u8): void => {
  p256CopyBytes(sc.message, sc.v, SHA256_SIZE)
  sc.message[SHA256_SIZE] = sep
}

/** Steps d and f: `K` replaced by what the exposed step answers, which is wiped once copied. */
const p256SignNonceKey = (sc: P256SignScratch, priv: Secret<u8[]>, sep: u8): void => {
  p256NonceSeparated(sc, sep)
  const next: u8[] = exposeWith(priv, sc, p256NonceKeyExposed)
  p256CopyBytes(sc.k, next, SHA256_SIZE)
  wipe(next)
}

/** Zero every secret the scratch held: `K`, `V`, `k^-1`, the nonce point and its scratch (ECC-2). */
const p256WipeSignScratch = (sc: P256SignScratch): void => {
  wipe(sc.k)
  wipe(sc.v)
  wipe(sc.message)
  wipe(sc.kM)
  p256WipePoint(sc.point)
  p256WipeScratch(sc.points)
}

/**
 * `p256SignSha256` of `msg[off .. off + len)` in `scratch`, written as `r || s`
 * at `out[at .. at + 64)`: the same 64 bytes `p256SignSha256` answers for the
 * same key and message. Answers `false`, writing nothing, for a private key
 * `p256PublicKey` would refuse. A message or signature window outside its
 * array panics before anything is read.
 *
 * It runs inside an arena block of its own and stores nothing, so a signature
 * leaves the arena where it was; every secret the scratch held — RFC 6979's
 * `K` and `V`, the nonce's inverse, its point and the point scratch — is wiped
 * before it returns, as are the fresh arrays the key's own steps worked in.
 *
 * @param sc The scratch to sign in, one per signer.
 * @param priv The private key, 32 big-endian bytes.
 * @param msg The array holding the message.
 * @param off Where the message starts in `msg`.
 * @param len The message's length in bytes.
 * @param out The array the signature is written into.
 * @param at Where the 64 bytes start in `out`.
 * @returns `true` once the signature is written, `false` for a refused key.
 */
export const p256SignSha256Into = (
  sc: P256SignScratch,
  priv: Secret<u8[]>,
  msg: u8[],
  off: i32,
  len: i32,
  out: u8[],
  at: i32
): boolean => {
  if (!p256WindowFits(toI32(msg.length), off, len)) {
    panic("p256SignSha256Into: the message window is outside its array")
  }
  if (!p256WindowFits(toI32(out.length), at, P256_SIGNATURE_SIZE)) {
    panic("p256SignSha256Into: the signature window is outside its array")
  }
  // Whether the table is built yet is public: it is the first signature or not. It
  // is built before the arena opens, so it outlives this call.
  if (toI32(sc.table.length) === 0) {
    sc.table = p256BaseTable()
  }
  using _scope = arena()
  if (!expose(priv, p256ScalarInRange)) {
    return false
  }
  p256ShaInto(sc.h1, P256_FROM, msg, off, len, sc.kt, sc.hash, sc.schedule, sc.tail)
  p256DigestScalar(sc.z, sc.h1)
  p256LimbsToBytes(sc.h1, 0, sc.z)
  for (let i: i32 = 0; i < SHA256_SIZE && i < toI32(sc.v.length) && i < toI32(sc.k.length); i++) {
    sc.v[i] = 1
    sc.k[i] = 0
  }
  p256SignNonceKey(sc, priv, 0) // step d
  p256SignMac(sc, sc.v, sc.v, SHA256_SIZE) // step e
  p256SignNonceKey(sc, priv, 1) // step f
  p256SignMac(sc, sc.v, sc.v, SHA256_SIZE) // step g
  while (true) {
    p256SignMac(sc, sc.v, sc.v, SHA256_SIZE) // step h.2
    if (p256ScalarInRange(sc.v)) {
      p256BaseMultWith(sc.point, sc.v, sc.points, sc.table)
      p256AffineX(sc.x, sc.point)
      p256ReduceOnce(sc.r, sc.x, sc.n)
      p256LimbsFromBytes(sc.kM, sc.v, 0)
      p256FiatScalarMul(sc.kM, sc.kM, sc.r2)
      p256ScalarInverse(sc.kM, sc.kM)
      const s: u32[] = exposeWith(priv, sc, p256SignSExposed)
      if (p256FiatNonzero(sc.r) !== 0 && p256FiatNonzero(s) !== 0) {
        p256LimbsToBytes(out, at, sc.r)
        p256LimbsToBytes(out, at + 32, s)
        p256WipeSignScratch(sc)
        return true
      }
    }
    // step h.3: K = HMAC_K(V || 0x00), then V = HMAC_K(V).
    p256NonceSeparated(sc, 0)
    p256SignMac(sc, sc.k, sc.message, SHA256_SIZE + 1)
    p256SignMac(sc, sc.v, sc.v, SHA256_SIZE)
  }
}
