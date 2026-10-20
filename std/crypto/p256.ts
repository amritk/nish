/**
 * `nish/crypto/p256` — ECDSA over NIST P-256 (secp256r1), with the
 * deterministic nonces of RFC 6979.
 *
 *     import { p256PublicKey, p256SignSha256, p256VerifySha256 } from "nish/crypto/p256";
 *
 *     const priv: Secret<u8[]> = secret(readKey());              // nish:secret
 *     const pub: u8[] | null = p256PublicKey(priv);             // 65 bytes, 0x04 || X || Y
 *     const sig: u8[] | null = p256SignSha256(priv, message);   // 64 bytes, r || s
 *     wipe(priv);
 *     const ok: boolean = p256VerifySha256(pub, message, sig);
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
 * `u32` limbs with `u64` products — `mul`, `square`, `add`, `sub`,
 * `selectznz`, `nonzero` and `set_one` mod p, and `mul`, `add` and `set_one`
 * mod n — statement for statement, with fiat's variable names. Three things
 * change in the translation and nothing else does. C's out-pointers become a
 * `u64` answer: each of fiat's `addcarryx`, `subborrowx` and `mulx` helpers
 * here answers its two outputs packed, the first in the low 32 bits and the
 * second above them, and the caller splits them, declaring only the halves
 * fiat goes on to read. And each function opens with
 * a length guard, so that the literal indices after it compile with no bounds
 * check. And `square` reads its input's eight limbs into locals first, which
 * changes no arithmetic; it kept the input's pointer from being spilled in a
 * way the aarch64 disassembly check once misread (#334). The
 * scalar functions use the field's four helpers, which fiat generates
 * identically for both. The nonce's inverse, `p256ScalarInverse`, is
 * libsecp256k1's 32-bit safegcd (`modinv32`), function for function; the
 * section that holds it says what changes. Everything else in this file — the
 * curve, the encodings, the other inversions and ECDSA — is written for this
 * module from the documents it names.
 *
 * **The curve** is `y^2 = x^3 - 3x + b` over GF(p), p = 2^256 - 2^224 + 2^192
 * + 2^96 - 1, with the base point G and its order n from SEC 2 §2.4.2 (FIPS
 * 186-4 §D.1.2.3). Points are projective (X : Y : Z), Z = 0 the identity, and
 * are added and doubled with the complete formulas of J. Renes, C. Costello and
 * L. Batina, "Complete addition formulas for prime order elliptic curves"
 * (EUROCRYPT 2016), Algorithms 4 and 6 for a = -3. Complete means no input is
 * exceptional: P + P, P + (-P) and P + O all come out of the same straight line
 * of field operations, so there is no case to branch on.
 *
 * **Constant time where a secret is involved.** A private key and a nonce are
 * only ever multiplied by G, and that by `p256BaseMult`, a comb over a
 * precomputed table: 4 teeth 64 bits apart, 16 sub-tables of the 15 non-zero
 * sums of a tooth's multiples of G, one per 4-bit offset, as affine points in
 * the Montgomery domain (`p256BaseTable`, 15 KiB, written by
 * `scripts/gen-p256-table.mjs`). Four rows of 16 mixed additions with a
 * doubling between rows replace the 256 doublings and 64 additions of a
 * window, whatever the scalar. Each addition reads all fifteen entries of its
 * sub-table and keeps one with fiat's conditional move, steered by `ctEq` on
 * the digit; a zero digit keeps none, and the sum is then discarded by the
 * same conditional move rather than skipped, so neither a branch nor an
 * address depends on the scalar. `p256ScalarMult`, a fixed 4-bit window over
 * sixteen multiples of a point, is what verification multiplies G and the
 * received key by, and the reference the comb is held to bit for bit
 * (`tests/link/crypto_p256_agree`). The signer inverts the nonce by
 * Bernstein and Yang's safegcd, `p256ScalarInverse`: twenty batches of thirty
 * divsteps, each a fixed run of masks and adds, whatever the scalar, so its
 * loops count constants and no branch or address follows the nonce; Fermat's
 * `p256ScalarInvert` is the reference it is held to bit for bit
 * (`tests/link/crypto_p256_inverse`) and what verification still uses. The
 * other inversions raise to the public exponents p - 2 and n - 2, so their
 * branches follow a constant. The
 * branches that remain are on public facts: a length, a limb or bit position,
 * whether a received key or signature is in range, and — once in about 2^32
 * signatures — RFC 6979's retry when a candidate nonce is not below n.
 *
 * **What is verified by disassembly and what is discipline.**
 * `tests/cases/ct_asm_p256` holds copies of fiat's field multiply, square, add
 * and subtract, its scalar multiply and its conditional move, the table read
 * by a secret digit, the complete doubling and addition, one window step of
 * `p256ScalarMult`, the comb's digit, entry read, mixed addition,
 * conditional keep and one whole comb step, and safegcd's thirty divsteps and
 * its two matrix updates, to the check of
 * `tests/ct-asm.js`, which refuses any branch, call it cannot follow or
 * secret-indexed access in them on x86-64 and aarch64, following each call
 * into the field functions. The copies of the point functions take coordinate
 * arrays rather than points, the table reads' loops are written out there and
 * their offsets computed with wrapping arithmetic, as that fixture's header
 * says; its `main` runs RFC 6979 A.2.5 through them, by the window and by the
 * comb, and three inverses through the safegcd copies. The 64-window and 4-row
 * loops, the table build, the inversions (safegcd's twenty-batch loop, its
 * conversions, normalisation and limb loops among them), the encodings and the
 * nonce derivation are constant time by construction rather than by that
 * proof.
 *
 * Verification multiplies only public values, by `p256ScalarMult` alone.
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
import { Secret, expose, exposeWith, wipe } from "nish:secret"
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

/** fiat's `fiat_p256_mul`: multiplies two field elements in the Montgomery domain. */
const p256FiatMul = (out1: u32[], arg1: u32[], arg2: u32[]): void => {
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
  const w40: u64 = p256FiatMulxU32(x23, 0xffffffff)
  const x40: u32 = toU32(w40)
  const x41: u32 = toU32(w40 >> 32)
  const w42: u64 = p256FiatMulxU32(x23, 0xffffffff)
  const x42: u32 = toU32(w42)
  const x43: u32 = toU32(w42 >> 32)
  const w44: u64 = p256FiatMulxU32(x23, 0xffffffff)
  const x44: u32 = toU32(w44)
  const x45: u32 = toU32(w44 >> 32)
  const w46: u64 = p256FiatMulxU32(x23, 0xffffffff)
  const x46: u32 = toU32(w46)
  const x47: u32 = toU32(w46 >> 32)
  const w48: u64 = p256FiatAddcarryxU32(0x0, x47, x44)
  const x48: u32 = toU32(w48)
  const x49: u32 = toU32(w48 >> 32)
  const w50: u64 = p256FiatAddcarryxU32(x49, x45, x42)
  const x50: u32 = toU32(w50)
  const x51: u32 = toU32(w50 >> 32)
  const x52: u32 = x51 + x43
  const w53: u64 = p256FiatAddcarryxU32(0x0, x23, x46)
  const x54: u32 = toU32(w53 >> 32)
  const w55: u64 = p256FiatAddcarryxU32(x54, x25, x48)
  const x55: u32 = toU32(w55)
  const x56: u32 = toU32(w55 >> 32)
  const w57: u64 = p256FiatAddcarryxU32(x56, x27, x50)
  const x57: u32 = toU32(w57)
  const x58: u32 = toU32(w57 >> 32)
  const w59: u64 = p256FiatAddcarryxU32(x58, x29, x52)
  const x59: u32 = toU32(w59)
  const x60: u32 = toU32(w59 >> 32)
  const w61: u64 = p256FiatAddcarryxU32(x60, x31, 0x0)
  const x61: u32 = toU32(w61)
  const x62: u32 = toU32(w61 >> 32)
  const w63: u64 = p256FiatAddcarryxU32(x62, x33, 0x0)
  const x63: u32 = toU32(w63)
  const x64: u32 = toU32(w63 >> 32)
  const w65: u64 = p256FiatAddcarryxU32(x64, x35, x23)
  const x65: u32 = toU32(w65)
  const x66: u32 = toU32(w65 >> 32)
  const w67: u64 = p256FiatAddcarryxU32(x66, x37, x40)
  const x67: u32 = toU32(w67)
  const x68: u32 = toU32(w67 >> 32)
  const w69: u64 = p256FiatAddcarryxU32(x68, x39, x41)
  const x69: u32 = toU32(w69)
  const x70: u32 = toU32(w69 >> 32)
  const w71: u64 = p256FiatMulxU32(x1, arg2[7])
  const x71: u32 = toU32(w71)
  const x72: u32 = toU32(w71 >> 32)
  const w73: u64 = p256FiatMulxU32(x1, arg2[6])
  const x73: u32 = toU32(w73)
  const x74: u32 = toU32(w73 >> 32)
  const w75: u64 = p256FiatMulxU32(x1, arg2[5])
  const x75: u32 = toU32(w75)
  const x76: u32 = toU32(w75 >> 32)
  const w77: u64 = p256FiatMulxU32(x1, arg2[4])
  const x77: u32 = toU32(w77)
  const x78: u32 = toU32(w77 >> 32)
  const w79: u64 = p256FiatMulxU32(x1, arg2[3])
  const x79: u32 = toU32(w79)
  const x80: u32 = toU32(w79 >> 32)
  const w81: u64 = p256FiatMulxU32(x1, arg2[2])
  const x81: u32 = toU32(w81)
  const x82: u32 = toU32(w81 >> 32)
  const w83: u64 = p256FiatMulxU32(x1, arg2[1])
  const x83: u32 = toU32(w83)
  const x84: u32 = toU32(w83 >> 32)
  const w85: u64 = p256FiatMulxU32(x1, arg2[0])
  const x85: u32 = toU32(w85)
  const x86: u32 = toU32(w85 >> 32)
  const w87: u64 = p256FiatAddcarryxU32(0x0, x86, x83)
  const x87: u32 = toU32(w87)
  const x88: u32 = toU32(w87 >> 32)
  const w89: u64 = p256FiatAddcarryxU32(x88, x84, x81)
  const x89: u32 = toU32(w89)
  const x90: u32 = toU32(w89 >> 32)
  const w91: u64 = p256FiatAddcarryxU32(x90, x82, x79)
  const x91: u32 = toU32(w91)
  const x92: u32 = toU32(w91 >> 32)
  const w93: u64 = p256FiatAddcarryxU32(x92, x80, x77)
  const x93: u32 = toU32(w93)
  const x94: u32 = toU32(w93 >> 32)
  const w95: u64 = p256FiatAddcarryxU32(x94, x78, x75)
  const x95: u32 = toU32(w95)
  const x96: u32 = toU32(w95 >> 32)
  const w97: u64 = p256FiatAddcarryxU32(x96, x76, x73)
  const x97: u32 = toU32(w97)
  const x98: u32 = toU32(w97 >> 32)
  const w99: u64 = p256FiatAddcarryxU32(x98, x74, x71)
  const x99: u32 = toU32(w99)
  const x100: u32 = toU32(w99 >> 32)
  const x101: u32 = x100 + x72
  const w102: u64 = p256FiatAddcarryxU32(0x0, x55, x85)
  const x102: u32 = toU32(w102)
  const x103: u32 = toU32(w102 >> 32)
  const w104: u64 = p256FiatAddcarryxU32(x103, x57, x87)
  const x104: u32 = toU32(w104)
  const x105: u32 = toU32(w104 >> 32)
  const w106: u64 = p256FiatAddcarryxU32(x105, x59, x89)
  const x106: u32 = toU32(w106)
  const x107: u32 = toU32(w106 >> 32)
  const w108: u64 = p256FiatAddcarryxU32(x107, x61, x91)
  const x108: u32 = toU32(w108)
  const x109: u32 = toU32(w108 >> 32)
  const w110: u64 = p256FiatAddcarryxU32(x109, x63, x93)
  const x110: u32 = toU32(w110)
  const x111: u32 = toU32(w110 >> 32)
  const w112: u64 = p256FiatAddcarryxU32(x111, x65, x95)
  const x112: u32 = toU32(w112)
  const x113: u32 = toU32(w112 >> 32)
  const w114: u64 = p256FiatAddcarryxU32(x113, x67, x97)
  const x114: u32 = toU32(w114)
  const x115: u32 = toU32(w114 >> 32)
  const w116: u64 = p256FiatAddcarryxU32(x115, x69, x99)
  const x116: u32 = toU32(w116)
  const x117: u32 = toU32(w116 >> 32)
  const w118: u64 = p256FiatAddcarryxU32(x117, x70, x101)
  const x118: u32 = toU32(w118)
  const x119: u32 = toU32(w118 >> 32)
  const w120: u64 = p256FiatMulxU32(x102, 0xffffffff)
  const x120: u32 = toU32(w120)
  const x121: u32 = toU32(w120 >> 32)
  const w122: u64 = p256FiatMulxU32(x102, 0xffffffff)
  const x122: u32 = toU32(w122)
  const x123: u32 = toU32(w122 >> 32)
  const w124: u64 = p256FiatMulxU32(x102, 0xffffffff)
  const x124: u32 = toU32(w124)
  const x125: u32 = toU32(w124 >> 32)
  const w126: u64 = p256FiatMulxU32(x102, 0xffffffff)
  const x126: u32 = toU32(w126)
  const x127: u32 = toU32(w126 >> 32)
  const w128: u64 = p256FiatAddcarryxU32(0x0, x127, x124)
  const x128: u32 = toU32(w128)
  const x129: u32 = toU32(w128 >> 32)
  const w130: u64 = p256FiatAddcarryxU32(x129, x125, x122)
  const x130: u32 = toU32(w130)
  const x131: u32 = toU32(w130 >> 32)
  const x132: u32 = x131 + x123
  const w133: u64 = p256FiatAddcarryxU32(0x0, x102, x126)
  const x134: u32 = toU32(w133 >> 32)
  const w135: u64 = p256FiatAddcarryxU32(x134, x104, x128)
  const x135: u32 = toU32(w135)
  const x136: u32 = toU32(w135 >> 32)
  const w137: u64 = p256FiatAddcarryxU32(x136, x106, x130)
  const x137: u32 = toU32(w137)
  const x138: u32 = toU32(w137 >> 32)
  const w139: u64 = p256FiatAddcarryxU32(x138, x108, x132)
  const x139: u32 = toU32(w139)
  const x140: u32 = toU32(w139 >> 32)
  const w141: u64 = p256FiatAddcarryxU32(x140, x110, 0x0)
  const x141: u32 = toU32(w141)
  const x142: u32 = toU32(w141 >> 32)
  const w143: u64 = p256FiatAddcarryxU32(x142, x112, 0x0)
  const x143: u32 = toU32(w143)
  const x144: u32 = toU32(w143 >> 32)
  const w145: u64 = p256FiatAddcarryxU32(x144, x114, x102)
  const x145: u32 = toU32(w145)
  const x146: u32 = toU32(w145 >> 32)
  const w147: u64 = p256FiatAddcarryxU32(x146, x116, x120)
  const x147: u32 = toU32(w147)
  const x148: u32 = toU32(w147 >> 32)
  const w149: u64 = p256FiatAddcarryxU32(x148, x118, x121)
  const x149: u32 = toU32(w149)
  const x150: u32 = toU32(w149 >> 32)
  const x151: u32 = x150 + x119
  const w152: u64 = p256FiatMulxU32(x2, arg2[7])
  const x152: u32 = toU32(w152)
  const x153: u32 = toU32(w152 >> 32)
  const w154: u64 = p256FiatMulxU32(x2, arg2[6])
  const x154: u32 = toU32(w154)
  const x155: u32 = toU32(w154 >> 32)
  const w156: u64 = p256FiatMulxU32(x2, arg2[5])
  const x156: u32 = toU32(w156)
  const x157: u32 = toU32(w156 >> 32)
  const w158: u64 = p256FiatMulxU32(x2, arg2[4])
  const x158: u32 = toU32(w158)
  const x159: u32 = toU32(w158 >> 32)
  const w160: u64 = p256FiatMulxU32(x2, arg2[3])
  const x160: u32 = toU32(w160)
  const x161: u32 = toU32(w160 >> 32)
  const w162: u64 = p256FiatMulxU32(x2, arg2[2])
  const x162: u32 = toU32(w162)
  const x163: u32 = toU32(w162 >> 32)
  const w164: u64 = p256FiatMulxU32(x2, arg2[1])
  const x164: u32 = toU32(w164)
  const x165: u32 = toU32(w164 >> 32)
  const w166: u64 = p256FiatMulxU32(x2, arg2[0])
  const x166: u32 = toU32(w166)
  const x167: u32 = toU32(w166 >> 32)
  const w168: u64 = p256FiatAddcarryxU32(0x0, x167, x164)
  const x168: u32 = toU32(w168)
  const x169: u32 = toU32(w168 >> 32)
  const w170: u64 = p256FiatAddcarryxU32(x169, x165, x162)
  const x170: u32 = toU32(w170)
  const x171: u32 = toU32(w170 >> 32)
  const w172: u64 = p256FiatAddcarryxU32(x171, x163, x160)
  const x172: u32 = toU32(w172)
  const x173: u32 = toU32(w172 >> 32)
  const w174: u64 = p256FiatAddcarryxU32(x173, x161, x158)
  const x174: u32 = toU32(w174)
  const x175: u32 = toU32(w174 >> 32)
  const w176: u64 = p256FiatAddcarryxU32(x175, x159, x156)
  const x176: u32 = toU32(w176)
  const x177: u32 = toU32(w176 >> 32)
  const w178: u64 = p256FiatAddcarryxU32(x177, x157, x154)
  const x178: u32 = toU32(w178)
  const x179: u32 = toU32(w178 >> 32)
  const w180: u64 = p256FiatAddcarryxU32(x179, x155, x152)
  const x180: u32 = toU32(w180)
  const x181: u32 = toU32(w180 >> 32)
  const x182: u32 = x181 + x153
  const w183: u64 = p256FiatAddcarryxU32(0x0, x135, x166)
  const x183: u32 = toU32(w183)
  const x184: u32 = toU32(w183 >> 32)
  const w185: u64 = p256FiatAddcarryxU32(x184, x137, x168)
  const x185: u32 = toU32(w185)
  const x186: u32 = toU32(w185 >> 32)
  const w187: u64 = p256FiatAddcarryxU32(x186, x139, x170)
  const x187: u32 = toU32(w187)
  const x188: u32 = toU32(w187 >> 32)
  const w189: u64 = p256FiatAddcarryxU32(x188, x141, x172)
  const x189: u32 = toU32(w189)
  const x190: u32 = toU32(w189 >> 32)
  const w191: u64 = p256FiatAddcarryxU32(x190, x143, x174)
  const x191: u32 = toU32(w191)
  const x192: u32 = toU32(w191 >> 32)
  const w193: u64 = p256FiatAddcarryxU32(x192, x145, x176)
  const x193: u32 = toU32(w193)
  const x194: u32 = toU32(w193 >> 32)
  const w195: u64 = p256FiatAddcarryxU32(x194, x147, x178)
  const x195: u32 = toU32(w195)
  const x196: u32 = toU32(w195 >> 32)
  const w197: u64 = p256FiatAddcarryxU32(x196, x149, x180)
  const x197: u32 = toU32(w197)
  const x198: u32 = toU32(w197 >> 32)
  const w199: u64 = p256FiatAddcarryxU32(x198, x151, x182)
  const x199: u32 = toU32(w199)
  const x200: u32 = toU32(w199 >> 32)
  const w201: u64 = p256FiatMulxU32(x183, 0xffffffff)
  const x201: u32 = toU32(w201)
  const x202: u32 = toU32(w201 >> 32)
  const w203: u64 = p256FiatMulxU32(x183, 0xffffffff)
  const x203: u32 = toU32(w203)
  const x204: u32 = toU32(w203 >> 32)
  const w205: u64 = p256FiatMulxU32(x183, 0xffffffff)
  const x205: u32 = toU32(w205)
  const x206: u32 = toU32(w205 >> 32)
  const w207: u64 = p256FiatMulxU32(x183, 0xffffffff)
  const x207: u32 = toU32(w207)
  const x208: u32 = toU32(w207 >> 32)
  const w209: u64 = p256FiatAddcarryxU32(0x0, x208, x205)
  const x209: u32 = toU32(w209)
  const x210: u32 = toU32(w209 >> 32)
  const w211: u64 = p256FiatAddcarryxU32(x210, x206, x203)
  const x211: u32 = toU32(w211)
  const x212: u32 = toU32(w211 >> 32)
  const x213: u32 = x212 + x204
  const w214: u64 = p256FiatAddcarryxU32(0x0, x183, x207)
  const x215: u32 = toU32(w214 >> 32)
  const w216: u64 = p256FiatAddcarryxU32(x215, x185, x209)
  const x216: u32 = toU32(w216)
  const x217: u32 = toU32(w216 >> 32)
  const w218: u64 = p256FiatAddcarryxU32(x217, x187, x211)
  const x218: u32 = toU32(w218)
  const x219: u32 = toU32(w218 >> 32)
  const w220: u64 = p256FiatAddcarryxU32(x219, x189, x213)
  const x220: u32 = toU32(w220)
  const x221: u32 = toU32(w220 >> 32)
  const w222: u64 = p256FiatAddcarryxU32(x221, x191, 0x0)
  const x222: u32 = toU32(w222)
  const x223: u32 = toU32(w222 >> 32)
  const w224: u64 = p256FiatAddcarryxU32(x223, x193, 0x0)
  const x224: u32 = toU32(w224)
  const x225: u32 = toU32(w224 >> 32)
  const w226: u64 = p256FiatAddcarryxU32(x225, x195, x183)
  const x226: u32 = toU32(w226)
  const x227: u32 = toU32(w226 >> 32)
  const w228: u64 = p256FiatAddcarryxU32(x227, x197, x201)
  const x228: u32 = toU32(w228)
  const x229: u32 = toU32(w228 >> 32)
  const w230: u64 = p256FiatAddcarryxU32(x229, x199, x202)
  const x230: u32 = toU32(w230)
  const x231: u32 = toU32(w230 >> 32)
  const x232: u32 = x231 + x200
  const w233: u64 = p256FiatMulxU32(x3, arg2[7])
  const x233: u32 = toU32(w233)
  const x234: u32 = toU32(w233 >> 32)
  const w235: u64 = p256FiatMulxU32(x3, arg2[6])
  const x235: u32 = toU32(w235)
  const x236: u32 = toU32(w235 >> 32)
  const w237: u64 = p256FiatMulxU32(x3, arg2[5])
  const x237: u32 = toU32(w237)
  const x238: u32 = toU32(w237 >> 32)
  const w239: u64 = p256FiatMulxU32(x3, arg2[4])
  const x239: u32 = toU32(w239)
  const x240: u32 = toU32(w239 >> 32)
  const w241: u64 = p256FiatMulxU32(x3, arg2[3])
  const x241: u32 = toU32(w241)
  const x242: u32 = toU32(w241 >> 32)
  const w243: u64 = p256FiatMulxU32(x3, arg2[2])
  const x243: u32 = toU32(w243)
  const x244: u32 = toU32(w243 >> 32)
  const w245: u64 = p256FiatMulxU32(x3, arg2[1])
  const x245: u32 = toU32(w245)
  const x246: u32 = toU32(w245 >> 32)
  const w247: u64 = p256FiatMulxU32(x3, arg2[0])
  const x247: u32 = toU32(w247)
  const x248: u32 = toU32(w247 >> 32)
  const w249: u64 = p256FiatAddcarryxU32(0x0, x248, x245)
  const x249: u32 = toU32(w249)
  const x250: u32 = toU32(w249 >> 32)
  const w251: u64 = p256FiatAddcarryxU32(x250, x246, x243)
  const x251: u32 = toU32(w251)
  const x252: u32 = toU32(w251 >> 32)
  const w253: u64 = p256FiatAddcarryxU32(x252, x244, x241)
  const x253: u32 = toU32(w253)
  const x254: u32 = toU32(w253 >> 32)
  const w255: u64 = p256FiatAddcarryxU32(x254, x242, x239)
  const x255: u32 = toU32(w255)
  const x256: u32 = toU32(w255 >> 32)
  const w257: u64 = p256FiatAddcarryxU32(x256, x240, x237)
  const x257: u32 = toU32(w257)
  const x258: u32 = toU32(w257 >> 32)
  const w259: u64 = p256FiatAddcarryxU32(x258, x238, x235)
  const x259: u32 = toU32(w259)
  const x260: u32 = toU32(w259 >> 32)
  const w261: u64 = p256FiatAddcarryxU32(x260, x236, x233)
  const x261: u32 = toU32(w261)
  const x262: u32 = toU32(w261 >> 32)
  const x263: u32 = x262 + x234
  const w264: u64 = p256FiatAddcarryxU32(0x0, x216, x247)
  const x264: u32 = toU32(w264)
  const x265: u32 = toU32(w264 >> 32)
  const w266: u64 = p256FiatAddcarryxU32(x265, x218, x249)
  const x266: u32 = toU32(w266)
  const x267: u32 = toU32(w266 >> 32)
  const w268: u64 = p256FiatAddcarryxU32(x267, x220, x251)
  const x268: u32 = toU32(w268)
  const x269: u32 = toU32(w268 >> 32)
  const w270: u64 = p256FiatAddcarryxU32(x269, x222, x253)
  const x270: u32 = toU32(w270)
  const x271: u32 = toU32(w270 >> 32)
  const w272: u64 = p256FiatAddcarryxU32(x271, x224, x255)
  const x272: u32 = toU32(w272)
  const x273: u32 = toU32(w272 >> 32)
  const w274: u64 = p256FiatAddcarryxU32(x273, x226, x257)
  const x274: u32 = toU32(w274)
  const x275: u32 = toU32(w274 >> 32)
  const w276: u64 = p256FiatAddcarryxU32(x275, x228, x259)
  const x276: u32 = toU32(w276)
  const x277: u32 = toU32(w276 >> 32)
  const w278: u64 = p256FiatAddcarryxU32(x277, x230, x261)
  const x278: u32 = toU32(w278)
  const x279: u32 = toU32(w278 >> 32)
  const w280: u64 = p256FiatAddcarryxU32(x279, x232, x263)
  const x280: u32 = toU32(w280)
  const x281: u32 = toU32(w280 >> 32)
  const w282: u64 = p256FiatMulxU32(x264, 0xffffffff)
  const x282: u32 = toU32(w282)
  const x283: u32 = toU32(w282 >> 32)
  const w284: u64 = p256FiatMulxU32(x264, 0xffffffff)
  const x284: u32 = toU32(w284)
  const x285: u32 = toU32(w284 >> 32)
  const w286: u64 = p256FiatMulxU32(x264, 0xffffffff)
  const x286: u32 = toU32(w286)
  const x287: u32 = toU32(w286 >> 32)
  const w288: u64 = p256FiatMulxU32(x264, 0xffffffff)
  const x288: u32 = toU32(w288)
  const x289: u32 = toU32(w288 >> 32)
  const w290: u64 = p256FiatAddcarryxU32(0x0, x289, x286)
  const x290: u32 = toU32(w290)
  const x291: u32 = toU32(w290 >> 32)
  const w292: u64 = p256FiatAddcarryxU32(x291, x287, x284)
  const x292: u32 = toU32(w292)
  const x293: u32 = toU32(w292 >> 32)
  const x294: u32 = x293 + x285
  const w295: u64 = p256FiatAddcarryxU32(0x0, x264, x288)
  const x296: u32 = toU32(w295 >> 32)
  const w297: u64 = p256FiatAddcarryxU32(x296, x266, x290)
  const x297: u32 = toU32(w297)
  const x298: u32 = toU32(w297 >> 32)
  const w299: u64 = p256FiatAddcarryxU32(x298, x268, x292)
  const x299: u32 = toU32(w299)
  const x300: u32 = toU32(w299 >> 32)
  const w301: u64 = p256FiatAddcarryxU32(x300, x270, x294)
  const x301: u32 = toU32(w301)
  const x302: u32 = toU32(w301 >> 32)
  const w303: u64 = p256FiatAddcarryxU32(x302, x272, 0x0)
  const x303: u32 = toU32(w303)
  const x304: u32 = toU32(w303 >> 32)
  const w305: u64 = p256FiatAddcarryxU32(x304, x274, 0x0)
  const x305: u32 = toU32(w305)
  const x306: u32 = toU32(w305 >> 32)
  const w307: u64 = p256FiatAddcarryxU32(x306, x276, x264)
  const x307: u32 = toU32(w307)
  const x308: u32 = toU32(w307 >> 32)
  const w309: u64 = p256FiatAddcarryxU32(x308, x278, x282)
  const x309: u32 = toU32(w309)
  const x310: u32 = toU32(w309 >> 32)
  const w311: u64 = p256FiatAddcarryxU32(x310, x280, x283)
  const x311: u32 = toU32(w311)
  const x312: u32 = toU32(w311 >> 32)
  const x313: u32 = x312 + x281
  const w314: u64 = p256FiatMulxU32(x4, arg2[7])
  const x314: u32 = toU32(w314)
  const x315: u32 = toU32(w314 >> 32)
  const w316: u64 = p256FiatMulxU32(x4, arg2[6])
  const x316: u32 = toU32(w316)
  const x317: u32 = toU32(w316 >> 32)
  const w318: u64 = p256FiatMulxU32(x4, arg2[5])
  const x318: u32 = toU32(w318)
  const x319: u32 = toU32(w318 >> 32)
  const w320: u64 = p256FiatMulxU32(x4, arg2[4])
  const x320: u32 = toU32(w320)
  const x321: u32 = toU32(w320 >> 32)
  const w322: u64 = p256FiatMulxU32(x4, arg2[3])
  const x322: u32 = toU32(w322)
  const x323: u32 = toU32(w322 >> 32)
  const w324: u64 = p256FiatMulxU32(x4, arg2[2])
  const x324: u32 = toU32(w324)
  const x325: u32 = toU32(w324 >> 32)
  const w326: u64 = p256FiatMulxU32(x4, arg2[1])
  const x326: u32 = toU32(w326)
  const x327: u32 = toU32(w326 >> 32)
  const w328: u64 = p256FiatMulxU32(x4, arg2[0])
  const x328: u32 = toU32(w328)
  const x329: u32 = toU32(w328 >> 32)
  const w330: u64 = p256FiatAddcarryxU32(0x0, x329, x326)
  const x330: u32 = toU32(w330)
  const x331: u32 = toU32(w330 >> 32)
  const w332: u64 = p256FiatAddcarryxU32(x331, x327, x324)
  const x332: u32 = toU32(w332)
  const x333: u32 = toU32(w332 >> 32)
  const w334: u64 = p256FiatAddcarryxU32(x333, x325, x322)
  const x334: u32 = toU32(w334)
  const x335: u32 = toU32(w334 >> 32)
  const w336: u64 = p256FiatAddcarryxU32(x335, x323, x320)
  const x336: u32 = toU32(w336)
  const x337: u32 = toU32(w336 >> 32)
  const w338: u64 = p256FiatAddcarryxU32(x337, x321, x318)
  const x338: u32 = toU32(w338)
  const x339: u32 = toU32(w338 >> 32)
  const w340: u64 = p256FiatAddcarryxU32(x339, x319, x316)
  const x340: u32 = toU32(w340)
  const x341: u32 = toU32(w340 >> 32)
  const w342: u64 = p256FiatAddcarryxU32(x341, x317, x314)
  const x342: u32 = toU32(w342)
  const x343: u32 = toU32(w342 >> 32)
  const x344: u32 = x343 + x315
  const w345: u64 = p256FiatAddcarryxU32(0x0, x297, x328)
  const x345: u32 = toU32(w345)
  const x346: u32 = toU32(w345 >> 32)
  const w347: u64 = p256FiatAddcarryxU32(x346, x299, x330)
  const x347: u32 = toU32(w347)
  const x348: u32 = toU32(w347 >> 32)
  const w349: u64 = p256FiatAddcarryxU32(x348, x301, x332)
  const x349: u32 = toU32(w349)
  const x350: u32 = toU32(w349 >> 32)
  const w351: u64 = p256FiatAddcarryxU32(x350, x303, x334)
  const x351: u32 = toU32(w351)
  const x352: u32 = toU32(w351 >> 32)
  const w353: u64 = p256FiatAddcarryxU32(x352, x305, x336)
  const x353: u32 = toU32(w353)
  const x354: u32 = toU32(w353 >> 32)
  const w355: u64 = p256FiatAddcarryxU32(x354, x307, x338)
  const x355: u32 = toU32(w355)
  const x356: u32 = toU32(w355 >> 32)
  const w357: u64 = p256FiatAddcarryxU32(x356, x309, x340)
  const x357: u32 = toU32(w357)
  const x358: u32 = toU32(w357 >> 32)
  const w359: u64 = p256FiatAddcarryxU32(x358, x311, x342)
  const x359: u32 = toU32(w359)
  const x360: u32 = toU32(w359 >> 32)
  const w361: u64 = p256FiatAddcarryxU32(x360, x313, x344)
  const x361: u32 = toU32(w361)
  const x362: u32 = toU32(w361 >> 32)
  const w363: u64 = p256FiatMulxU32(x345, 0xffffffff)
  const x363: u32 = toU32(w363)
  const x364: u32 = toU32(w363 >> 32)
  const w365: u64 = p256FiatMulxU32(x345, 0xffffffff)
  const x365: u32 = toU32(w365)
  const x366: u32 = toU32(w365 >> 32)
  const w367: u64 = p256FiatMulxU32(x345, 0xffffffff)
  const x367: u32 = toU32(w367)
  const x368: u32 = toU32(w367 >> 32)
  const w369: u64 = p256FiatMulxU32(x345, 0xffffffff)
  const x369: u32 = toU32(w369)
  const x370: u32 = toU32(w369 >> 32)
  const w371: u64 = p256FiatAddcarryxU32(0x0, x370, x367)
  const x371: u32 = toU32(w371)
  const x372: u32 = toU32(w371 >> 32)
  const w373: u64 = p256FiatAddcarryxU32(x372, x368, x365)
  const x373: u32 = toU32(w373)
  const x374: u32 = toU32(w373 >> 32)
  const x375: u32 = x374 + x366
  const w376: u64 = p256FiatAddcarryxU32(0x0, x345, x369)
  const x377: u32 = toU32(w376 >> 32)
  const w378: u64 = p256FiatAddcarryxU32(x377, x347, x371)
  const x378: u32 = toU32(w378)
  const x379: u32 = toU32(w378 >> 32)
  const w380: u64 = p256FiatAddcarryxU32(x379, x349, x373)
  const x380: u32 = toU32(w380)
  const x381: u32 = toU32(w380 >> 32)
  const w382: u64 = p256FiatAddcarryxU32(x381, x351, x375)
  const x382: u32 = toU32(w382)
  const x383: u32 = toU32(w382 >> 32)
  const w384: u64 = p256FiatAddcarryxU32(x383, x353, 0x0)
  const x384: u32 = toU32(w384)
  const x385: u32 = toU32(w384 >> 32)
  const w386: u64 = p256FiatAddcarryxU32(x385, x355, 0x0)
  const x386: u32 = toU32(w386)
  const x387: u32 = toU32(w386 >> 32)
  const w388: u64 = p256FiatAddcarryxU32(x387, x357, x345)
  const x388: u32 = toU32(w388)
  const x389: u32 = toU32(w388 >> 32)
  const w390: u64 = p256FiatAddcarryxU32(x389, x359, x363)
  const x390: u32 = toU32(w390)
  const x391: u32 = toU32(w390 >> 32)
  const w392: u64 = p256FiatAddcarryxU32(x391, x361, x364)
  const x392: u32 = toU32(w392)
  const x393: u32 = toU32(w392 >> 32)
  const x394: u32 = x393 + x362
  const w395: u64 = p256FiatMulxU32(x5, arg2[7])
  const x395: u32 = toU32(w395)
  const x396: u32 = toU32(w395 >> 32)
  const w397: u64 = p256FiatMulxU32(x5, arg2[6])
  const x397: u32 = toU32(w397)
  const x398: u32 = toU32(w397 >> 32)
  const w399: u64 = p256FiatMulxU32(x5, arg2[5])
  const x399: u32 = toU32(w399)
  const x400: u32 = toU32(w399 >> 32)
  const w401: u64 = p256FiatMulxU32(x5, arg2[4])
  const x401: u32 = toU32(w401)
  const x402: u32 = toU32(w401 >> 32)
  const w403: u64 = p256FiatMulxU32(x5, arg2[3])
  const x403: u32 = toU32(w403)
  const x404: u32 = toU32(w403 >> 32)
  const w405: u64 = p256FiatMulxU32(x5, arg2[2])
  const x405: u32 = toU32(w405)
  const x406: u32 = toU32(w405 >> 32)
  const w407: u64 = p256FiatMulxU32(x5, arg2[1])
  const x407: u32 = toU32(w407)
  const x408: u32 = toU32(w407 >> 32)
  const w409: u64 = p256FiatMulxU32(x5, arg2[0])
  const x409: u32 = toU32(w409)
  const x410: u32 = toU32(w409 >> 32)
  const w411: u64 = p256FiatAddcarryxU32(0x0, x410, x407)
  const x411: u32 = toU32(w411)
  const x412: u32 = toU32(w411 >> 32)
  const w413: u64 = p256FiatAddcarryxU32(x412, x408, x405)
  const x413: u32 = toU32(w413)
  const x414: u32 = toU32(w413 >> 32)
  const w415: u64 = p256FiatAddcarryxU32(x414, x406, x403)
  const x415: u32 = toU32(w415)
  const x416: u32 = toU32(w415 >> 32)
  const w417: u64 = p256FiatAddcarryxU32(x416, x404, x401)
  const x417: u32 = toU32(w417)
  const x418: u32 = toU32(w417 >> 32)
  const w419: u64 = p256FiatAddcarryxU32(x418, x402, x399)
  const x419: u32 = toU32(w419)
  const x420: u32 = toU32(w419 >> 32)
  const w421: u64 = p256FiatAddcarryxU32(x420, x400, x397)
  const x421: u32 = toU32(w421)
  const x422: u32 = toU32(w421 >> 32)
  const w423: u64 = p256FiatAddcarryxU32(x422, x398, x395)
  const x423: u32 = toU32(w423)
  const x424: u32 = toU32(w423 >> 32)
  const x425: u32 = x424 + x396
  const w426: u64 = p256FiatAddcarryxU32(0x0, x378, x409)
  const x426: u32 = toU32(w426)
  const x427: u32 = toU32(w426 >> 32)
  const w428: u64 = p256FiatAddcarryxU32(x427, x380, x411)
  const x428: u32 = toU32(w428)
  const x429: u32 = toU32(w428 >> 32)
  const w430: u64 = p256FiatAddcarryxU32(x429, x382, x413)
  const x430: u32 = toU32(w430)
  const x431: u32 = toU32(w430 >> 32)
  const w432: u64 = p256FiatAddcarryxU32(x431, x384, x415)
  const x432: u32 = toU32(w432)
  const x433: u32 = toU32(w432 >> 32)
  const w434: u64 = p256FiatAddcarryxU32(x433, x386, x417)
  const x434: u32 = toU32(w434)
  const x435: u32 = toU32(w434 >> 32)
  const w436: u64 = p256FiatAddcarryxU32(x435, x388, x419)
  const x436: u32 = toU32(w436)
  const x437: u32 = toU32(w436 >> 32)
  const w438: u64 = p256FiatAddcarryxU32(x437, x390, x421)
  const x438: u32 = toU32(w438)
  const x439: u32 = toU32(w438 >> 32)
  const w440: u64 = p256FiatAddcarryxU32(x439, x392, x423)
  const x440: u32 = toU32(w440)
  const x441: u32 = toU32(w440 >> 32)
  const w442: u64 = p256FiatAddcarryxU32(x441, x394, x425)
  const x442: u32 = toU32(w442)
  const x443: u32 = toU32(w442 >> 32)
  const w444: u64 = p256FiatMulxU32(x426, 0xffffffff)
  const x444: u32 = toU32(w444)
  const x445: u32 = toU32(w444 >> 32)
  const w446: u64 = p256FiatMulxU32(x426, 0xffffffff)
  const x446: u32 = toU32(w446)
  const x447: u32 = toU32(w446 >> 32)
  const w448: u64 = p256FiatMulxU32(x426, 0xffffffff)
  const x448: u32 = toU32(w448)
  const x449: u32 = toU32(w448 >> 32)
  const w450: u64 = p256FiatMulxU32(x426, 0xffffffff)
  const x450: u32 = toU32(w450)
  const x451: u32 = toU32(w450 >> 32)
  const w452: u64 = p256FiatAddcarryxU32(0x0, x451, x448)
  const x452: u32 = toU32(w452)
  const x453: u32 = toU32(w452 >> 32)
  const w454: u64 = p256FiatAddcarryxU32(x453, x449, x446)
  const x454: u32 = toU32(w454)
  const x455: u32 = toU32(w454 >> 32)
  const x456: u32 = x455 + x447
  const w457: u64 = p256FiatAddcarryxU32(0x0, x426, x450)
  const x458: u32 = toU32(w457 >> 32)
  const w459: u64 = p256FiatAddcarryxU32(x458, x428, x452)
  const x459: u32 = toU32(w459)
  const x460: u32 = toU32(w459 >> 32)
  const w461: u64 = p256FiatAddcarryxU32(x460, x430, x454)
  const x461: u32 = toU32(w461)
  const x462: u32 = toU32(w461 >> 32)
  const w463: u64 = p256FiatAddcarryxU32(x462, x432, x456)
  const x463: u32 = toU32(w463)
  const x464: u32 = toU32(w463 >> 32)
  const w465: u64 = p256FiatAddcarryxU32(x464, x434, 0x0)
  const x465: u32 = toU32(w465)
  const x466: u32 = toU32(w465 >> 32)
  const w467: u64 = p256FiatAddcarryxU32(x466, x436, 0x0)
  const x467: u32 = toU32(w467)
  const x468: u32 = toU32(w467 >> 32)
  const w469: u64 = p256FiatAddcarryxU32(x468, x438, x426)
  const x469: u32 = toU32(w469)
  const x470: u32 = toU32(w469 >> 32)
  const w471: u64 = p256FiatAddcarryxU32(x470, x440, x444)
  const x471: u32 = toU32(w471)
  const x472: u32 = toU32(w471 >> 32)
  const w473: u64 = p256FiatAddcarryxU32(x472, x442, x445)
  const x473: u32 = toU32(w473)
  const x474: u32 = toU32(w473 >> 32)
  const x475: u32 = x474 + x443
  const w476: u64 = p256FiatMulxU32(x6, arg2[7])
  const x476: u32 = toU32(w476)
  const x477: u32 = toU32(w476 >> 32)
  const w478: u64 = p256FiatMulxU32(x6, arg2[6])
  const x478: u32 = toU32(w478)
  const x479: u32 = toU32(w478 >> 32)
  const w480: u64 = p256FiatMulxU32(x6, arg2[5])
  const x480: u32 = toU32(w480)
  const x481: u32 = toU32(w480 >> 32)
  const w482: u64 = p256FiatMulxU32(x6, arg2[4])
  const x482: u32 = toU32(w482)
  const x483: u32 = toU32(w482 >> 32)
  const w484: u64 = p256FiatMulxU32(x6, arg2[3])
  const x484: u32 = toU32(w484)
  const x485: u32 = toU32(w484 >> 32)
  const w486: u64 = p256FiatMulxU32(x6, arg2[2])
  const x486: u32 = toU32(w486)
  const x487: u32 = toU32(w486 >> 32)
  const w488: u64 = p256FiatMulxU32(x6, arg2[1])
  const x488: u32 = toU32(w488)
  const x489: u32 = toU32(w488 >> 32)
  const w490: u64 = p256FiatMulxU32(x6, arg2[0])
  const x490: u32 = toU32(w490)
  const x491: u32 = toU32(w490 >> 32)
  const w492: u64 = p256FiatAddcarryxU32(0x0, x491, x488)
  const x492: u32 = toU32(w492)
  const x493: u32 = toU32(w492 >> 32)
  const w494: u64 = p256FiatAddcarryxU32(x493, x489, x486)
  const x494: u32 = toU32(w494)
  const x495: u32 = toU32(w494 >> 32)
  const w496: u64 = p256FiatAddcarryxU32(x495, x487, x484)
  const x496: u32 = toU32(w496)
  const x497: u32 = toU32(w496 >> 32)
  const w498: u64 = p256FiatAddcarryxU32(x497, x485, x482)
  const x498: u32 = toU32(w498)
  const x499: u32 = toU32(w498 >> 32)
  const w500: u64 = p256FiatAddcarryxU32(x499, x483, x480)
  const x500: u32 = toU32(w500)
  const x501: u32 = toU32(w500 >> 32)
  const w502: u64 = p256FiatAddcarryxU32(x501, x481, x478)
  const x502: u32 = toU32(w502)
  const x503: u32 = toU32(w502 >> 32)
  const w504: u64 = p256FiatAddcarryxU32(x503, x479, x476)
  const x504: u32 = toU32(w504)
  const x505: u32 = toU32(w504 >> 32)
  const x506: u32 = x505 + x477
  const w507: u64 = p256FiatAddcarryxU32(0x0, x459, x490)
  const x507: u32 = toU32(w507)
  const x508: u32 = toU32(w507 >> 32)
  const w509: u64 = p256FiatAddcarryxU32(x508, x461, x492)
  const x509: u32 = toU32(w509)
  const x510: u32 = toU32(w509 >> 32)
  const w511: u64 = p256FiatAddcarryxU32(x510, x463, x494)
  const x511: u32 = toU32(w511)
  const x512: u32 = toU32(w511 >> 32)
  const w513: u64 = p256FiatAddcarryxU32(x512, x465, x496)
  const x513: u32 = toU32(w513)
  const x514: u32 = toU32(w513 >> 32)
  const w515: u64 = p256FiatAddcarryxU32(x514, x467, x498)
  const x515: u32 = toU32(w515)
  const x516: u32 = toU32(w515 >> 32)
  const w517: u64 = p256FiatAddcarryxU32(x516, x469, x500)
  const x517: u32 = toU32(w517)
  const x518: u32 = toU32(w517 >> 32)
  const w519: u64 = p256FiatAddcarryxU32(x518, x471, x502)
  const x519: u32 = toU32(w519)
  const x520: u32 = toU32(w519 >> 32)
  const w521: u64 = p256FiatAddcarryxU32(x520, x473, x504)
  const x521: u32 = toU32(w521)
  const x522: u32 = toU32(w521 >> 32)
  const w523: u64 = p256FiatAddcarryxU32(x522, x475, x506)
  const x523: u32 = toU32(w523)
  const x524: u32 = toU32(w523 >> 32)
  const w525: u64 = p256FiatMulxU32(x507, 0xffffffff)
  const x525: u32 = toU32(w525)
  const x526: u32 = toU32(w525 >> 32)
  const w527: u64 = p256FiatMulxU32(x507, 0xffffffff)
  const x527: u32 = toU32(w527)
  const x528: u32 = toU32(w527 >> 32)
  const w529: u64 = p256FiatMulxU32(x507, 0xffffffff)
  const x529: u32 = toU32(w529)
  const x530: u32 = toU32(w529 >> 32)
  const w531: u64 = p256FiatMulxU32(x507, 0xffffffff)
  const x531: u32 = toU32(w531)
  const x532: u32 = toU32(w531 >> 32)
  const w533: u64 = p256FiatAddcarryxU32(0x0, x532, x529)
  const x533: u32 = toU32(w533)
  const x534: u32 = toU32(w533 >> 32)
  const w535: u64 = p256FiatAddcarryxU32(x534, x530, x527)
  const x535: u32 = toU32(w535)
  const x536: u32 = toU32(w535 >> 32)
  const x537: u32 = x536 + x528
  const w538: u64 = p256FiatAddcarryxU32(0x0, x507, x531)
  const x539: u32 = toU32(w538 >> 32)
  const w540: u64 = p256FiatAddcarryxU32(x539, x509, x533)
  const x540: u32 = toU32(w540)
  const x541: u32 = toU32(w540 >> 32)
  const w542: u64 = p256FiatAddcarryxU32(x541, x511, x535)
  const x542: u32 = toU32(w542)
  const x543: u32 = toU32(w542 >> 32)
  const w544: u64 = p256FiatAddcarryxU32(x543, x513, x537)
  const x544: u32 = toU32(w544)
  const x545: u32 = toU32(w544 >> 32)
  const w546: u64 = p256FiatAddcarryxU32(x545, x515, 0x0)
  const x546: u32 = toU32(w546)
  const x547: u32 = toU32(w546 >> 32)
  const w548: u64 = p256FiatAddcarryxU32(x547, x517, 0x0)
  const x548: u32 = toU32(w548)
  const x549: u32 = toU32(w548 >> 32)
  const w550: u64 = p256FiatAddcarryxU32(x549, x519, x507)
  const x550: u32 = toU32(w550)
  const x551: u32 = toU32(w550 >> 32)
  const w552: u64 = p256FiatAddcarryxU32(x551, x521, x525)
  const x552: u32 = toU32(w552)
  const x553: u32 = toU32(w552 >> 32)
  const w554: u64 = p256FiatAddcarryxU32(x553, x523, x526)
  const x554: u32 = toU32(w554)
  const x555: u32 = toU32(w554 >> 32)
  const x556: u32 = x555 + x524
  const w557: u64 = p256FiatMulxU32(x7, arg2[7])
  const x557: u32 = toU32(w557)
  const x558: u32 = toU32(w557 >> 32)
  const w559: u64 = p256FiatMulxU32(x7, arg2[6])
  const x559: u32 = toU32(w559)
  const x560: u32 = toU32(w559 >> 32)
  const w561: u64 = p256FiatMulxU32(x7, arg2[5])
  const x561: u32 = toU32(w561)
  const x562: u32 = toU32(w561 >> 32)
  const w563: u64 = p256FiatMulxU32(x7, arg2[4])
  const x563: u32 = toU32(w563)
  const x564: u32 = toU32(w563 >> 32)
  const w565: u64 = p256FiatMulxU32(x7, arg2[3])
  const x565: u32 = toU32(w565)
  const x566: u32 = toU32(w565 >> 32)
  const w567: u64 = p256FiatMulxU32(x7, arg2[2])
  const x567: u32 = toU32(w567)
  const x568: u32 = toU32(w567 >> 32)
  const w569: u64 = p256FiatMulxU32(x7, arg2[1])
  const x569: u32 = toU32(w569)
  const x570: u32 = toU32(w569 >> 32)
  const w571: u64 = p256FiatMulxU32(x7, arg2[0])
  const x571: u32 = toU32(w571)
  const x572: u32 = toU32(w571 >> 32)
  const w573: u64 = p256FiatAddcarryxU32(0x0, x572, x569)
  const x573: u32 = toU32(w573)
  const x574: u32 = toU32(w573 >> 32)
  const w575: u64 = p256FiatAddcarryxU32(x574, x570, x567)
  const x575: u32 = toU32(w575)
  const x576: u32 = toU32(w575 >> 32)
  const w577: u64 = p256FiatAddcarryxU32(x576, x568, x565)
  const x577: u32 = toU32(w577)
  const x578: u32 = toU32(w577 >> 32)
  const w579: u64 = p256FiatAddcarryxU32(x578, x566, x563)
  const x579: u32 = toU32(w579)
  const x580: u32 = toU32(w579 >> 32)
  const w581: u64 = p256FiatAddcarryxU32(x580, x564, x561)
  const x581: u32 = toU32(w581)
  const x582: u32 = toU32(w581 >> 32)
  const w583: u64 = p256FiatAddcarryxU32(x582, x562, x559)
  const x583: u32 = toU32(w583)
  const x584: u32 = toU32(w583 >> 32)
  const w585: u64 = p256FiatAddcarryxU32(x584, x560, x557)
  const x585: u32 = toU32(w585)
  const x586: u32 = toU32(w585 >> 32)
  const x587: u32 = x586 + x558
  const w588: u64 = p256FiatAddcarryxU32(0x0, x540, x571)
  const x588: u32 = toU32(w588)
  const x589: u32 = toU32(w588 >> 32)
  const w590: u64 = p256FiatAddcarryxU32(x589, x542, x573)
  const x590: u32 = toU32(w590)
  const x591: u32 = toU32(w590 >> 32)
  const w592: u64 = p256FiatAddcarryxU32(x591, x544, x575)
  const x592: u32 = toU32(w592)
  const x593: u32 = toU32(w592 >> 32)
  const w594: u64 = p256FiatAddcarryxU32(x593, x546, x577)
  const x594: u32 = toU32(w594)
  const x595: u32 = toU32(w594 >> 32)
  const w596: u64 = p256FiatAddcarryxU32(x595, x548, x579)
  const x596: u32 = toU32(w596)
  const x597: u32 = toU32(w596 >> 32)
  const w598: u64 = p256FiatAddcarryxU32(x597, x550, x581)
  const x598: u32 = toU32(w598)
  const x599: u32 = toU32(w598 >> 32)
  const w600: u64 = p256FiatAddcarryxU32(x599, x552, x583)
  const x600: u32 = toU32(w600)
  const x601: u32 = toU32(w600 >> 32)
  const w602: u64 = p256FiatAddcarryxU32(x601, x554, x585)
  const x602: u32 = toU32(w602)
  const x603: u32 = toU32(w602 >> 32)
  const w604: u64 = p256FiatAddcarryxU32(x603, x556, x587)
  const x604: u32 = toU32(w604)
  const x605: u32 = toU32(w604 >> 32)
  const w606: u64 = p256FiatMulxU32(x588, 0xffffffff)
  const x606: u32 = toU32(w606)
  const x607: u32 = toU32(w606 >> 32)
  const w608: u64 = p256FiatMulxU32(x588, 0xffffffff)
  const x608: u32 = toU32(w608)
  const x609: u32 = toU32(w608 >> 32)
  const w610: u64 = p256FiatMulxU32(x588, 0xffffffff)
  const x610: u32 = toU32(w610)
  const x611: u32 = toU32(w610 >> 32)
  const w612: u64 = p256FiatMulxU32(x588, 0xffffffff)
  const x612: u32 = toU32(w612)
  const x613: u32 = toU32(w612 >> 32)
  const w614: u64 = p256FiatAddcarryxU32(0x0, x613, x610)
  const x614: u32 = toU32(w614)
  const x615: u32 = toU32(w614 >> 32)
  const w616: u64 = p256FiatAddcarryxU32(x615, x611, x608)
  const x616: u32 = toU32(w616)
  const x617: u32 = toU32(w616 >> 32)
  const x618: u32 = x617 + x609
  const w619: u64 = p256FiatAddcarryxU32(0x0, x588, x612)
  const x620: u32 = toU32(w619 >> 32)
  const w621: u64 = p256FiatAddcarryxU32(x620, x590, x614)
  const x621: u32 = toU32(w621)
  const x622: u32 = toU32(w621 >> 32)
  const w623: u64 = p256FiatAddcarryxU32(x622, x592, x616)
  const x623: u32 = toU32(w623)
  const x624: u32 = toU32(w623 >> 32)
  const w625: u64 = p256FiatAddcarryxU32(x624, x594, x618)
  const x625: u32 = toU32(w625)
  const x626: u32 = toU32(w625 >> 32)
  const w627: u64 = p256FiatAddcarryxU32(x626, x596, 0x0)
  const x627: u32 = toU32(w627)
  const x628: u32 = toU32(w627 >> 32)
  const w629: u64 = p256FiatAddcarryxU32(x628, x598, 0x0)
  const x629: u32 = toU32(w629)
  const x630: u32 = toU32(w629 >> 32)
  const w631: u64 = p256FiatAddcarryxU32(x630, x600, x588)
  const x631: u32 = toU32(w631)
  const x632: u32 = toU32(w631 >> 32)
  const w633: u64 = p256FiatAddcarryxU32(x632, x602, x606)
  const x633: u32 = toU32(w633)
  const x634: u32 = toU32(w633 >> 32)
  const w635: u64 = p256FiatAddcarryxU32(x634, x604, x607)
  const x635: u32 = toU32(w635)
  const x636: u32 = toU32(w635 >> 32)
  const x637: u32 = x636 + x605
  const w638: u64 = p256FiatSubborrowxU32(0x0, x621, 0xffffffff)
  const x638: u32 = toU32(w638)
  const x639: u32 = toU32(w638 >> 32)
  const w640: u64 = p256FiatSubborrowxU32(x639, x623, 0xffffffff)
  const x640: u32 = toU32(w640)
  const x641: u32 = toU32(w640 >> 32)
  const w642: u64 = p256FiatSubborrowxU32(x641, x625, 0xffffffff)
  const x642: u32 = toU32(w642)
  const x643: u32 = toU32(w642 >> 32)
  const w644: u64 = p256FiatSubborrowxU32(x643, x627, 0x0)
  const x644: u32 = toU32(w644)
  const x645: u32 = toU32(w644 >> 32)
  const w646: u64 = p256FiatSubborrowxU32(x645, x629, 0x0)
  const x646: u32 = toU32(w646)
  const x647: u32 = toU32(w646 >> 32)
  const w648: u64 = p256FiatSubborrowxU32(x647, x631, 0x0)
  const x648: u32 = toU32(w648)
  const x649: u32 = toU32(w648 >> 32)
  const w650: u64 = p256FiatSubborrowxU32(x649, x633, 0x1)
  const x650: u32 = toU32(w650)
  const x651: u32 = toU32(w650 >> 32)
  const w652: u64 = p256FiatSubborrowxU32(x651, x635, 0xffffffff)
  const x652: u32 = toU32(w652)
  const x653: u32 = toU32(w652 >> 32)
  const w654: u64 = p256FiatSubborrowxU32(x653, x637, 0x0)
  const x655: u32 = toU32(w654 >> 32)
  const x656: u32 = p256FiatCmovznzU32(x655, x638, x621)
  const x657: u32 = p256FiatCmovznzU32(x655, x640, x623)
  const x658: u32 = p256FiatCmovznzU32(x655, x642, x625)
  const x659: u32 = p256FiatCmovznzU32(x655, x644, x627)
  const x660: u32 = p256FiatCmovznzU32(x655, x646, x629)
  const x661: u32 = p256FiatCmovznzU32(x655, x648, x631)
  const x662: u32 = p256FiatCmovznzU32(x655, x650, x633)
  const x663: u32 = p256FiatCmovznzU32(x655, x652, x635)
  out1[0] = x656
  out1[1] = x657
  out1[2] = x658
  out1[3] = x659
  out1[4] = x660
  out1[5] = x661
  out1[6] = x662
  out1[7] = x663
}

/** fiat's `fiat_p256_square`: squares a field element in the Montgomery domain. */
const p256FiatSquare = (out1: u32[], arg1: u32[]): void => {
  if (toI32(out1.length) < 8 || toI32(arg1.length) < 8) {
    return
  }
  const arg1Limb0: u32 = arg1[0]
  const arg1Limb1: u32 = arg1[1]
  const arg1Limb2: u32 = arg1[2]
  const arg1Limb3: u32 = arg1[3]
  const arg1Limb4: u32 = arg1[4]
  const arg1Limb5: u32 = arg1[5]
  const arg1Limb6: u32 = arg1[6]
  const arg1Limb7: u32 = arg1[7]
  const x1: u32 = arg1Limb1
  const x2: u32 = arg1Limb2
  const x3: u32 = arg1Limb3
  const x4: u32 = arg1Limb4
  const x5: u32 = arg1Limb5
  const x6: u32 = arg1Limb6
  const x7: u32 = arg1Limb7
  const x8: u32 = arg1Limb0
  const w9: u64 = p256FiatMulxU32(x8, arg1Limb7)
  const x9: u32 = toU32(w9)
  const x10: u32 = toU32(w9 >> 32)
  const w11: u64 = p256FiatMulxU32(x8, arg1Limb6)
  const x11: u32 = toU32(w11)
  const x12: u32 = toU32(w11 >> 32)
  const w13: u64 = p256FiatMulxU32(x8, arg1Limb5)
  const x13: u32 = toU32(w13)
  const x14: u32 = toU32(w13 >> 32)
  const w15: u64 = p256FiatMulxU32(x8, arg1Limb4)
  const x15: u32 = toU32(w15)
  const x16: u32 = toU32(w15 >> 32)
  const w17: u64 = p256FiatMulxU32(x8, arg1Limb3)
  const x17: u32 = toU32(w17)
  const x18: u32 = toU32(w17 >> 32)
  const w19: u64 = p256FiatMulxU32(x8, arg1Limb2)
  const x19: u32 = toU32(w19)
  const x20: u32 = toU32(w19 >> 32)
  const w21: u64 = p256FiatMulxU32(x8, arg1Limb1)
  const x21: u32 = toU32(w21)
  const x22: u32 = toU32(w21 >> 32)
  const w23: u64 = p256FiatMulxU32(x8, arg1Limb0)
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
  const w40: u64 = p256FiatMulxU32(x23, 0xffffffff)
  const x40: u32 = toU32(w40)
  const x41: u32 = toU32(w40 >> 32)
  const w42: u64 = p256FiatMulxU32(x23, 0xffffffff)
  const x42: u32 = toU32(w42)
  const x43: u32 = toU32(w42 >> 32)
  const w44: u64 = p256FiatMulxU32(x23, 0xffffffff)
  const x44: u32 = toU32(w44)
  const x45: u32 = toU32(w44 >> 32)
  const w46: u64 = p256FiatMulxU32(x23, 0xffffffff)
  const x46: u32 = toU32(w46)
  const x47: u32 = toU32(w46 >> 32)
  const w48: u64 = p256FiatAddcarryxU32(0x0, x47, x44)
  const x48: u32 = toU32(w48)
  const x49: u32 = toU32(w48 >> 32)
  const w50: u64 = p256FiatAddcarryxU32(x49, x45, x42)
  const x50: u32 = toU32(w50)
  const x51: u32 = toU32(w50 >> 32)
  const x52: u32 = x51 + x43
  const w53: u64 = p256FiatAddcarryxU32(0x0, x23, x46)
  const x54: u32 = toU32(w53 >> 32)
  const w55: u64 = p256FiatAddcarryxU32(x54, x25, x48)
  const x55: u32 = toU32(w55)
  const x56: u32 = toU32(w55 >> 32)
  const w57: u64 = p256FiatAddcarryxU32(x56, x27, x50)
  const x57: u32 = toU32(w57)
  const x58: u32 = toU32(w57 >> 32)
  const w59: u64 = p256FiatAddcarryxU32(x58, x29, x52)
  const x59: u32 = toU32(w59)
  const x60: u32 = toU32(w59 >> 32)
  const w61: u64 = p256FiatAddcarryxU32(x60, x31, 0x0)
  const x61: u32 = toU32(w61)
  const x62: u32 = toU32(w61 >> 32)
  const w63: u64 = p256FiatAddcarryxU32(x62, x33, 0x0)
  const x63: u32 = toU32(w63)
  const x64: u32 = toU32(w63 >> 32)
  const w65: u64 = p256FiatAddcarryxU32(x64, x35, x23)
  const x65: u32 = toU32(w65)
  const x66: u32 = toU32(w65 >> 32)
  const w67: u64 = p256FiatAddcarryxU32(x66, x37, x40)
  const x67: u32 = toU32(w67)
  const x68: u32 = toU32(w67 >> 32)
  const w69: u64 = p256FiatAddcarryxU32(x68, x39, x41)
  const x69: u32 = toU32(w69)
  const x70: u32 = toU32(w69 >> 32)
  const w71: u64 = p256FiatMulxU32(x1, arg1Limb7)
  const x71: u32 = toU32(w71)
  const x72: u32 = toU32(w71 >> 32)
  const w73: u64 = p256FiatMulxU32(x1, arg1Limb6)
  const x73: u32 = toU32(w73)
  const x74: u32 = toU32(w73 >> 32)
  const w75: u64 = p256FiatMulxU32(x1, arg1Limb5)
  const x75: u32 = toU32(w75)
  const x76: u32 = toU32(w75 >> 32)
  const w77: u64 = p256FiatMulxU32(x1, arg1Limb4)
  const x77: u32 = toU32(w77)
  const x78: u32 = toU32(w77 >> 32)
  const w79: u64 = p256FiatMulxU32(x1, arg1Limb3)
  const x79: u32 = toU32(w79)
  const x80: u32 = toU32(w79 >> 32)
  const w81: u64 = p256FiatMulxU32(x1, arg1Limb2)
  const x81: u32 = toU32(w81)
  const x82: u32 = toU32(w81 >> 32)
  const w83: u64 = p256FiatMulxU32(x1, arg1Limb1)
  const x83: u32 = toU32(w83)
  const x84: u32 = toU32(w83 >> 32)
  const w85: u64 = p256FiatMulxU32(x1, arg1Limb0)
  const x85: u32 = toU32(w85)
  const x86: u32 = toU32(w85 >> 32)
  const w87: u64 = p256FiatAddcarryxU32(0x0, x86, x83)
  const x87: u32 = toU32(w87)
  const x88: u32 = toU32(w87 >> 32)
  const w89: u64 = p256FiatAddcarryxU32(x88, x84, x81)
  const x89: u32 = toU32(w89)
  const x90: u32 = toU32(w89 >> 32)
  const w91: u64 = p256FiatAddcarryxU32(x90, x82, x79)
  const x91: u32 = toU32(w91)
  const x92: u32 = toU32(w91 >> 32)
  const w93: u64 = p256FiatAddcarryxU32(x92, x80, x77)
  const x93: u32 = toU32(w93)
  const x94: u32 = toU32(w93 >> 32)
  const w95: u64 = p256FiatAddcarryxU32(x94, x78, x75)
  const x95: u32 = toU32(w95)
  const x96: u32 = toU32(w95 >> 32)
  const w97: u64 = p256FiatAddcarryxU32(x96, x76, x73)
  const x97: u32 = toU32(w97)
  const x98: u32 = toU32(w97 >> 32)
  const w99: u64 = p256FiatAddcarryxU32(x98, x74, x71)
  const x99: u32 = toU32(w99)
  const x100: u32 = toU32(w99 >> 32)
  const x101: u32 = x100 + x72
  const w102: u64 = p256FiatAddcarryxU32(0x0, x55, x85)
  const x102: u32 = toU32(w102)
  const x103: u32 = toU32(w102 >> 32)
  const w104: u64 = p256FiatAddcarryxU32(x103, x57, x87)
  const x104: u32 = toU32(w104)
  const x105: u32 = toU32(w104 >> 32)
  const w106: u64 = p256FiatAddcarryxU32(x105, x59, x89)
  const x106: u32 = toU32(w106)
  const x107: u32 = toU32(w106 >> 32)
  const w108: u64 = p256FiatAddcarryxU32(x107, x61, x91)
  const x108: u32 = toU32(w108)
  const x109: u32 = toU32(w108 >> 32)
  const w110: u64 = p256FiatAddcarryxU32(x109, x63, x93)
  const x110: u32 = toU32(w110)
  const x111: u32 = toU32(w110 >> 32)
  const w112: u64 = p256FiatAddcarryxU32(x111, x65, x95)
  const x112: u32 = toU32(w112)
  const x113: u32 = toU32(w112 >> 32)
  const w114: u64 = p256FiatAddcarryxU32(x113, x67, x97)
  const x114: u32 = toU32(w114)
  const x115: u32 = toU32(w114 >> 32)
  const w116: u64 = p256FiatAddcarryxU32(x115, x69, x99)
  const x116: u32 = toU32(w116)
  const x117: u32 = toU32(w116 >> 32)
  const w118: u64 = p256FiatAddcarryxU32(x117, x70, x101)
  const x118: u32 = toU32(w118)
  const x119: u32 = toU32(w118 >> 32)
  const w120: u64 = p256FiatMulxU32(x102, 0xffffffff)
  const x120: u32 = toU32(w120)
  const x121: u32 = toU32(w120 >> 32)
  const w122: u64 = p256FiatMulxU32(x102, 0xffffffff)
  const x122: u32 = toU32(w122)
  const x123: u32 = toU32(w122 >> 32)
  const w124: u64 = p256FiatMulxU32(x102, 0xffffffff)
  const x124: u32 = toU32(w124)
  const x125: u32 = toU32(w124 >> 32)
  const w126: u64 = p256FiatMulxU32(x102, 0xffffffff)
  const x126: u32 = toU32(w126)
  const x127: u32 = toU32(w126 >> 32)
  const w128: u64 = p256FiatAddcarryxU32(0x0, x127, x124)
  const x128: u32 = toU32(w128)
  const x129: u32 = toU32(w128 >> 32)
  const w130: u64 = p256FiatAddcarryxU32(x129, x125, x122)
  const x130: u32 = toU32(w130)
  const x131: u32 = toU32(w130 >> 32)
  const x132: u32 = x131 + x123
  const w133: u64 = p256FiatAddcarryxU32(0x0, x102, x126)
  const x134: u32 = toU32(w133 >> 32)
  const w135: u64 = p256FiatAddcarryxU32(x134, x104, x128)
  const x135: u32 = toU32(w135)
  const x136: u32 = toU32(w135 >> 32)
  const w137: u64 = p256FiatAddcarryxU32(x136, x106, x130)
  const x137: u32 = toU32(w137)
  const x138: u32 = toU32(w137 >> 32)
  const w139: u64 = p256FiatAddcarryxU32(x138, x108, x132)
  const x139: u32 = toU32(w139)
  const x140: u32 = toU32(w139 >> 32)
  const w141: u64 = p256FiatAddcarryxU32(x140, x110, 0x0)
  const x141: u32 = toU32(w141)
  const x142: u32 = toU32(w141 >> 32)
  const w143: u64 = p256FiatAddcarryxU32(x142, x112, 0x0)
  const x143: u32 = toU32(w143)
  const x144: u32 = toU32(w143 >> 32)
  const w145: u64 = p256FiatAddcarryxU32(x144, x114, x102)
  const x145: u32 = toU32(w145)
  const x146: u32 = toU32(w145 >> 32)
  const w147: u64 = p256FiatAddcarryxU32(x146, x116, x120)
  const x147: u32 = toU32(w147)
  const x148: u32 = toU32(w147 >> 32)
  const w149: u64 = p256FiatAddcarryxU32(x148, x118, x121)
  const x149: u32 = toU32(w149)
  const x150: u32 = toU32(w149 >> 32)
  const x151: u32 = x150 + x119
  const w152: u64 = p256FiatMulxU32(x2, arg1Limb7)
  const x152: u32 = toU32(w152)
  const x153: u32 = toU32(w152 >> 32)
  const w154: u64 = p256FiatMulxU32(x2, arg1Limb6)
  const x154: u32 = toU32(w154)
  const x155: u32 = toU32(w154 >> 32)
  const w156: u64 = p256FiatMulxU32(x2, arg1Limb5)
  const x156: u32 = toU32(w156)
  const x157: u32 = toU32(w156 >> 32)
  const w158: u64 = p256FiatMulxU32(x2, arg1Limb4)
  const x158: u32 = toU32(w158)
  const x159: u32 = toU32(w158 >> 32)
  const w160: u64 = p256FiatMulxU32(x2, arg1Limb3)
  const x160: u32 = toU32(w160)
  const x161: u32 = toU32(w160 >> 32)
  const w162: u64 = p256FiatMulxU32(x2, arg1Limb2)
  const x162: u32 = toU32(w162)
  const x163: u32 = toU32(w162 >> 32)
  const w164: u64 = p256FiatMulxU32(x2, arg1Limb1)
  const x164: u32 = toU32(w164)
  const x165: u32 = toU32(w164 >> 32)
  const w166: u64 = p256FiatMulxU32(x2, arg1Limb0)
  const x166: u32 = toU32(w166)
  const x167: u32 = toU32(w166 >> 32)
  const w168: u64 = p256FiatAddcarryxU32(0x0, x167, x164)
  const x168: u32 = toU32(w168)
  const x169: u32 = toU32(w168 >> 32)
  const w170: u64 = p256FiatAddcarryxU32(x169, x165, x162)
  const x170: u32 = toU32(w170)
  const x171: u32 = toU32(w170 >> 32)
  const w172: u64 = p256FiatAddcarryxU32(x171, x163, x160)
  const x172: u32 = toU32(w172)
  const x173: u32 = toU32(w172 >> 32)
  const w174: u64 = p256FiatAddcarryxU32(x173, x161, x158)
  const x174: u32 = toU32(w174)
  const x175: u32 = toU32(w174 >> 32)
  const w176: u64 = p256FiatAddcarryxU32(x175, x159, x156)
  const x176: u32 = toU32(w176)
  const x177: u32 = toU32(w176 >> 32)
  const w178: u64 = p256FiatAddcarryxU32(x177, x157, x154)
  const x178: u32 = toU32(w178)
  const x179: u32 = toU32(w178 >> 32)
  const w180: u64 = p256FiatAddcarryxU32(x179, x155, x152)
  const x180: u32 = toU32(w180)
  const x181: u32 = toU32(w180 >> 32)
  const x182: u32 = x181 + x153
  const w183: u64 = p256FiatAddcarryxU32(0x0, x135, x166)
  const x183: u32 = toU32(w183)
  const x184: u32 = toU32(w183 >> 32)
  const w185: u64 = p256FiatAddcarryxU32(x184, x137, x168)
  const x185: u32 = toU32(w185)
  const x186: u32 = toU32(w185 >> 32)
  const w187: u64 = p256FiatAddcarryxU32(x186, x139, x170)
  const x187: u32 = toU32(w187)
  const x188: u32 = toU32(w187 >> 32)
  const w189: u64 = p256FiatAddcarryxU32(x188, x141, x172)
  const x189: u32 = toU32(w189)
  const x190: u32 = toU32(w189 >> 32)
  const w191: u64 = p256FiatAddcarryxU32(x190, x143, x174)
  const x191: u32 = toU32(w191)
  const x192: u32 = toU32(w191 >> 32)
  const w193: u64 = p256FiatAddcarryxU32(x192, x145, x176)
  const x193: u32 = toU32(w193)
  const x194: u32 = toU32(w193 >> 32)
  const w195: u64 = p256FiatAddcarryxU32(x194, x147, x178)
  const x195: u32 = toU32(w195)
  const x196: u32 = toU32(w195 >> 32)
  const w197: u64 = p256FiatAddcarryxU32(x196, x149, x180)
  const x197: u32 = toU32(w197)
  const x198: u32 = toU32(w197 >> 32)
  const w199: u64 = p256FiatAddcarryxU32(x198, x151, x182)
  const x199: u32 = toU32(w199)
  const x200: u32 = toU32(w199 >> 32)
  const w201: u64 = p256FiatMulxU32(x183, 0xffffffff)
  const x201: u32 = toU32(w201)
  const x202: u32 = toU32(w201 >> 32)
  const w203: u64 = p256FiatMulxU32(x183, 0xffffffff)
  const x203: u32 = toU32(w203)
  const x204: u32 = toU32(w203 >> 32)
  const w205: u64 = p256FiatMulxU32(x183, 0xffffffff)
  const x205: u32 = toU32(w205)
  const x206: u32 = toU32(w205 >> 32)
  const w207: u64 = p256FiatMulxU32(x183, 0xffffffff)
  const x207: u32 = toU32(w207)
  const x208: u32 = toU32(w207 >> 32)
  const w209: u64 = p256FiatAddcarryxU32(0x0, x208, x205)
  const x209: u32 = toU32(w209)
  const x210: u32 = toU32(w209 >> 32)
  const w211: u64 = p256FiatAddcarryxU32(x210, x206, x203)
  const x211: u32 = toU32(w211)
  const x212: u32 = toU32(w211 >> 32)
  const x213: u32 = x212 + x204
  const w214: u64 = p256FiatAddcarryxU32(0x0, x183, x207)
  const x215: u32 = toU32(w214 >> 32)
  const w216: u64 = p256FiatAddcarryxU32(x215, x185, x209)
  const x216: u32 = toU32(w216)
  const x217: u32 = toU32(w216 >> 32)
  const w218: u64 = p256FiatAddcarryxU32(x217, x187, x211)
  const x218: u32 = toU32(w218)
  const x219: u32 = toU32(w218 >> 32)
  const w220: u64 = p256FiatAddcarryxU32(x219, x189, x213)
  const x220: u32 = toU32(w220)
  const x221: u32 = toU32(w220 >> 32)
  const w222: u64 = p256FiatAddcarryxU32(x221, x191, 0x0)
  const x222: u32 = toU32(w222)
  const x223: u32 = toU32(w222 >> 32)
  const w224: u64 = p256FiatAddcarryxU32(x223, x193, 0x0)
  const x224: u32 = toU32(w224)
  const x225: u32 = toU32(w224 >> 32)
  const w226: u64 = p256FiatAddcarryxU32(x225, x195, x183)
  const x226: u32 = toU32(w226)
  const x227: u32 = toU32(w226 >> 32)
  const w228: u64 = p256FiatAddcarryxU32(x227, x197, x201)
  const x228: u32 = toU32(w228)
  const x229: u32 = toU32(w228 >> 32)
  const w230: u64 = p256FiatAddcarryxU32(x229, x199, x202)
  const x230: u32 = toU32(w230)
  const x231: u32 = toU32(w230 >> 32)
  const x232: u32 = x231 + x200
  const w233: u64 = p256FiatMulxU32(x3, arg1Limb7)
  const x233: u32 = toU32(w233)
  const x234: u32 = toU32(w233 >> 32)
  const w235: u64 = p256FiatMulxU32(x3, arg1Limb6)
  const x235: u32 = toU32(w235)
  const x236: u32 = toU32(w235 >> 32)
  const w237: u64 = p256FiatMulxU32(x3, arg1Limb5)
  const x237: u32 = toU32(w237)
  const x238: u32 = toU32(w237 >> 32)
  const w239: u64 = p256FiatMulxU32(x3, arg1Limb4)
  const x239: u32 = toU32(w239)
  const x240: u32 = toU32(w239 >> 32)
  const w241: u64 = p256FiatMulxU32(x3, arg1Limb3)
  const x241: u32 = toU32(w241)
  const x242: u32 = toU32(w241 >> 32)
  const w243: u64 = p256FiatMulxU32(x3, arg1Limb2)
  const x243: u32 = toU32(w243)
  const x244: u32 = toU32(w243 >> 32)
  const w245: u64 = p256FiatMulxU32(x3, arg1Limb1)
  const x245: u32 = toU32(w245)
  const x246: u32 = toU32(w245 >> 32)
  const w247: u64 = p256FiatMulxU32(x3, arg1Limb0)
  const x247: u32 = toU32(w247)
  const x248: u32 = toU32(w247 >> 32)
  const w249: u64 = p256FiatAddcarryxU32(0x0, x248, x245)
  const x249: u32 = toU32(w249)
  const x250: u32 = toU32(w249 >> 32)
  const w251: u64 = p256FiatAddcarryxU32(x250, x246, x243)
  const x251: u32 = toU32(w251)
  const x252: u32 = toU32(w251 >> 32)
  const w253: u64 = p256FiatAddcarryxU32(x252, x244, x241)
  const x253: u32 = toU32(w253)
  const x254: u32 = toU32(w253 >> 32)
  const w255: u64 = p256FiatAddcarryxU32(x254, x242, x239)
  const x255: u32 = toU32(w255)
  const x256: u32 = toU32(w255 >> 32)
  const w257: u64 = p256FiatAddcarryxU32(x256, x240, x237)
  const x257: u32 = toU32(w257)
  const x258: u32 = toU32(w257 >> 32)
  const w259: u64 = p256FiatAddcarryxU32(x258, x238, x235)
  const x259: u32 = toU32(w259)
  const x260: u32 = toU32(w259 >> 32)
  const w261: u64 = p256FiatAddcarryxU32(x260, x236, x233)
  const x261: u32 = toU32(w261)
  const x262: u32 = toU32(w261 >> 32)
  const x263: u32 = x262 + x234
  const w264: u64 = p256FiatAddcarryxU32(0x0, x216, x247)
  const x264: u32 = toU32(w264)
  const x265: u32 = toU32(w264 >> 32)
  const w266: u64 = p256FiatAddcarryxU32(x265, x218, x249)
  const x266: u32 = toU32(w266)
  const x267: u32 = toU32(w266 >> 32)
  const w268: u64 = p256FiatAddcarryxU32(x267, x220, x251)
  const x268: u32 = toU32(w268)
  const x269: u32 = toU32(w268 >> 32)
  const w270: u64 = p256FiatAddcarryxU32(x269, x222, x253)
  const x270: u32 = toU32(w270)
  const x271: u32 = toU32(w270 >> 32)
  const w272: u64 = p256FiatAddcarryxU32(x271, x224, x255)
  const x272: u32 = toU32(w272)
  const x273: u32 = toU32(w272 >> 32)
  const w274: u64 = p256FiatAddcarryxU32(x273, x226, x257)
  const x274: u32 = toU32(w274)
  const x275: u32 = toU32(w274 >> 32)
  const w276: u64 = p256FiatAddcarryxU32(x275, x228, x259)
  const x276: u32 = toU32(w276)
  const x277: u32 = toU32(w276 >> 32)
  const w278: u64 = p256FiatAddcarryxU32(x277, x230, x261)
  const x278: u32 = toU32(w278)
  const x279: u32 = toU32(w278 >> 32)
  const w280: u64 = p256FiatAddcarryxU32(x279, x232, x263)
  const x280: u32 = toU32(w280)
  const x281: u32 = toU32(w280 >> 32)
  const w282: u64 = p256FiatMulxU32(x264, 0xffffffff)
  const x282: u32 = toU32(w282)
  const x283: u32 = toU32(w282 >> 32)
  const w284: u64 = p256FiatMulxU32(x264, 0xffffffff)
  const x284: u32 = toU32(w284)
  const x285: u32 = toU32(w284 >> 32)
  const w286: u64 = p256FiatMulxU32(x264, 0xffffffff)
  const x286: u32 = toU32(w286)
  const x287: u32 = toU32(w286 >> 32)
  const w288: u64 = p256FiatMulxU32(x264, 0xffffffff)
  const x288: u32 = toU32(w288)
  const x289: u32 = toU32(w288 >> 32)
  const w290: u64 = p256FiatAddcarryxU32(0x0, x289, x286)
  const x290: u32 = toU32(w290)
  const x291: u32 = toU32(w290 >> 32)
  const w292: u64 = p256FiatAddcarryxU32(x291, x287, x284)
  const x292: u32 = toU32(w292)
  const x293: u32 = toU32(w292 >> 32)
  const x294: u32 = x293 + x285
  const w295: u64 = p256FiatAddcarryxU32(0x0, x264, x288)
  const x296: u32 = toU32(w295 >> 32)
  const w297: u64 = p256FiatAddcarryxU32(x296, x266, x290)
  const x297: u32 = toU32(w297)
  const x298: u32 = toU32(w297 >> 32)
  const w299: u64 = p256FiatAddcarryxU32(x298, x268, x292)
  const x299: u32 = toU32(w299)
  const x300: u32 = toU32(w299 >> 32)
  const w301: u64 = p256FiatAddcarryxU32(x300, x270, x294)
  const x301: u32 = toU32(w301)
  const x302: u32 = toU32(w301 >> 32)
  const w303: u64 = p256FiatAddcarryxU32(x302, x272, 0x0)
  const x303: u32 = toU32(w303)
  const x304: u32 = toU32(w303 >> 32)
  const w305: u64 = p256FiatAddcarryxU32(x304, x274, 0x0)
  const x305: u32 = toU32(w305)
  const x306: u32 = toU32(w305 >> 32)
  const w307: u64 = p256FiatAddcarryxU32(x306, x276, x264)
  const x307: u32 = toU32(w307)
  const x308: u32 = toU32(w307 >> 32)
  const w309: u64 = p256FiatAddcarryxU32(x308, x278, x282)
  const x309: u32 = toU32(w309)
  const x310: u32 = toU32(w309 >> 32)
  const w311: u64 = p256FiatAddcarryxU32(x310, x280, x283)
  const x311: u32 = toU32(w311)
  const x312: u32 = toU32(w311 >> 32)
  const x313: u32 = x312 + x281
  const w314: u64 = p256FiatMulxU32(x4, arg1Limb7)
  const x314: u32 = toU32(w314)
  const x315: u32 = toU32(w314 >> 32)
  const w316: u64 = p256FiatMulxU32(x4, arg1Limb6)
  const x316: u32 = toU32(w316)
  const x317: u32 = toU32(w316 >> 32)
  const w318: u64 = p256FiatMulxU32(x4, arg1Limb5)
  const x318: u32 = toU32(w318)
  const x319: u32 = toU32(w318 >> 32)
  const w320: u64 = p256FiatMulxU32(x4, arg1Limb4)
  const x320: u32 = toU32(w320)
  const x321: u32 = toU32(w320 >> 32)
  const w322: u64 = p256FiatMulxU32(x4, arg1Limb3)
  const x322: u32 = toU32(w322)
  const x323: u32 = toU32(w322 >> 32)
  const w324: u64 = p256FiatMulxU32(x4, arg1Limb2)
  const x324: u32 = toU32(w324)
  const x325: u32 = toU32(w324 >> 32)
  const w326: u64 = p256FiatMulxU32(x4, arg1Limb1)
  const x326: u32 = toU32(w326)
  const x327: u32 = toU32(w326 >> 32)
  const w328: u64 = p256FiatMulxU32(x4, arg1Limb0)
  const x328: u32 = toU32(w328)
  const x329: u32 = toU32(w328 >> 32)
  const w330: u64 = p256FiatAddcarryxU32(0x0, x329, x326)
  const x330: u32 = toU32(w330)
  const x331: u32 = toU32(w330 >> 32)
  const w332: u64 = p256FiatAddcarryxU32(x331, x327, x324)
  const x332: u32 = toU32(w332)
  const x333: u32 = toU32(w332 >> 32)
  const w334: u64 = p256FiatAddcarryxU32(x333, x325, x322)
  const x334: u32 = toU32(w334)
  const x335: u32 = toU32(w334 >> 32)
  const w336: u64 = p256FiatAddcarryxU32(x335, x323, x320)
  const x336: u32 = toU32(w336)
  const x337: u32 = toU32(w336 >> 32)
  const w338: u64 = p256FiatAddcarryxU32(x337, x321, x318)
  const x338: u32 = toU32(w338)
  const x339: u32 = toU32(w338 >> 32)
  const w340: u64 = p256FiatAddcarryxU32(x339, x319, x316)
  const x340: u32 = toU32(w340)
  const x341: u32 = toU32(w340 >> 32)
  const w342: u64 = p256FiatAddcarryxU32(x341, x317, x314)
  const x342: u32 = toU32(w342)
  const x343: u32 = toU32(w342 >> 32)
  const x344: u32 = x343 + x315
  const w345: u64 = p256FiatAddcarryxU32(0x0, x297, x328)
  const x345: u32 = toU32(w345)
  const x346: u32 = toU32(w345 >> 32)
  const w347: u64 = p256FiatAddcarryxU32(x346, x299, x330)
  const x347: u32 = toU32(w347)
  const x348: u32 = toU32(w347 >> 32)
  const w349: u64 = p256FiatAddcarryxU32(x348, x301, x332)
  const x349: u32 = toU32(w349)
  const x350: u32 = toU32(w349 >> 32)
  const w351: u64 = p256FiatAddcarryxU32(x350, x303, x334)
  const x351: u32 = toU32(w351)
  const x352: u32 = toU32(w351 >> 32)
  const w353: u64 = p256FiatAddcarryxU32(x352, x305, x336)
  const x353: u32 = toU32(w353)
  const x354: u32 = toU32(w353 >> 32)
  const w355: u64 = p256FiatAddcarryxU32(x354, x307, x338)
  const x355: u32 = toU32(w355)
  const x356: u32 = toU32(w355 >> 32)
  const w357: u64 = p256FiatAddcarryxU32(x356, x309, x340)
  const x357: u32 = toU32(w357)
  const x358: u32 = toU32(w357 >> 32)
  const w359: u64 = p256FiatAddcarryxU32(x358, x311, x342)
  const x359: u32 = toU32(w359)
  const x360: u32 = toU32(w359 >> 32)
  const w361: u64 = p256FiatAddcarryxU32(x360, x313, x344)
  const x361: u32 = toU32(w361)
  const x362: u32 = toU32(w361 >> 32)
  const w363: u64 = p256FiatMulxU32(x345, 0xffffffff)
  const x363: u32 = toU32(w363)
  const x364: u32 = toU32(w363 >> 32)
  const w365: u64 = p256FiatMulxU32(x345, 0xffffffff)
  const x365: u32 = toU32(w365)
  const x366: u32 = toU32(w365 >> 32)
  const w367: u64 = p256FiatMulxU32(x345, 0xffffffff)
  const x367: u32 = toU32(w367)
  const x368: u32 = toU32(w367 >> 32)
  const w369: u64 = p256FiatMulxU32(x345, 0xffffffff)
  const x369: u32 = toU32(w369)
  const x370: u32 = toU32(w369 >> 32)
  const w371: u64 = p256FiatAddcarryxU32(0x0, x370, x367)
  const x371: u32 = toU32(w371)
  const x372: u32 = toU32(w371 >> 32)
  const w373: u64 = p256FiatAddcarryxU32(x372, x368, x365)
  const x373: u32 = toU32(w373)
  const x374: u32 = toU32(w373 >> 32)
  const x375: u32 = x374 + x366
  const w376: u64 = p256FiatAddcarryxU32(0x0, x345, x369)
  const x377: u32 = toU32(w376 >> 32)
  const w378: u64 = p256FiatAddcarryxU32(x377, x347, x371)
  const x378: u32 = toU32(w378)
  const x379: u32 = toU32(w378 >> 32)
  const w380: u64 = p256FiatAddcarryxU32(x379, x349, x373)
  const x380: u32 = toU32(w380)
  const x381: u32 = toU32(w380 >> 32)
  const w382: u64 = p256FiatAddcarryxU32(x381, x351, x375)
  const x382: u32 = toU32(w382)
  const x383: u32 = toU32(w382 >> 32)
  const w384: u64 = p256FiatAddcarryxU32(x383, x353, 0x0)
  const x384: u32 = toU32(w384)
  const x385: u32 = toU32(w384 >> 32)
  const w386: u64 = p256FiatAddcarryxU32(x385, x355, 0x0)
  const x386: u32 = toU32(w386)
  const x387: u32 = toU32(w386 >> 32)
  const w388: u64 = p256FiatAddcarryxU32(x387, x357, x345)
  const x388: u32 = toU32(w388)
  const x389: u32 = toU32(w388 >> 32)
  const w390: u64 = p256FiatAddcarryxU32(x389, x359, x363)
  const x390: u32 = toU32(w390)
  const x391: u32 = toU32(w390 >> 32)
  const w392: u64 = p256FiatAddcarryxU32(x391, x361, x364)
  const x392: u32 = toU32(w392)
  const x393: u32 = toU32(w392 >> 32)
  const x394: u32 = x393 + x362
  const w395: u64 = p256FiatMulxU32(x5, arg1Limb7)
  const x395: u32 = toU32(w395)
  const x396: u32 = toU32(w395 >> 32)
  const w397: u64 = p256FiatMulxU32(x5, arg1Limb6)
  const x397: u32 = toU32(w397)
  const x398: u32 = toU32(w397 >> 32)
  const w399: u64 = p256FiatMulxU32(x5, arg1Limb5)
  const x399: u32 = toU32(w399)
  const x400: u32 = toU32(w399 >> 32)
  const w401: u64 = p256FiatMulxU32(x5, arg1Limb4)
  const x401: u32 = toU32(w401)
  const x402: u32 = toU32(w401 >> 32)
  const w403: u64 = p256FiatMulxU32(x5, arg1Limb3)
  const x403: u32 = toU32(w403)
  const x404: u32 = toU32(w403 >> 32)
  const w405: u64 = p256FiatMulxU32(x5, arg1Limb2)
  const x405: u32 = toU32(w405)
  const x406: u32 = toU32(w405 >> 32)
  const w407: u64 = p256FiatMulxU32(x5, arg1Limb1)
  const x407: u32 = toU32(w407)
  const x408: u32 = toU32(w407 >> 32)
  const w409: u64 = p256FiatMulxU32(x5, arg1Limb0)
  const x409: u32 = toU32(w409)
  const x410: u32 = toU32(w409 >> 32)
  const w411: u64 = p256FiatAddcarryxU32(0x0, x410, x407)
  const x411: u32 = toU32(w411)
  const x412: u32 = toU32(w411 >> 32)
  const w413: u64 = p256FiatAddcarryxU32(x412, x408, x405)
  const x413: u32 = toU32(w413)
  const x414: u32 = toU32(w413 >> 32)
  const w415: u64 = p256FiatAddcarryxU32(x414, x406, x403)
  const x415: u32 = toU32(w415)
  const x416: u32 = toU32(w415 >> 32)
  const w417: u64 = p256FiatAddcarryxU32(x416, x404, x401)
  const x417: u32 = toU32(w417)
  const x418: u32 = toU32(w417 >> 32)
  const w419: u64 = p256FiatAddcarryxU32(x418, x402, x399)
  const x419: u32 = toU32(w419)
  const x420: u32 = toU32(w419 >> 32)
  const w421: u64 = p256FiatAddcarryxU32(x420, x400, x397)
  const x421: u32 = toU32(w421)
  const x422: u32 = toU32(w421 >> 32)
  const w423: u64 = p256FiatAddcarryxU32(x422, x398, x395)
  const x423: u32 = toU32(w423)
  const x424: u32 = toU32(w423 >> 32)
  const x425: u32 = x424 + x396
  const w426: u64 = p256FiatAddcarryxU32(0x0, x378, x409)
  const x426: u32 = toU32(w426)
  const x427: u32 = toU32(w426 >> 32)
  const w428: u64 = p256FiatAddcarryxU32(x427, x380, x411)
  const x428: u32 = toU32(w428)
  const x429: u32 = toU32(w428 >> 32)
  const w430: u64 = p256FiatAddcarryxU32(x429, x382, x413)
  const x430: u32 = toU32(w430)
  const x431: u32 = toU32(w430 >> 32)
  const w432: u64 = p256FiatAddcarryxU32(x431, x384, x415)
  const x432: u32 = toU32(w432)
  const x433: u32 = toU32(w432 >> 32)
  const w434: u64 = p256FiatAddcarryxU32(x433, x386, x417)
  const x434: u32 = toU32(w434)
  const x435: u32 = toU32(w434 >> 32)
  const w436: u64 = p256FiatAddcarryxU32(x435, x388, x419)
  const x436: u32 = toU32(w436)
  const x437: u32 = toU32(w436 >> 32)
  const w438: u64 = p256FiatAddcarryxU32(x437, x390, x421)
  const x438: u32 = toU32(w438)
  const x439: u32 = toU32(w438 >> 32)
  const w440: u64 = p256FiatAddcarryxU32(x439, x392, x423)
  const x440: u32 = toU32(w440)
  const x441: u32 = toU32(w440 >> 32)
  const w442: u64 = p256FiatAddcarryxU32(x441, x394, x425)
  const x442: u32 = toU32(w442)
  const x443: u32 = toU32(w442 >> 32)
  const w444: u64 = p256FiatMulxU32(x426, 0xffffffff)
  const x444: u32 = toU32(w444)
  const x445: u32 = toU32(w444 >> 32)
  const w446: u64 = p256FiatMulxU32(x426, 0xffffffff)
  const x446: u32 = toU32(w446)
  const x447: u32 = toU32(w446 >> 32)
  const w448: u64 = p256FiatMulxU32(x426, 0xffffffff)
  const x448: u32 = toU32(w448)
  const x449: u32 = toU32(w448 >> 32)
  const w450: u64 = p256FiatMulxU32(x426, 0xffffffff)
  const x450: u32 = toU32(w450)
  const x451: u32 = toU32(w450 >> 32)
  const w452: u64 = p256FiatAddcarryxU32(0x0, x451, x448)
  const x452: u32 = toU32(w452)
  const x453: u32 = toU32(w452 >> 32)
  const w454: u64 = p256FiatAddcarryxU32(x453, x449, x446)
  const x454: u32 = toU32(w454)
  const x455: u32 = toU32(w454 >> 32)
  const x456: u32 = x455 + x447
  const w457: u64 = p256FiatAddcarryxU32(0x0, x426, x450)
  const x458: u32 = toU32(w457 >> 32)
  const w459: u64 = p256FiatAddcarryxU32(x458, x428, x452)
  const x459: u32 = toU32(w459)
  const x460: u32 = toU32(w459 >> 32)
  const w461: u64 = p256FiatAddcarryxU32(x460, x430, x454)
  const x461: u32 = toU32(w461)
  const x462: u32 = toU32(w461 >> 32)
  const w463: u64 = p256FiatAddcarryxU32(x462, x432, x456)
  const x463: u32 = toU32(w463)
  const x464: u32 = toU32(w463 >> 32)
  const w465: u64 = p256FiatAddcarryxU32(x464, x434, 0x0)
  const x465: u32 = toU32(w465)
  const x466: u32 = toU32(w465 >> 32)
  const w467: u64 = p256FiatAddcarryxU32(x466, x436, 0x0)
  const x467: u32 = toU32(w467)
  const x468: u32 = toU32(w467 >> 32)
  const w469: u64 = p256FiatAddcarryxU32(x468, x438, x426)
  const x469: u32 = toU32(w469)
  const x470: u32 = toU32(w469 >> 32)
  const w471: u64 = p256FiatAddcarryxU32(x470, x440, x444)
  const x471: u32 = toU32(w471)
  const x472: u32 = toU32(w471 >> 32)
  const w473: u64 = p256FiatAddcarryxU32(x472, x442, x445)
  const x473: u32 = toU32(w473)
  const x474: u32 = toU32(w473 >> 32)
  const x475: u32 = x474 + x443
  const w476: u64 = p256FiatMulxU32(x6, arg1Limb7)
  const x476: u32 = toU32(w476)
  const x477: u32 = toU32(w476 >> 32)
  const w478: u64 = p256FiatMulxU32(x6, arg1Limb6)
  const x478: u32 = toU32(w478)
  const x479: u32 = toU32(w478 >> 32)
  const w480: u64 = p256FiatMulxU32(x6, arg1Limb5)
  const x480: u32 = toU32(w480)
  const x481: u32 = toU32(w480 >> 32)
  const w482: u64 = p256FiatMulxU32(x6, arg1Limb4)
  const x482: u32 = toU32(w482)
  const x483: u32 = toU32(w482 >> 32)
  const w484: u64 = p256FiatMulxU32(x6, arg1Limb3)
  const x484: u32 = toU32(w484)
  const x485: u32 = toU32(w484 >> 32)
  const w486: u64 = p256FiatMulxU32(x6, arg1Limb2)
  const x486: u32 = toU32(w486)
  const x487: u32 = toU32(w486 >> 32)
  const w488: u64 = p256FiatMulxU32(x6, arg1Limb1)
  const x488: u32 = toU32(w488)
  const x489: u32 = toU32(w488 >> 32)
  const w490: u64 = p256FiatMulxU32(x6, arg1Limb0)
  const x490: u32 = toU32(w490)
  const x491: u32 = toU32(w490 >> 32)
  const w492: u64 = p256FiatAddcarryxU32(0x0, x491, x488)
  const x492: u32 = toU32(w492)
  const x493: u32 = toU32(w492 >> 32)
  const w494: u64 = p256FiatAddcarryxU32(x493, x489, x486)
  const x494: u32 = toU32(w494)
  const x495: u32 = toU32(w494 >> 32)
  const w496: u64 = p256FiatAddcarryxU32(x495, x487, x484)
  const x496: u32 = toU32(w496)
  const x497: u32 = toU32(w496 >> 32)
  const w498: u64 = p256FiatAddcarryxU32(x497, x485, x482)
  const x498: u32 = toU32(w498)
  const x499: u32 = toU32(w498 >> 32)
  const w500: u64 = p256FiatAddcarryxU32(x499, x483, x480)
  const x500: u32 = toU32(w500)
  const x501: u32 = toU32(w500 >> 32)
  const w502: u64 = p256FiatAddcarryxU32(x501, x481, x478)
  const x502: u32 = toU32(w502)
  const x503: u32 = toU32(w502 >> 32)
  const w504: u64 = p256FiatAddcarryxU32(x503, x479, x476)
  const x504: u32 = toU32(w504)
  const x505: u32 = toU32(w504 >> 32)
  const x506: u32 = x505 + x477
  const w507: u64 = p256FiatAddcarryxU32(0x0, x459, x490)
  const x507: u32 = toU32(w507)
  const x508: u32 = toU32(w507 >> 32)
  const w509: u64 = p256FiatAddcarryxU32(x508, x461, x492)
  const x509: u32 = toU32(w509)
  const x510: u32 = toU32(w509 >> 32)
  const w511: u64 = p256FiatAddcarryxU32(x510, x463, x494)
  const x511: u32 = toU32(w511)
  const x512: u32 = toU32(w511 >> 32)
  const w513: u64 = p256FiatAddcarryxU32(x512, x465, x496)
  const x513: u32 = toU32(w513)
  const x514: u32 = toU32(w513 >> 32)
  const w515: u64 = p256FiatAddcarryxU32(x514, x467, x498)
  const x515: u32 = toU32(w515)
  const x516: u32 = toU32(w515 >> 32)
  const w517: u64 = p256FiatAddcarryxU32(x516, x469, x500)
  const x517: u32 = toU32(w517)
  const x518: u32 = toU32(w517 >> 32)
  const w519: u64 = p256FiatAddcarryxU32(x518, x471, x502)
  const x519: u32 = toU32(w519)
  const x520: u32 = toU32(w519 >> 32)
  const w521: u64 = p256FiatAddcarryxU32(x520, x473, x504)
  const x521: u32 = toU32(w521)
  const x522: u32 = toU32(w521 >> 32)
  const w523: u64 = p256FiatAddcarryxU32(x522, x475, x506)
  const x523: u32 = toU32(w523)
  const x524: u32 = toU32(w523 >> 32)
  const w525: u64 = p256FiatMulxU32(x507, 0xffffffff)
  const x525: u32 = toU32(w525)
  const x526: u32 = toU32(w525 >> 32)
  const w527: u64 = p256FiatMulxU32(x507, 0xffffffff)
  const x527: u32 = toU32(w527)
  const x528: u32 = toU32(w527 >> 32)
  const w529: u64 = p256FiatMulxU32(x507, 0xffffffff)
  const x529: u32 = toU32(w529)
  const x530: u32 = toU32(w529 >> 32)
  const w531: u64 = p256FiatMulxU32(x507, 0xffffffff)
  const x531: u32 = toU32(w531)
  const x532: u32 = toU32(w531 >> 32)
  const w533: u64 = p256FiatAddcarryxU32(0x0, x532, x529)
  const x533: u32 = toU32(w533)
  const x534: u32 = toU32(w533 >> 32)
  const w535: u64 = p256FiatAddcarryxU32(x534, x530, x527)
  const x535: u32 = toU32(w535)
  const x536: u32 = toU32(w535 >> 32)
  const x537: u32 = x536 + x528
  const w538: u64 = p256FiatAddcarryxU32(0x0, x507, x531)
  const x539: u32 = toU32(w538 >> 32)
  const w540: u64 = p256FiatAddcarryxU32(x539, x509, x533)
  const x540: u32 = toU32(w540)
  const x541: u32 = toU32(w540 >> 32)
  const w542: u64 = p256FiatAddcarryxU32(x541, x511, x535)
  const x542: u32 = toU32(w542)
  const x543: u32 = toU32(w542 >> 32)
  const w544: u64 = p256FiatAddcarryxU32(x543, x513, x537)
  const x544: u32 = toU32(w544)
  const x545: u32 = toU32(w544 >> 32)
  const w546: u64 = p256FiatAddcarryxU32(x545, x515, 0x0)
  const x546: u32 = toU32(w546)
  const x547: u32 = toU32(w546 >> 32)
  const w548: u64 = p256FiatAddcarryxU32(x547, x517, 0x0)
  const x548: u32 = toU32(w548)
  const x549: u32 = toU32(w548 >> 32)
  const w550: u64 = p256FiatAddcarryxU32(x549, x519, x507)
  const x550: u32 = toU32(w550)
  const x551: u32 = toU32(w550 >> 32)
  const w552: u64 = p256FiatAddcarryxU32(x551, x521, x525)
  const x552: u32 = toU32(w552)
  const x553: u32 = toU32(w552 >> 32)
  const w554: u64 = p256FiatAddcarryxU32(x553, x523, x526)
  const x554: u32 = toU32(w554)
  const x555: u32 = toU32(w554 >> 32)
  const x556: u32 = x555 + x524
  const w557: u64 = p256FiatMulxU32(x7, arg1Limb7)
  const x557: u32 = toU32(w557)
  const x558: u32 = toU32(w557 >> 32)
  const w559: u64 = p256FiatMulxU32(x7, arg1Limb6)
  const x559: u32 = toU32(w559)
  const x560: u32 = toU32(w559 >> 32)
  const w561: u64 = p256FiatMulxU32(x7, arg1Limb5)
  const x561: u32 = toU32(w561)
  const x562: u32 = toU32(w561 >> 32)
  const w563: u64 = p256FiatMulxU32(x7, arg1Limb4)
  const x563: u32 = toU32(w563)
  const x564: u32 = toU32(w563 >> 32)
  const w565: u64 = p256FiatMulxU32(x7, arg1Limb3)
  const x565: u32 = toU32(w565)
  const x566: u32 = toU32(w565 >> 32)
  const w567: u64 = p256FiatMulxU32(x7, arg1Limb2)
  const x567: u32 = toU32(w567)
  const x568: u32 = toU32(w567 >> 32)
  const w569: u64 = p256FiatMulxU32(x7, arg1Limb1)
  const x569: u32 = toU32(w569)
  const x570: u32 = toU32(w569 >> 32)
  const w571: u64 = p256FiatMulxU32(x7, arg1Limb0)
  const x571: u32 = toU32(w571)
  const x572: u32 = toU32(w571 >> 32)
  const w573: u64 = p256FiatAddcarryxU32(0x0, x572, x569)
  const x573: u32 = toU32(w573)
  const x574: u32 = toU32(w573 >> 32)
  const w575: u64 = p256FiatAddcarryxU32(x574, x570, x567)
  const x575: u32 = toU32(w575)
  const x576: u32 = toU32(w575 >> 32)
  const w577: u64 = p256FiatAddcarryxU32(x576, x568, x565)
  const x577: u32 = toU32(w577)
  const x578: u32 = toU32(w577 >> 32)
  const w579: u64 = p256FiatAddcarryxU32(x578, x566, x563)
  const x579: u32 = toU32(w579)
  const x580: u32 = toU32(w579 >> 32)
  const w581: u64 = p256FiatAddcarryxU32(x580, x564, x561)
  const x581: u32 = toU32(w581)
  const x582: u32 = toU32(w581 >> 32)
  const w583: u64 = p256FiatAddcarryxU32(x582, x562, x559)
  const x583: u32 = toU32(w583)
  const x584: u32 = toU32(w583 >> 32)
  const w585: u64 = p256FiatAddcarryxU32(x584, x560, x557)
  const x585: u32 = toU32(w585)
  const x586: u32 = toU32(w585 >> 32)
  const x587: u32 = x586 + x558
  const w588: u64 = p256FiatAddcarryxU32(0x0, x540, x571)
  const x588: u32 = toU32(w588)
  const x589: u32 = toU32(w588 >> 32)
  const w590: u64 = p256FiatAddcarryxU32(x589, x542, x573)
  const x590: u32 = toU32(w590)
  const x591: u32 = toU32(w590 >> 32)
  const w592: u64 = p256FiatAddcarryxU32(x591, x544, x575)
  const x592: u32 = toU32(w592)
  const x593: u32 = toU32(w592 >> 32)
  const w594: u64 = p256FiatAddcarryxU32(x593, x546, x577)
  const x594: u32 = toU32(w594)
  const x595: u32 = toU32(w594 >> 32)
  const w596: u64 = p256FiatAddcarryxU32(x595, x548, x579)
  const x596: u32 = toU32(w596)
  const x597: u32 = toU32(w596 >> 32)
  const w598: u64 = p256FiatAddcarryxU32(x597, x550, x581)
  const x598: u32 = toU32(w598)
  const x599: u32 = toU32(w598 >> 32)
  const w600: u64 = p256FiatAddcarryxU32(x599, x552, x583)
  const x600: u32 = toU32(w600)
  const x601: u32 = toU32(w600 >> 32)
  const w602: u64 = p256FiatAddcarryxU32(x601, x554, x585)
  const x602: u32 = toU32(w602)
  const x603: u32 = toU32(w602 >> 32)
  const w604: u64 = p256FiatAddcarryxU32(x603, x556, x587)
  const x604: u32 = toU32(w604)
  const x605: u32 = toU32(w604 >> 32)
  const w606: u64 = p256FiatMulxU32(x588, 0xffffffff)
  const x606: u32 = toU32(w606)
  const x607: u32 = toU32(w606 >> 32)
  const w608: u64 = p256FiatMulxU32(x588, 0xffffffff)
  const x608: u32 = toU32(w608)
  const x609: u32 = toU32(w608 >> 32)
  const w610: u64 = p256FiatMulxU32(x588, 0xffffffff)
  const x610: u32 = toU32(w610)
  const x611: u32 = toU32(w610 >> 32)
  const w612: u64 = p256FiatMulxU32(x588, 0xffffffff)
  const x612: u32 = toU32(w612)
  const x613: u32 = toU32(w612 >> 32)
  const w614: u64 = p256FiatAddcarryxU32(0x0, x613, x610)
  const x614: u32 = toU32(w614)
  const x615: u32 = toU32(w614 >> 32)
  const w616: u64 = p256FiatAddcarryxU32(x615, x611, x608)
  const x616: u32 = toU32(w616)
  const x617: u32 = toU32(w616 >> 32)
  const x618: u32 = x617 + x609
  const w619: u64 = p256FiatAddcarryxU32(0x0, x588, x612)
  const x620: u32 = toU32(w619 >> 32)
  const w621: u64 = p256FiatAddcarryxU32(x620, x590, x614)
  const x621: u32 = toU32(w621)
  const x622: u32 = toU32(w621 >> 32)
  const w623: u64 = p256FiatAddcarryxU32(x622, x592, x616)
  const x623: u32 = toU32(w623)
  const x624: u32 = toU32(w623 >> 32)
  const w625: u64 = p256FiatAddcarryxU32(x624, x594, x618)
  const x625: u32 = toU32(w625)
  const x626: u32 = toU32(w625 >> 32)
  const w627: u64 = p256FiatAddcarryxU32(x626, x596, 0x0)
  const x627: u32 = toU32(w627)
  const x628: u32 = toU32(w627 >> 32)
  const w629: u64 = p256FiatAddcarryxU32(x628, x598, 0x0)
  const x629: u32 = toU32(w629)
  const x630: u32 = toU32(w629 >> 32)
  const w631: u64 = p256FiatAddcarryxU32(x630, x600, x588)
  const x631: u32 = toU32(w631)
  const x632: u32 = toU32(w631 >> 32)
  const w633: u64 = p256FiatAddcarryxU32(x632, x602, x606)
  const x633: u32 = toU32(w633)
  const x634: u32 = toU32(w633 >> 32)
  const w635: u64 = p256FiatAddcarryxU32(x634, x604, x607)
  const x635: u32 = toU32(w635)
  const x636: u32 = toU32(w635 >> 32)
  const x637: u32 = x636 + x605
  const w638: u64 = p256FiatSubborrowxU32(0x0, x621, 0xffffffff)
  const x638: u32 = toU32(w638)
  const x639: u32 = toU32(w638 >> 32)
  const w640: u64 = p256FiatSubborrowxU32(x639, x623, 0xffffffff)
  const x640: u32 = toU32(w640)
  const x641: u32 = toU32(w640 >> 32)
  const w642: u64 = p256FiatSubborrowxU32(x641, x625, 0xffffffff)
  const x642: u32 = toU32(w642)
  const x643: u32 = toU32(w642 >> 32)
  const w644: u64 = p256FiatSubborrowxU32(x643, x627, 0x0)
  const x644: u32 = toU32(w644)
  const x645: u32 = toU32(w644 >> 32)
  const w646: u64 = p256FiatSubborrowxU32(x645, x629, 0x0)
  const x646: u32 = toU32(w646)
  const x647: u32 = toU32(w646 >> 32)
  const w648: u64 = p256FiatSubborrowxU32(x647, x631, 0x0)
  const x648: u32 = toU32(w648)
  const x649: u32 = toU32(w648 >> 32)
  const w650: u64 = p256FiatSubborrowxU32(x649, x633, 0x1)
  const x650: u32 = toU32(w650)
  const x651: u32 = toU32(w650 >> 32)
  const w652: u64 = p256FiatSubborrowxU32(x651, x635, 0xffffffff)
  const x652: u32 = toU32(w652)
  const x653: u32 = toU32(w652 >> 32)
  const w654: u64 = p256FiatSubborrowxU32(x653, x637, 0x0)
  const x655: u32 = toU32(w654 >> 32)
  const x656: u32 = p256FiatCmovznzU32(x655, x638, x621)
  const x657: u32 = p256FiatCmovznzU32(x655, x640, x623)
  const x658: u32 = p256FiatCmovznzU32(x655, x642, x625)
  const x659: u32 = p256FiatCmovznzU32(x655, x644, x627)
  const x660: u32 = p256FiatCmovznzU32(x655, x646, x629)
  const x661: u32 = p256FiatCmovznzU32(x655, x648, x631)
  const x662: u32 = p256FiatCmovznzU32(x655, x650, x633)
  const x663: u32 = p256FiatCmovznzU32(x655, x652, x635)
  out1[0] = x656
  out1[1] = x657
  out1[2] = x658
  out1[3] = x659
  out1[4] = x660
  out1[5] = x661
  out1[6] = x662
  out1[7] = x663
}

/** fiat's `fiat_p256_add`: adds two field elements in the Montgomery domain. */
const p256FiatAdd = (out1: u32[], arg1: u32[], arg2: u32[]): void => {
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
  const w17: u64 = p256FiatSubborrowxU32(0x0, x1, 0xffffffff)
  const x17: u32 = toU32(w17)
  const x18: u32 = toU32(w17 >> 32)
  const w19: u64 = p256FiatSubborrowxU32(x18, x3, 0xffffffff)
  const x19: u32 = toU32(w19)
  const x20: u32 = toU32(w19 >> 32)
  const w21: u64 = p256FiatSubborrowxU32(x20, x5, 0xffffffff)
  const x21: u32 = toU32(w21)
  const x22: u32 = toU32(w21 >> 32)
  const w23: u64 = p256FiatSubborrowxU32(x22, x7, 0x0)
  const x23: u32 = toU32(w23)
  const x24: u32 = toU32(w23 >> 32)
  const w25: u64 = p256FiatSubborrowxU32(x24, x9, 0x0)
  const x25: u32 = toU32(w25)
  const x26: u32 = toU32(w25 >> 32)
  const w27: u64 = p256FiatSubborrowxU32(x26, x11, 0x0)
  const x27: u32 = toU32(w27)
  const x28: u32 = toU32(w27 >> 32)
  const w29: u64 = p256FiatSubborrowxU32(x28, x13, 0x1)
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

/** fiat's `fiat_p256_sub`: subtracts two field elements in the Montgomery domain. */
const p256FiatSub = (out1: u32[], arg1: u32[], arg2: u32[]): void => {
  if (toI32(out1.length) < 8 || toI32(arg1.length) < 8 || toI32(arg2.length) < 8) {
    return
  }
  const w1: u64 = p256FiatSubborrowxU32(0x0, arg1[0], arg2[0])
  const x1: u32 = toU32(w1)
  const x2: u32 = toU32(w1 >> 32)
  const w3: u64 = p256FiatSubborrowxU32(x2, arg1[1], arg2[1])
  const x3: u32 = toU32(w3)
  const x4: u32 = toU32(w3 >> 32)
  const w5: u64 = p256FiatSubborrowxU32(x4, arg1[2], arg2[2])
  const x5: u32 = toU32(w5)
  const x6: u32 = toU32(w5 >> 32)
  const w7: u64 = p256FiatSubborrowxU32(x6, arg1[3], arg2[3])
  const x7: u32 = toU32(w7)
  const x8: u32 = toU32(w7 >> 32)
  const w9: u64 = p256FiatSubborrowxU32(x8, arg1[4], arg2[4])
  const x9: u32 = toU32(w9)
  const x10: u32 = toU32(w9 >> 32)
  const w11: u64 = p256FiatSubborrowxU32(x10, arg1[5], arg2[5])
  const x11: u32 = toU32(w11)
  const x12: u32 = toU32(w11 >> 32)
  const w13: u64 = p256FiatSubborrowxU32(x12, arg1[6], arg2[6])
  const x13: u32 = toU32(w13)
  const x14: u32 = toU32(w13 >> 32)
  const w15: u64 = p256FiatSubborrowxU32(x14, arg1[7], arg2[7])
  const x15: u32 = toU32(w15)
  const x16: u32 = toU32(w15 >> 32)
  const x17: u32 = p256FiatCmovznzU32(x16, 0x0, 0xffffffff)
  const w18: u64 = p256FiatAddcarryxU32(0x0, x1, x17)
  const x18: u32 = toU32(w18)
  const x19: u32 = toU32(w18 >> 32)
  const w20: u64 = p256FiatAddcarryxU32(x19, x3, x17)
  const x20: u32 = toU32(w20)
  const x21: u32 = toU32(w20 >> 32)
  const w22: u64 = p256FiatAddcarryxU32(x21, x5, x17)
  const x22: u32 = toU32(w22)
  const x23: u32 = toU32(w22 >> 32)
  const w24: u64 = p256FiatAddcarryxU32(x23, x7, 0x0)
  const x24: u32 = toU32(w24)
  const x25: u32 = toU32(w24 >> 32)
  const w26: u64 = p256FiatAddcarryxU32(x25, x9, 0x0)
  const x26: u32 = toU32(w26)
  const x27: u32 = toU32(w26 >> 32)
  const w28: u64 = p256FiatAddcarryxU32(x27, x11, 0x0)
  const x28: u32 = toU32(w28)
  const x29: u32 = toU32(w28 >> 32)
  const w30: u64 = p256FiatAddcarryxU32(x29, x13, x17 & 0x1)
  const x30: u32 = toU32(w30)
  const x31: u32 = toU32(w30 >> 32)
  const w32: u64 = p256FiatAddcarryxU32(x31, x15, x17)
  const x32: u32 = toU32(w32)
  out1[0] = x18
  out1[1] = x20
  out1[2] = x22
  out1[3] = x24
  out1[4] = x26
  out1[5] = x28
  out1[6] = x30
  out1[7] = x32
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

/** fiat's `fiat_p256_scalar_set_one`: returns the field element one in the Montgomery domain. */
const p256FiatScalarSetOne = (out1: u32[]): void => {
  if (toI32(out1.length) < 8) {
    return
  }
  out1[0] = 0x39cdaaf
  out1[1] = 0xc46353d
  out1[2] = 0x58e8617b
  out1[3] = 0x43190552
  out1[4] = 0x0
  out1[5] = 0x0
  out1[6] = 0xffffffff
  out1[7] = 0x0
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

/** The group order n (SEC 2 §2.4.2), as plain limbs. */
const p256Order = (): u32[] => {
  const out: u32[] = p256Limbs()
  p256SetLimbs(out, 0xfc632551, 0xf3b9cac2, 0xa7179e84, 0xbce6faad, 0xffffffff, 0xffffffff, 0, 0xffffffff)
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

/**
 * Whether bit `i` (0 the least significant) of the plain limbs `e` is set.
 * Only ever asked of a public exponent.
 */
const p256Bit = (e: u32[], i: i32): boolean => {
  const limb: i32 = i >> 5
  if (limb < 0 || limb >= 8 || toI32(e.length) < 8) {
    return false
  }
  return ((e[limb] >> toU32(i & 31)) & 1) === 1
}

/**
 * `out = 1 / a` in the field, as `a^(p - 2)` (Fermat); zero for a zero `a`.
 * Square-and-multiply from the top bit: the branch is on the exponent's bits,
 * which are a constant.
 */
const p256FieldInvert = (out: u32[], a: u32[]): void => {
  const e: u32[] = p256Prime()
  e[0] = 0xfffffffd
  const acc: u32[] = p256Limbs()
  p256FiatSetOne(acc)
  for (let i: i32 = 255; i >= 0; i--) {
    p256FiatSquare(acc, acc)
    if (p256Bit(e, i)) {
      p256FiatMul(acc, acc, a)
    }
  }
  p256Copy(out, acc)
}

/**
 * `out = 1 / a` mod n, as `a^(n - 2)` with the scalar Montgomery multiply;
 * the exponent is public, so the square-and-multiply branches only on a
 * constant. Verification inverts s with it; the signer's `p256ScalarInverse`
 * is held to it bit for bit (`tests/link/crypto_p256_inverse`).
 */
const p256ScalarInvert = (out: u32[], a: u32[]): void => {
  const e: u32[] = p256Order()
  e[0] = 0xfc63254f
  const acc: u32[] = p256Limbs()
  p256FiatScalarSetOne(acc)
  for (let i: i32 = 255; i >= 0; i--) {
    p256FiatScalarMul(acc, acc, acc)
    if (p256Bit(e, i)) {
      p256FiatScalarMul(acc, acc, a)
    }
  }
  p256Copy(out, acc)
}

// ---- The nonce's inverse by safegcd -------------------------------------------
//
// Bernstein and Yang's constant-time inversion ("Fast constant-time gcd
// computation and modular inversion", 2019), as libsecp256k1's modinv32 writes
// it for 32-bit targets (MIT, std/crypto/LICENSE-libsecp256k1): the functions
// below are its secp256k1_modinv32_divsteps_30, _update_de_30, _update_fg_30,
// _normalize_30 and secp256k1_modinv32, with its scalar_8x32 conversions to and
// from signed-30, ported to Nish for the one modulus n. A value is nine limbs
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
 * `[d, e] = (t [d, e] + n [md, me]) / 2^30`, with `md` and `me` chosen so
 * that the division is exact: d and e stay in (-2n, n) and keep tracking f
 * and g modulo n (`secp256k1_modinv32_update_de_30`). The products are 32 by
 * 32 bits into 64.
 */
const p256UpdateDe30 = (d: u32[], e: u32[], t: u32[], n: u32[]): void => {
  if (toI32(d.length) < 9 || toI32(e.length) < 9 || toI32(t.length) < 4 || toI32(n.length) < 9) {
    return
  }
  const u: u64 = p256Wide(t[0])
  const v: u64 = p256Wide(t[1])
  const q: u64 = p256Wide(t[2])
  const r: u64 = p256Wide(t[3])
  // n^-1 mod 2^30, which makes the sum's bottom 30 bits zero below.
  const inverse30: u32 = 0x11ff43b1
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

/** Add n to the signed-30 `a` when `mask` is all ones, then carry so every limb but the last is in [0, 2^30). */
const p256AddOrder30 = (a: u32[], n: u32[], mask: u32, negate: u32): void => {
  if (toI32(a.length) < 9 || toI32(n.length) < 9) {
    return
  }
  for (let i: i32 = 0; i < 9; i++) {
    a[i] = (((a[i] + (n[i] & mask)) ^ negate) - negate)
  }
  for (let i: i32 = 1; i < 9; i++) {
    a[i] = a[i] + p256Shift30(a[i - 1])
    a[i - 1] = a[i - 1] & 0x3fffffff
  }
}

/**
 * `d` in (-2n, n) to [0, n), negated first when `sign`'s top bit is set: f
 * ended as -1 rather than 1 (`secp256k1_modinv32_normalize_30`).
 */
const p256Normalize30 = (d: u32[], sign: u32, n: u32[]): void => {
  if (toI32(d.length) < 9) {
    return
  }
  const zero: u32 = 0
  p256AddOrder30(d, n, p256SignMask(d[8]), p256SignMask(sign))
  p256AddOrder30(d, n, p256SignMask(d[8]), zero)
}

/**
 * `out = 1 / a` mod n for `a` in the Montgomery domain, zero for a zero `a`:
 * the signing paths' inversion of the nonce. Twenty batches of thirty divsteps
 * each: 600, past the 590 that bound any 256-bit input, so the count never
 * depends on `a`, and every step and update runs the same instructions on any
 * value. The divsteps invert `a R` as a plain number; one Montgomery multiply
 * by R^3 takes `(a R)^-1` to `a^-1 R`. f, g, d, e and the matrix are wiped
 * before it returns (ECC-2).
 */
const p256ScalarInverse = (out: u32[], a: u32[]): void => {
  const n: u32[] = p256Order30()
  const d: u32[] = new Array<u32>(9)
  const e: u32[] = new Array<u32>(9)
  const f: u32[] = p256Order30()
  const g: u32[] = new Array<u32>(9)
  const t: u32[] = new Array<u32>(4)
  e[0] = 1
  p256ToSigned30(g, a)
  // zeta = -(delta + 1/2), delta starting at 1/2.
  let zeta: u32 = 0xffffffff
  for (let i: i32 = 0; i < 20; i++) {
    zeta = p256Divsteps30(zeta, f[0], g[0], t)
    p256UpdateDe30(d, e, t, n)
    p256UpdateFg30(f, g, t)
  }
  // g is now 0 and f is 1 or -1, with d the inverse up to that sign; for a
  // zero `a`, f is n and d stays 0.
  p256Normalize30(d, f[8], n)
  p256FromSigned30(out, d)
  p256FiatScalarMul(out, out, p256ScalarR3())
  wipe(d)
  wipe(e)
  wipe(f)
  wipe(g)
  wipe(t)
}

/**
 * A point in projective coordinates (X : Y : Z), each coordinate a field
 * element in the Montgomery domain. It stands for the affine (X/Z, Y/Z), and
 * Z = 0 is the identity, which the complete formulas take like any other point.
 */
class P256ProjectivePoint {
  x: u32[]
  y: u32[]
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
  t0: u32[]
  t1: u32[]
  t2: u32[]
  t3: u32[]
  t4: u32[]
  sum: P256ProjectivePoint
  entry: P256ProjectivePoint
  b: u32[]

  constructor() {
    this.t0 = p256Limbs()
    this.t1 = p256Limbs()
    this.t2 = p256Limbs()
    this.t3 = p256Limbs()
    this.t4 = p256Limbs()
    this.sum = new P256ProjectivePoint()
    this.entry = new P256ProjectivePoint()
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
/**
 * The fixed-base comb table `p256BaseMult` reads: sub-table `c` (0 to 15),
 * entry `j` (1 to 15) at limb `(15c + j - 1) * 16`, is the affine point
 * (j_0 + j_1 2^64 + j_2 2^128 + j_3 2^192) 2^(4c) G, `j_b` bit `b` of `j`, as
 * X then Y in the Montgomery domain. Public: a function of G alone.
 */
const p256BaseTable = (): u32[] => [
  0x18a9143c, 0x79e730d4, 0x5fedb601, 0x75ba95fc, 0x77622510, 0x79fb732b, 0xa53755c6, 0x18905f76, 0xce95560a,
  0xddf25357, 0xba19e45c, 0x8b4ab8e4, 0xdd21f325, 0xd2e88688, 0x25885d85, 0x8571ff18, 0x16a0d2bb, 0x4f922fc5,
  0x1a623499, 0x0d5cc16c, 0x57c62c8b, 0x9241cf3a, 0xfd1b667f, 0x2f5e6961, 0xf5a01797, 0x5c15c70b, 0x60956192,
  0x3d20b44d, 0x071fdb52, 0x04911b37, 0x8d6f0f7b, 0xf648f916, 0xe137bbbc, 0x9e566847, 0x8a6a0bec, 0xe434469e,
  0x79d73463, 0xb1c42761, 0x133d0015, 0x5abe0285, 0xc04c7dab, 0x92aa837c, 0x43260c07, 0x573d9f4c, 0x78e6cc37,
  0x0c931562, 0x6b6f7383, 0x94bb725b, 0xbfe20925, 0x62a8c244, 0x8fdce867, 0x91c19ac3, 0xdd387063, 0x5a96a5d5,
  0x21d324f6, 0x61d587d4, 0xa37173ea, 0xe87673a2, 0x53778b65, 0x23848008, 0x05bab43e, 0x10f8441e, 0x4621efbe,
  0xfa11fe12, 0x2cb19ffd, 0x1c891f2b, 0xb1923c23, 0x01ba8d5b, 0x8ac5ca8e, 0xb6d03d67, 0x1f13bedc, 0x586eb04c,
  0x27e8ed09, 0x0c35c6e5, 0x1819ede2, 0x1e81a33c, 0x56c652fa, 0x278fd6c0, 0x70864f11, 0x19d5ac08, 0xd2b533d5,
  0x62577734, 0xa1bdddc0, 0x673b8af6, 0xa79ec293, 0x577e7c9a, 0xc3b266b1, 0xbb6de651, 0xb65259b3, 0xe7e9303a,
  0xd03a7480, 0xd6a0afd3, 0x9b3cfc27, 0xc5ac83d1, 0x5d18b99b, 0x60b4619a, 0x1ae5aa1c, 0xbd6a38e1, 0x49e73658,
  0xb8b7652b, 0xee5f87ed, 0x0b130014, 0xaeebffcd, 0x9d0f27b2, 0x7a730a55, 0xca924631, 0xddbbc83a, 0x9c955b2f,
  0xac019a71, 0x07c1dfe0, 0x356ec48d, 0x244a566d, 0xf4f8b16a, 0x56f8410e, 0xc47b266a, 0x97241afe, 0x6d9c87c1,
  0x0a406b8e, 0xcd42ab1b, 0x803f3e02, 0x04dbec69, 0x7f0309a8, 0x3bbad05f, 0xa83b85f7, 0xad8e197f, 0xc6097273,
  0x5067adc1, 0xc097440e, 0xc379ab34, 0x846a56f2, 0x841df8d1, 0xa8ee068b, 0x176c68ef, 0x20314459, 0x915f1f30,
  0xf1af32d5, 0x5d75bd50, 0x99c37531, 0xf72f67bc, 0x837cffba, 0x48d7723f, 0x0613a418, 0xe2d41c8b, 0x23d0f130,
  0xd5be5a2b, 0xed93e225, 0x5934f3c6, 0x6fe79983, 0x22626ffc, 0x43140926, 0x7990216a, 0x50bbb4d9, 0xe57ec63e,
  0x378191c6, 0x181dcdb2, 0x65422c40, 0x0236e0f6, 0x41a8099b, 0x01fe49c3, 0x2b100118, 0x9b391593, 0xfc68b5c5,
  0x598270fc, 0xc385f5a2, 0xd19adcbb, 0x7144f3aa, 0x83fbae0c, 0xdd558999, 0x74b82ff4, 0x93b88b8e, 0x71e734c9,
  0xd2e03c40, 0x43c0322a, 0x9a7a9eaf, 0x149d6041, 0xe6e4c551, 0x80ec21fe, 0x5fe14bfe, 0xc255be82, 0xf6ce116a,
  0x2f4a5d67, 0x98bc5a07, 0xdb7e63af, 0xfad27148, 0x29ab05b3, 0x90c0b6ac, 0x4e251ae6, 0x37a9a83c, 0xc2aade7d,
  0x0a7dc875, 0x9f0e1a84, 0x77387de3, 0xa56c0dd7, 0x1e9ecc49, 0x46086c74, 0xa5cffcd8, 0xf505aece, 0x8f7a1408,
  0xbef0c47e, 0xb37b85c0, 0xcc0e6a8f, 0x3596b6e4, 0x6b388f23, 0xfd6d4bbf, 0xc39cef4e, 0xaba453fa, 0xf9f628d5,
  0x9c135ac8, 0x95c8f8be, 0x0a1c7294, 0x3bf362bf, 0x2961c480, 0xdf63d4ac, 0x9e418403, 0x91ece900, 0xc109f9cb,
  0x58945705, 0xc2d095d0, 0xddeb85c0, 0xb9083d96, 0x7a40449b, 0x84692b8d, 0x2eee1ee1, 0x9bc3344f, 0x42913074,
  0x0d5ae356, 0x48a542b1, 0x55491b27, 0xb310732a, 0x469ca665, 0x5f1a4cc1, 0x29591d52, 0xb84f983f, 0xe76f5b6b,
  0x9f5f84e1, 0xbe7eef41, 0x80baa189, 0x1200d496, 0x18ef332c, 0x6376551f, 0x0bc6fb80, 0x808b0b65, 0x3ffe2e6b,
  0x5882e075, 0x2c83f549, 0xd5ef2f7c, 0x9103b723, 0x54d63c80, 0x52a23f9b, 0xf2f11bd6, 0x4b0b6587, 0x3670c319,
  0xb1580e9e, 0x55c4623b, 0x01efe220, 0x64edf7b2, 0xf5b343bc, 0x58af2010, 0xf2f142fe, 0x0f2e400a, 0xa85f4bdf,
  0x3483bfde, 0x03bfeaa9, 0xf0b1d093, 0xc7081603, 0x2ea01b95, 0x3dba1097, 0xe943e4c9, 0xb438f3a6, 0x47be92ad,
  0xe5bf6636, 0x00bb7742, 0x492bc95a, 0x717061e2, 0xfdb10087, 0xed2b3955, 0x727d4b2e, 0x878536b9, 0x0caa881b,
  0x849244fa, 0xe5f4ea0a, 0xaf2e65c7, 0x802680d4, 0xd2118940, 0x1a4babf5, 0x1e7d85d5, 0x5cc76086, 0xc1ce20e3,
  0xe48fb889, 0x6a7091c2, 0x7b8a9d06, 0x26882c13, 0x1b82a0e2, 0xa2498663, 0x3518152d, 0x844ed736, 0xd86e27c7,
  0x282f476f, 0x04afefdc, 0xa04edaca, 0x6119e34d, 0x8b256ebc, 0x0787d78b, 0x56a413e9, 0xe79b9b77, 0xcce3eab7,
  0x3933c815, 0x44b1f9eb, 0x9ec67e8b, 0x1f017601, 0xa15415ec, 0x660debe7, 0xf84f6c4e, 0xc49ec7fa, 0x721f7d41,
  0x56226f5e, 0xad7d54bc, 0x034174ea, 0xa55f8037, 0xefa077a4, 0xf75108de, 0x328ff4fe, 0x8a6a9dc9, 0x91740e8a,
  0xa202fb7e, 0x1847d47e, 0x5edbfacf, 0xa9d04fa1, 0x40cd7c19, 0xee23fe32, 0x78c229fb, 0xb4669b73, 0x3869c2f6,
  0x2819aca5, 0xb5c96085, 0xd653f05d, 0x6107115a, 0x168f3eff, 0x9a8c438a, 0x416bfc52, 0x849bb343, 0xf86328eb,
  0x29f4c1c4, 0x63072f96, 0x9664bf31, 0xa9fa892b, 0x5269e4ce, 0x69c52088, 0x8958f044, 0x064ef851, 0x9439cda8,
  0xb21bf983, 0x692ac542, 0x8303604f, 0x227b91d3, 0xf079ffe1, 0x15aaf9bd, 0x19f63e63, 0xf1f344fb, 0xf99ee565,
  0xd6219199, 0x8a1d661f, 0xd48ce41c, 0x8c883bc6, 0x3c74d904, 0x1065118f, 0x0faf8b1b, 0x713889ee, 0x6dbaacd8,
  0xc4d5ca2d, 0x3dc00d5f, 0x251f16ba, 0x69ada23e, 0x7e294cf6, 0x74281bb8, 0x8051a0fd, 0x260f928c, 0xd726f5db,
  0x40f31168, 0xab2425aa, 0xb4a911b5, 0x921498d8, 0x0f611044, 0x7c2f8272, 0x12c219b4, 0xece740a7, 0xe87f63a2,
  0x2745aec5, 0x09aba2fe, 0x47d5a921, 0xe86cd0ab, 0x87f5948f, 0x7180c826, 0x9dfca0dd, 0xf74023f2, 0x5fbfa60e,
  0xaf887afb, 0xa4cc0412, 0x94681a6c, 0x0cafd853, 0x318539e1, 0x6246fafb, 0xada9a75a, 0x2ef253e8, 0xd83accbd,
  0xd763016b, 0xca617a1c, 0x0139f615, 0xd281994e, 0x723087af, 0xeca0d5e2, 0x046fea4d, 0xc46c2cec, 0xb0e87754,
  0x27cc7450, 0x6f762cb5, 0x9febf21f, 0x21e5671a, 0x071dd1bb, 0x2539cab4, 0x7f4156b4, 0x73ad2bc4, 0xf10737ee,
  0x9d7c5267, 0x95acc35d, 0x93d85779, 0x911648d2, 0xc0eb18ad, 0x058ac5d8, 0xbd7720ad, 0x5f48bb8a, 0x09f42a6a,
  0xe042207b, 0xf3ce7109, 0x03af9a7d, 0x0d26f950, 0x547c9e61, 0x7d89313b, 0x25e1a21c, 0x58851410, 0xf7199a9e,
  0x44b98d8b, 0x8fd57923, 0x0a38867e, 0x0869e452, 0x90487017, 0xffe722d3, 0x310a74a6, 0x7f9b0239, 0x63f12dc3,
  0x46eda382, 0xcd25744a, 0xf2c6c1ad, 0x00de4447, 0xb5b1163e, 0x7d088476, 0x47f6433f, 0x5259e5a1, 0xa9d81957,
  0xc2004ab2, 0x1a16f58a, 0xc2dcd328, 0x8f865362, 0x6070bb81, 0x7482a889, 0x55ed5421, 0x3ad94297, 0x7c874697,
  0x526eb1d0, 0xd7a2d123, 0x6de620db, 0x990822f0, 0x4213a3e2, 0x1d2f9a4c, 0xbf28bb26, 0xd6c5cc43, 0xd621e3fc,
  0x7944ca3e, 0x663172e6, 0xdc2b2618, 0x696946fc, 0x486d8ffa, 0xb9cba56d, 0x50fbc6d8, 0x90f35a15, 0x7e3d423e,
  0xc0dd962c, 0x7c3da195, 0x3cfd5d8b, 0xe673fdb0, 0x889dfca5, 0x0704b7c2, 0xf52305aa, 0xf6ce581f, 0x914d5e53,
  0x399d49eb, 0xd005832a, 0x0db2fb5e, 0x91042e4f, 0x5f5efd3b, 0xed70f8ca, 0x8c4ffdc6, 0xb52da9cc, 0xe4645d0b,
  0xc9001d1f, 0x9596f58b, 0x4e117205, 0x52c8f0bc, 0xe398a084, 0xfd4aa0d2, 0x104f49de, 0x815bfe3a, 0x30af1053,
  0x664283ae, 0xcc93b904, 0x9a80886b, 0x691ba917, 0x51d9c2d2, 0x9044e4c9, 0x3b258bdc, 0xc80eebcd, 0x58caf1d3,
  0xf41b11e4, 0x97080530, 0xab9f8537, 0x2e59cdbc, 0x2f98c394, 0x3ef3e7c8, 0x846e364f, 0xc16c236e, 0xdea50ca0,
  0x7f33527c, 0x0926b86d, 0xc4810775, 0x0598e70c, 0x6c2a3609, 0xf024e924, 0xa6755e52, 0x9db4afca, 0xe0fa07a4,
  0x66831790, 0x15c3ce7d, 0xa6cbb0d6, 0x5b4ef350, 0xb4aba4d7, 0x355d7660, 0x9ac61be2, 0xeac600e1, 0xadf28187,
  0xa3609609, 0x186e5c6f, 0x96227ab0, 0xbfea853e, 0x37a1bb38, 0x6348b322, 0x3e23311c, 0x855285c7, 0xb4d7dae5,
  0x279570f8, 0x61e4abf1, 0x9fe571e2, 0xcd3a6f09, 0xa727241b, 0x7e2b98c8, 0x71a4495c, 0x79bfd367, 0x188c2cdb,
  0xe8dfc609, 0x98005dd4, 0xdf745f79, 0x1ad81c3f, 0x4c979f59, 0xc3a2d587, 0x948d24d0, 0xcfcec765, 0x7982d8d6,
  0x87cdb9d0, 0x28950f80, 0x14fdaa7c, 0x3c4de5b0, 0x6dfda881, 0x2b96630f, 0x93308d92, 0x1f5fe4b0, 0x83986698,
  0x1bc35296, 0xf48b6d2e, 0x55fb795c, 0xb9bc87b9, 0x0c6057a7, 0x67b162cb, 0xe087aaa9, 0x81fdad90, 0x25914f78,
  0x0d2cf6ab, 0xcf638f56, 0xcc054de5, 0xb90bc03f, 0x18b06350, 0x932811a7, 0x9bbd11ff, 0x2f00b330, 0xb4044974,
  0x76108a6f, 0xa851d266, 0x801bb9e0, 0xbf8990c1, 0x0dd099be, 0x3f23df13, 0xe9bc8663, 0xc7310fdc, 0x957c7ccf,
  0xe2f49de6, 0x76b6b19a, 0xa55cdaea, 0xa28a6099, 0x408587b7, 0xc159f236, 0xa86d2d86, 0x5551bf23, 0x6593d35b,
  0xaef3785b, 0xcf4cc993, 0x06cb373d, 0xc99bfa3c, 0x00e87860, 0x347ffd87, 0xe51b4996, 0x1521ec86, 0xace2d5f5,
  0x20d11525, 0xf04ad064, 0x11fdd77c, 0xbf6809bb, 0x80b9a491, 0xf9ad5a5a, 0x68e26ca2, 0xae2d0b06, 0x43a50244,
  0x4c6f408b, 0x3ad32771, 0x43b235ec, 0xc6764200, 0x14c43425, 0xe45331a6, 0xae92bd38, 0xde4e1376, 0x47c2b42e,
  0xdca1dfbf, 0x485b3d0b, 0x30d4bcf0, 0x167ab03f, 0x77ef1491, 0x76f93e73, 0x6aa6d8e9, 0x812c2301, 0xe4136bf5,
  0x5334f01e, 0xbfd073a2, 0x02bc1869, 0x1761b340, 0x7ed292da, 0x07e2d353, 0x758f85fa, 0x10466a92, 0x774f5cb8,
  0x257134cf, 0x9f731e22, 0x1c5c0281, 0x647bb7e5, 0xa534284a, 0xbf3ca638, 0xd4e225f5, 0x76a99ad0, 0xfecd0d0a,
  0x50a5c746, 0x2aeaeef7, 0x5f752e19, 0x2a7e3b6e, 0x39162456, 0xf020ef36, 0x0c6a8f12, 0xc5e148e0, 0x552eb531,
  0xf2e01311, 0x1dea53a9, 0xc5576768, 0xb8887803, 0xec5bbe91, 0xbbb7030d, 0x8d401059, 0x34a1f6a8, 0x55c3da6b,
  0x40ca7ee8, 0xa78f8c0a, 0xe7701154, 0xc2ff7cba, 0x616b7301, 0xb54e5556, 0x8290384d, 0xd091c35c, 0xdf971d6d,
  0x8592f335, 0x996f0327, 0xfc2b4e00, 0xf95684f7, 0xef571f04, 0x114521ac, 0x4abb78e3, 0x48d9b5ea, 0xda9891d8,
  0x3df9c7ba, 0x944cab81, 0x1ca68374, 0x76fdb53f, 0x98453f5b, 0xb1cd8a0e, 0x995789b8, 0xe42ce845, 0xafe5e48e,
  0xab4b35a2, 0x6772b0e5, 0xf5eeaacf, 0x1d8b6001, 0x795b9580, 0x728f7ce4, 0x41fb81da, 0x4a20ed2a, 0x4fec01e6,
  0x9f685cd4, 0xa7ff50ad, 0x3ed7ddcc, 0x0c2d97fd, 0x460fd264, 0xeb82f4f9, 0x3a241426, 0x97acf4ec, 0x3e22a7b3,
  0x5ea8b640, 0x0426c400, 0x4e969285, 0x5e3295a6, 0xa6a45670, 0x22aabc59, 0x5f5942bc, 0xb929714c, 0xfa3182ed,
  0x9a6168bd, 0x104152ba, 0x2216a665, 0xb6926368, 0x46908d03, 0x5ddf598a, 0xea262aa9, 0x845f36cc, 0x076d8f30,
  0xb4ee47ca, 0xec6bd09f, 0x74a45f72, 0x52f8aabe, 0xb6b52563, 0x76cd6bfc, 0x453a73e3, 0xb74ef1d6, 0xc09b38b8,
  0xdab3d489, 0x8260f2a4, 0xfe127fe4, 0xfa181e69, 0xef0a3fec, 0x30d69a98, 0x9ea02f81, 0x66eab95d, 0xb2e9cf8e,
  0x24720021, 0x520f2beb, 0x1df84361, 0x621c540a, 0x71fa6d5d, 0x12037721, 0x0ff5f6ff, 0x6e3c7b51, 0xabb2bef3,
  0x817a069b, 0x90e475ad, 0x11c67815, 0xb3d5dd6d, 0xe5896605, 0xafed38c7, 0xaaba94b8, 0x7e69b03d, 0xd04a17a6,
  0x35a866e7, 0xf004a55d, 0xa1b9cbde, 0x68053f8f, 0x95e055f9, 0xbd7d0da5, 0xdd776acb, 0x001fe5e0, 0xe4cc5a2f,
  0xe0bd60e5, 0xea3bea9c, 0xa1b0d70c, 0x2e977756, 0xbd3658ff, 0xb909fa31, 0x0f67db88, 0x8427e332, 0x6ddea819,
  0x642603ba, 0x4f21cdd2, 0xc0d37dd5, 0xff41867e, 0x229364de, 0x215c4f50, 0x0a4a8bd7, 0x1fb7918b, 0x108c9193,
  0xae76ec9b, 0x5664344b, 0xcf21b716, 0x0ced5add, 0x2f5ecea9, 0xbe0d176d, 0x304fe2c5, 0xe4d02617, 0x62b56606,
  0x2a005e0e, 0xf44d72e2, 0x53f66c85, 0xdb7af5bb, 0x060b5f61, 0xf431f462, 0x7bd057c2, 0xa56f46b4, 0x47e1bf65,
  0x348dca6c, 0x41bcf1ff, 0x9a38783e, 0xda710718, 0x7a5d33a9, 0x2e0aeaf6, 0x5a779987, 0x2d29d187, 0xca87314d,
  0xc687d733, 0xfa0edc3e, 0xe4f95225, 0x1b28e15a, 0x3df980e1, 0x4eb867f2, 0xacf4a4d9, 0x043eadd3, 0x2aa6ca92,
  0x9641d415, 0x342d695b, 0x841c4983, 0xa2335845, 0x6cece75a, 0x692a3765, 0xae9b262f, 0x9bd3d546, 0xe5e3935c,
  0x1c8955f8, 0xd6d12fb5, 0x05889204, 0x99d896eb, 0x252da333, 0x07b25abe, 0x9eae7fc0, 0x4c673c97, 0x4722592c,
  0x56f8a0ab, 0x117abed5, 0x93333d2f, 0x6bbb5aa2, 0x3db19b35, 0xc1015133, 0xf7d4b80b, 0x4331fdad, 0xccdf37ef,
  0xcb303da0, 0xf5dac1ab, 0x7cfdee8a, 0x15d317af, 0xa2e91c63, 0xfc50b381, 0xf235e580, 0x954267d2, 0x05a78396,
  0x7e21f4b0, 0xb0f5e0ea, 0xa13e74a2, 0xc8f91e3f, 0x6c323801, 0xebce481a, 0x65bec55b, 0x10398dfe, 0x2e4ee5d2,
  0x312baf40, 0xe62cd1a4, 0x427f944e, 0x1b83f749, 0x3c868075, 0xf030eddb, 0xae26e665, 0xf4656f11, 0x62ff0b26,
  0x5fe7821a, 0x25a8a91b, 0x61ffaefa, 0x3057665e, 0xd5a2d0cd, 0x43d6ebe6, 0xb782bcc3, 0x853579f0, 0x649acf14,
  0x9940863c, 0x097bd76c, 0xe19a7728, 0x3f637302, 0x0cdbc92a, 0xd39f7723, 0x511cf4d7, 0xae7e1231, 0x58ee7426,
  0xdd2a99d8, 0x3cfa7e56, 0xfdab2e12, 0x71f441dd, 0x985a984b, 0xae68d684, 0x6824fcf1, 0xc9e16bcd, 0x34960583,
  0x5d283337, 0xa6aabd92, 0xfcfd1be8, 0x13a4589e, 0xee836e7e, 0xabc81275, 0xf344cc96, 0xe6eeaff3, 0x4a2ac6d1,
  0x8b599423, 0xf2cbc64c, 0xfd8145a1, 0x5fd55356, 0x53bb6804, 0x3016dcfd, 0x56eeb1d8, 0x4e14d38c, 0xf93f71e4,
  0x916a2596, 0x51d5fc82, 0x925a14dd, 0x62e0204a, 0x2f4fd7c6, 0xc74a7c18, 0xe3779ee3, 0x0f0165fc, 0xbd495d9e,
  0xe00e7f9d, 0x20284e7a, 0x1fa4efa2, 0x47ac6219, 0x4564bade, 0xc4708e8e, 0x90e6312a, 0xa71e9adf, 0x4f5725fb,
  0x3d684b9f, 0xe95f55ae, 0x1e94b415, 0x47f7ccb1, 0xf1c367ca, 0xe4050f1c, 0xc90fbc7d, 0x9bc85a9b, 0xe1a11032,
  0xa373c4a2, 0xad0393a9, 0xb64232b7, 0x167dad29, 0xf5577eb0, 0x94b78ab2, 0x1604f301, 0xe829348b, 0x0baa94af,
  0x41654342, 0x77fbd8dd, 0xb65659b6, 0xf74b5ee5, 0x0de651de, 0x58d27206, 0x58635522, 0x9a06f93c, 0xb51b7153,
  0x1741dc84, 0x5e3b1cf2, 0xd74e2f48, 0xf2886a41, 0x71f6a8e9, 0x034d98f3, 0x0f719872, 0xbca289a6, 0xee792e37,
  0xc63c4962, 0x80531fe1, 0x981fdb25, 0x50541e89, 0xfd4c2b6b, 0xdc1291a1, 0xa6df4fca, 0xc0693a17, 0x0117f203,
  0xb2c4604e, 0x0a99b8d0, 0x245f1963, 0xc6212c44, 0xaedc20aa, 0x520f52a8, 0xb1ed4e56, 0x9673d875, 0x9da03662,
  0x3335f166, 0x47c5ce72, 0x54e58c2d, 0x24e892e3, 0x38845a00, 0x07228f01, 0x2f8855a7, 0xff9f34a2, 0xc4e307fc,
  0xf7d6d205, 0x3455bb93, 0xbcd425e2, 0x6d96414f, 0xd7cbb02c, 0x5e6b555b, 0x19b3edb4, 0xfd18da56, 0x958c797e,
  0xe98f9273, 0x22dd3354, 0x09cb54d9, 0x84212234, 0x7a6402ba, 0xe39ca71d, 0x9378f1de, 0x822d787c, 0x2beaa75d,
  0xaaf852d0, 0x510fc33a, 0xd8af72b4, 0x583f402b, 0xe4de6bd8, 0xb3481fdb, 0xede94383, 0x48d08e35, 0x924056d7,
  0xeabd2ecc, 0x8e349069, 0xe0d67374, 0x7b33363c, 0x2d8c05eb, 0x70e41945, 0x82d2ba0a, 0xb78a5b35, 0xe005d3e7,
  0x8490d830, 0xadf7cccf, 0x75d9bc15, 0xdfa1e1b0, 0x81a3e5d6, 0x249bc17e, 0x8c39e444, 0x8ea7fd43, 0xf37dccb2,
  0x907fba12, 0xda654873, 0x4a372904, 0x35daa6da, 0x6283a6c5, 0x0564cfc6, 0x4a9395bf, 0xd09fa4f6, 0x444a73f6,
  0x7b2c19d8, 0x6feee88a, 0xc88f4ce4, 0xd431d8d2, 0x9a1f7a70, 0xc1b25749, 0xae042119, 0x45b9ddf1, 0x467b64ce,
  0x689f927b, 0x45df2010, 0x01d12b64, 0xc874c671, 0xd4df95fe, 0xc4aca24d, 0x732325c7, 0xc660550e, 0xe3fe0994,
  0xd4d12681, 0xecfd8b7c, 0xffcfe8ed, 0x308e65b4, 0x858b5225, 0xdc162423, 0x9523f8b4, 0x24271a6b, 0x89507a80,
  0x658d58c5, 0xb4d2eaf6, 0xb9c205ed, 0x80e7ba28, 0x3c52ebb9, 0x46c06395, 0xd02f1e43, 0x7333d509, 0xb79ca51f,
  0x2d6b41fd, 0x23817a73, 0xb3b3d1dd, 0x1cf976a4, 0x1fdeddb4, 0x97b7bac8, 0x4be0fc0f, 0xa784d816, 0x1e638fd1,
  0xe439bf08, 0xfa4eaf60, 0x5fca6ff1, 0x8cb0c4ac, 0x4b607037, 0x9da506c2, 0x0db25734, 0x46e892ab, 0xdffb31b0,
  0x115fd8de, 0xc90eaaae, 0xd9135992, 0xeebf8578, 0xb41eeaa6, 0x7a389c05, 0xcb24be1e, 0xb1809587, 0x29971d57,
  0x418ef20c, 0x078a14ba, 0x824ba43d, 0x6a4cd780, 0xc442ac87, 0xe7447778, 0xd8bba232, 0x1c472aca, 0x44237888,
  0xb45c362f, 0x84ef1c00, 0x7b2c1676, 0x4500185c, 0x1e9f3c99, 0xcfb13db4, 0x8122fdd0, 0x6eff12e1, 0xe96e5c93,
  0x25e31583, 0x0abcc1da, 0xdc95f5f9, 0xc844e8cc, 0x301f27cf, 0x5a886b1b, 0xb7b385f0, 0x845d7086, 0x05090238,
  0x8d1c658c, 0x2c07960b, 0xcdd1b2a6, 0xee151588, 0xef902dcc, 0x0fea91e5, 0x85ff4f35, 0xaf91bda6, 0x32954682,
  0x8eeaafca, 0xfe1f173d, 0x2da4161b, 0x5badab63, 0xbf84e659, 0x2107bc51, 0xad86caa0, 0xf4368698, 0x6e9fbe0e,
  0x84ad8cf4, 0xb45a2551, 0xf7f134ad, 0x584c5e20, 0xa7a8746a, 0xb9dc7035, 0x267e4ea1, 0xb9548c9b, 0x593a15cf,
  0x4bd012f3, 0x5e6e2135, 0x8c8f936e, 0xdf31cc6a, 0xb5c241dc, 0x8af84d04, 0x345efb86, 0x63990a6f, 0xb9b962cb,
  0x6fef4e61, 0x87dec0e1, 0xe5aa692a, 0xf7b39d00, 0x010ded8d, 0x54cfa0b5, 0x7b1b80c8, 0xa0f8ea28, 0x66beb876,
  0x3476cd0e, 0x50d7f531, 0xb08d3949, 0xa63d0e65, 0x53479fc6, 0x1a09eea9, 0xf499e742, 0x82ae9891, 0xcafe34e9,
  0x930fbab8, 0xfaf8d02d, 0x8b33587b, 0x30db8762, 0x8c041f1c, 0x2370856f, 0x492048ca, 0x9c6cb54f, 0x8151d1aa,
  0xd8caa5a0, 0x1eba8b5b, 0xcf169ee5, 0x76bc6d33, 0x4e8b7981, 0xcb5b1d8a, 0x338d6e43, 0xecaff541, 0x4541d5cc,
  0x56f7dd73, 0x96bc88ca, 0xb5d426de, 0x9ed3a2c3, 0x48d94f6b, 0x2ef8279c, 0x6354a3bb, 0x0b1867f2, 0xd575465b,
  0x95225151, 0xef99b0ff, 0xf94500d8, 0xf3e19d88, 0xd7aaa073, 0x0f5f1057, 0x36c276db, 0xbbdad564, 0xfa3e5314,
  0x607ba0b9, 0xd4294870, 0xbe3d37d5, 0x00135f6c, 0xb20952f0, 0x35901230, 0x51ed6e5c, 0x5de179e9, 0x131ddbc6,
  0x4053e8b0, 0x0ba26c24, 0xddf1b03b, 0x5947e92d, 0xecff7413, 0xce76ac18, 0x03a21c67, 0x534798dc, 0xf4a61d51,
  0xd78496ec, 0x9d4e9a1a, 0x19c93947, 0x85a7643f, 0x66e6d3ea, 0xefab6bd8, 0x579370e7, 0x7062dc2c, 0x42ad8262,
  0x55af541e, 0x48b57cb4, 0x25ed55da, 0xffb93f22, 0x7ccc4e48, 0xd0fa817f, 0x5b0f1579, 0xfcc7f375, 0x8bcf3057,
  0xc2174926, 0x8bc81c11, 0xf252b716, 0xb4496bda, 0xbe6b96af, 0x6ab5bd65, 0x285df5ce, 0x0ebcf726, 0x103c46e6,
  0x6231470e, 0x4482b831, 0x487c2109, 0x6f6dfaca, 0x62e666ef, 0x2e0ace97, 0x1f8d1f42, 0x3246a9d3, 0x574944d2,
  0x1b1e83f1, 0xa57f334b, 0x13dfa63a, 0x9f025d81, 0x0cf8daed, 0xc7bc2f85, 0x26ba2bdd, 0x32dec41c, 0xc9e648b6,
  0xfc6a702d, 0xb041d057, 0xa61923e3, 0xdc6b67a8, 0x2ee75030, 0x36953013, 0xa56702a7, 0xe8f629ab, 0xff045ea3,
  0x4cc279c7, 0x97a42e5e, 0x5182e1c6, 0x3830cdd9, 0x38102852, 0x4a58937e, 0xc459844c, 0xa9f3bb5d, 0xe27f6491,
  0x6665a0db, 0x6da634dd, 0xc782a8be, 0xde95ae0b, 0x66d8b354, 0x42d01d10, 0x40d9ae3e, 0xa80812fe, 0xc6c740b5,
  0xdb7d946e, 0x64dcc9fc, 0xb8e91cf8, 0xa770615e, 0x3bdc86f4, 0x4b7c0092, 0xdf88dbdc, 0x8b831a86, 0xacc0b574,
  0xaea3ec1d, 0xe437cd0d, 0x35453527, 0xacd4d177, 0x0cce1aa8, 0x1a5bf055, 0xd11dce0d, 0xa9701b7b, 0x9dfd583b,
  0x3110f03d, 0x36f320cd, 0xd47088bc, 0xf022bf5d, 0x52bcfa18, 0xc0e616f7, 0xa66d5ba6, 0x36e50eee, 0x6a9f47e5,
  0xc6f7545d, 0xe438ea70, 0x9dafcc12, 0x771269d2, 0xd9c2282b, 0x7f90e30e, 0x2a70ac8a, 0xcb9ccd57, 0xd5503baa,
  0xe9aff801, 0xf83228cb, 0x9a8e261b, 0x72a10639, 0xa59fe1fe, 0xe2e5646d, 0xc0fc2b71, 0x84f2b4c5, 0xa1c87900,
  0xcb0be8d4, 0x3d61f821, 0x69b59d6e, 0x7ebeae3a, 0xba95ea76, 0x4d5821b2, 0xf034f97a, 0xb577d863, 0x53a9b4f7,
  0xea71aa81, 0x626d5850, 0x464d4bbc, 0xf3e25aec, 0xa65b8e8d, 0x30e18b9b, 0xf9b10fe7, 0xcbd5aa66, 0x25436661,
  0x0edadcbe, 0xaa183603, 0x585ce725, 0xaf6fd855, 0x2c3ad38a, 0x1a0ce8ab, 0xcaefdee5, 0x0a5b7032, 0xd64ef724,
  0x0e244c66, 0x3819187b, 0x3a330b7d, 0x8508511e, 0x66a4259b, 0xdbb3a201, 0xf3b22271, 0x1682e055, 0xf5571384,
  0x868af75d, 0xd9d0c8c4, 0x45c8c7ea, 0xd7325cff, 0xcc81ecb0, 0xab471996, 0x611824ed, 0xff5d55f3, 0x1977a0ee,
  0xbe314541, 0x722038c6, 0x5085c4c5, 0xf94bb495, 0x2d5335bf, 0xc8e2a082, 0x894ad8a6, 0xf79588c0, 0xa80d1db6,
  0xb55768cc, 0xfa52fc69, 0x7f54438a, 0x0b4df1ae, 0xf9b46a4f, 0x0cadd1a7, 0x1803dd6f, 0xb40ea6b3, 0x55eaae35,
  0x488e4fa5, 0x382e4e16, 0x9f047d55, 0x2f6e0c98, 0xc9b5b7e0, 0x5ee244e8, 0xcffcff77, 0x2c18c2c5, 0xbb62fee0,
  0xe8a0fada, 0x8f2d4a68, 0xae2b136b, 0x9fc23153, 0x6380179b, 0x9a2e3ca4, 0x32b9613f, 0x99edf1ef, 0x8eda79b5,
  0x8050cad5, 0xd3b630cc, 0x4249a3ff, 0x7189e71f, 0x32670d2f, 0x5ecf91e7, 0xc6438748, 0xdb757a21, 0x15758e57,
  0x290a9ce5, 0x427d09f8, 0x38384a7a, 0x846a308f, 0xb0732b99, 0xaac3acb4, 0x17845819, 0x9e941009, 0xa7ce5e03,
  0x95cba111, 0x674d4515, 0x7ecf3b31, 0xdcf3c04c, 0x52a5c474, 0xe3aab682, 0x161abef6, 0x2ce9c033, 0x5c24bd69,
  0xc605bf93, 0xd1ac15a6, 0x47a9e3a6, 0xf00b8a93, 0x5986ade3, 0xefb2a126, 0xfb89493b, 0xfc158f3b, 0xebd43774,
  0xeec3e34d, 0x835d2a16, 0xcd79a3d9, 0x9f47c615, 0x543e89c3, 0x14bdbd0c, 0x81f151fc, 0x0a24e3ff, 0x04931264,
  0x8d780e67, 0x8c0841de, 0x952d4cc7, 0x3ae4e553, 0x93c99c91, 0x22e1710a, 0xe107e98a, 0xf87397d3, 0xf031ffb1,
  0x28b3be02, 0x2da9f943, 0x03f1e586, 0x1c7d5327, 0x97829560, 0x21daf1e6, 0x7b930f52, 0xe2760d97, 0xbcc50a01,
  0x28fab177, 0xb8ac21fd, 0x192480d7, 0xbcdd3b5e, 0xe457a477, 0xa0158eea, 0xee6ddc05, 0xd19857db, 0x18c41671,
  0xb3265224, 0x3c2c0d58, 0x3ffdfc7e, 0x26ee7cda, 0x3a3a5254, 0xdf02c3a8, 0x341b0869, 0x723bbfc8, 0xa023bf42,
  0x14452691, 0x3d15002a, 0x8af3ceed, 0xaf7931a7, 0xe86814ad, 0x6811cfc1, 0xb4f03d83, 0x532a485b, 0xf761e54a,
  0x5499a002, 0x93f727b0, 0xdf4819a6, 0x4d529f4d, 0x10140491, 0x4fc44251, 0x0f0c8c00, 0xe3ee0074, 0x7d0b6305,
  0x8b6a59fe, 0x6ddd630c, 0xd1286983, 0xf221e433, 0x2113eac2, 0xcdbea310, 0xbd8533ad, 0xe972fc1c, 0x491870fd,
  0xcd0db09c, 0x54ae320d, 0x5f4ecab6, 0xc35c4fb3, 0x1016fbd1, 0x25e4cb1f, 0x78d1df22, 0x6e8c9b97, 0xf091b223,
  0x57f13f08, 0xee39b1b9, 0x99f60998, 0xc1d9f897, 0x78026534, 0x5ed2b176, 0xc7c0a727, 0x16991514, 0xda40f92f,
  0x6e17e142, 0xa7fc6664, 0x8e988460, 0xae7ca355, 0xbe9740f6, 0x675ea5fd, 0xb755a13a, 0xe548a53e, 0x7e16e100,
  0x4b1db8ef, 0xd53f7bc2, 0x14a73282, 0xaccc3898, 0xb74b3d14, 0x9c444783, 0x6f5fba65, 0x22965083, 0x13105032,
  0x3e576bd3, 0xd4e38cf9, 0xc5f6d8ce, 0x89a9ce49, 0xf9c282e6, 0xe652318c, 0x286d6557, 0xc567109c, 0xb04116a7,
  0x574e3941, 0xb40d2f0d, 0x465232af, 0x172217df, 0x593f8e37, 0x4f1473aa, 0xe6eddb53, 0x81ac4e9b, 0x34ba0407,
  0xba63cdcf, 0xdbe6718e, 0x78903e1e, 0x569f695d, 0xc08ce9a3, 0x07c1f4ad, 0x5e2aa546, 0x9fd00575, 0xc9a24900,
  0x9113aced, 0x3af797d8, 0xe253ed7e, 0x1b5d4123, 0x67a80542, 0x7dd10956, 0x3e2886b2, 0xe7781205, 0x1610cd52,
  0x0ed88310, 0x236a1040, 0x0da4dc01, 0x924a7203, 0x427ca1f2, 0xaafd3d7d, 0xa4737b77, 0x96a5ba97, 0x66275220,
  0x7ee66858, 0x87c05743, 0x37da5d39, 0xaeb7ce88, 0xd4ae3b19, 0xee946502, 0x20151427, 0x7f99824f, 0x92430206,
  0x206828b6, 0xe1112357, 0xaa9097d7, 0x09e414ec, 0xacf9a2f2, 0x27915356, 0xdbdac9da, 0x001efee3, 0x7e0734b7,
  0xd2b288e2, 0x54fab5bb, 0xf62dd09c, 0x4c630fc4, 0xbe24319a, 0xf92dda31, 0xe095a8e7, 0x03f7d28b, 0x98782185,
  0xa52fe840, 0x29c24dbc, 0x276ddafe, 0x1d7a64eb, 0x80cd5496, 0x7f1dbe42, 0xe4360889, 0x8438d2d5, 0x2f81a877,
  0x85169036, 0x7e4d52a8, 0x3e3b779e, 0xa2d8833d, 0xa667b2c3, 0x21dd8a53, 0xc9da1f25, 0x05fb5ec5, 0xf85dffeb,
  0xecb2468b, 0x271b8540, 0xc061f2f7, 0x41be795f, 0x003181cb, 0xbf6590ce, 0x5ee497ce, 0x9b9e69ae, 0x396ed24c,
  0xca8d9d1a, 0x488f1185, 0xd987ded2, 0xadf2c77d, 0x60c46124, 0x5f3039f0, 0x71e095f4, 0xe5d70b75, 0x6260e70f,
  0x82d58650, 0xf750d105, 0x39d75ea7, 0x75bac364, 0x8cf3d0b1, 0x21d01329, 0xf3a7564d, 0x5727c3cb, 0x1cd2f0af,
  0x874ed794, 0x67e40cda, 0xe86d4cd7, 0x2e8ee7be, 0x3abb5109, 0x0717bb23, 0xa8ebcf88, 0xa46260a6, 0x17268004,
  0x883f18ce, 0xb937c2e7, 0xad63ca96, 0x90a56a21, 0xd9a68a62, 0x0245263c, 0xcffe9420, 0x07526708, 0xdb53d24e,
  0x8b3f4961, 0x97292ed4, 0x8c38fd87, 0xd1a6ff3f, 0x533f1642, 0x08c1750d, 0x3a174e91, 0x734a973d, 0xa6ce129a,
  0x9215ba62, 0x38a5c9a0, 0xc4aa86b7, 0xebc26686, 0x0a5c25ba, 0x09a7fa96, 0xf64f0d18, 0x4cf891ce, 0x2e1a24b4,
  0x703fab1f, 0xa4e43d63, 0x27e7409f, 0x1454d426, 0xcafac378, 0x3a0b46c1, 0xa77e4b6e, 0x9d13839a, 0xce18d416,
  0xc08548e6, 0xc42bd6d2, 0xdb567d6a, 0xbb1f96ae, 0x6df86468, 0x4843b28e, 0x0efe5b1a, 0x6379b240, 0x961bbb05,
  0x70a6a26b, 0xb6caf5f0, 0x328e6e39, 0x70686c0d, 0x895fc8d3, 0x80da06cf, 0xb363fdc9, 0x804d8810, 0x51072566,
  0x27b2ebdc, 0x6e698657, 0x93b97901, 0x3932bde7, 0x38e1ca45, 0xf21f8cca, 0x0196e31e, 0x925a9c06, 0x1d208fce,
  0xb8563b9e, 0xcdcf2661, 0xd7b43040, 0xfa7446d3, 0xf9cbde9d, 0x1123602c, 0xd209c8d7, 0x9ab4230f, 0x72684621,
  0x6c9c7027, 0xd681e541, 0x2146702b, 0x796f2246, 0x86f7384b, 0xafa7ea2f, 0xe1236995, 0x53a2cc92, 0xc1a80dc0,
  0xb503082b, 0x14204a1a, 0xb426602f, 0xa350c9b6, 0xcd437f76, 0x52a8d512, 0x3f1886fc, 0x93bc225e, 0x4e1f3852,
  0x0048f8cd, 0x95879d1a, 0x51b6f0bf, 0x8fce8a01, 0xeb649177, 0x0aaea222, 0x622a0942, 0x6c406ed8, 0xa680c5dd,
  0x901aadd7, 0x85d2d108, 0xaa9189ae, 0xe7095279, 0xb7e79560, 0xdb9ada84, 0xb4e78b10, 0x7ae66db0, 0xb4ac9bda,
  0x670d5cb3, 0xa790f4d3, 0xfe518481, 0xbbd4b00b, 0x4643d478, 0xeb50c1e4, 0x4211bbe1, 0x26f6b362, 0xe1612a64,
  0x2b34bb2d, 0x0454abc3, 0x59be22f0, 0x68393d08, 0x861cacd8, 0x42c99ebd, 0xcf4fd5ed, 0x3c290a8b, 0x353eb82d,
  0x06cca9ee, 0xbf45cdcf, 0x85784848, 0x4c13d5f6, 0xdca3523e, 0xb1e06349, 0x3e8927db, 0xea2db564, 0xe798e878,
  0x4cd15d96, 0xc8517abd, 0x0926b612, 0xc0bff33e, 0x4163046c, 0x5d588d96, 0x3135fa4e, 0xa14a91fa, 0xeb005001,
  0x5231d8d2, 0x193d4a10, 0xd0d0906e, 0xc3080e9b, 0xfda05e42, 0x8782007b, 0xea3c596e, 0xfce90f7b, 0x5b7d3fa9,
  0x6cb55e6b, 0xe6ddf73e, 0xaf919c0b, 0xb256f0e9, 0x774c30d2, 0xf102fce9, 0x36d9c255, 0x4ade9d17, 0xd8ee8707,
  0x3b3298ba, 0xe306824e, 0x0ea0904c, 0x4147519a, 0x20288602, 0x26b372f0, 0xd0981eac, 0xa785ebc8, 0xa9d4a7ca,
  0xdbdf58e9, 0xd953c50d, 0xfd590f8f, 0x9d6361cc, 0x44e6c917, 0x72e9626b, 0x22eb64cf, 0x7fd96110, 0x9eb288f3,
  0x863ebb7e, 0xb0e63d34, 0x4fe7ee31, 0xa9e54fab, 0xf4600572, 0xd5e7b5a4, 0xc0493334, 0x06d54831, 0x8589fb92,
  0x6583553a, 0xaa70f5cc, 0xe25649e5, 0x0879094a, 0x10044652, 0xcc904507, 0x02541c4f, 0xebb0696d, 0x3b89da99,
  0xabbaa0c0, 0xb8284022, 0xa6f2d79e, 0xb81c05e8, 0x27847862, 0x05e54d63, 0x337a4b59, 0x21f7794a, 0x3c67500d,
  0x7d6d7f61, 0x207005b7, 0x04cfd6e8, 0x0a5a3781, 0xf4c2fbd6, 0x0d65e0d5, 0x6d3549cf, 0xd433e50f, 0xfacd665e,
  0x6f33696f, 0xce11fcb4, 0x695bfdac, 0xaf7c9860, 0x810ee252, 0x7159bb2c, 0x65450fe1, 0x758b357b, 0xf7dfbebe,
  0xd69fea72, 0x2b057e74, 0x92731745, 0xd485717a, 0xe83f7669, 0xce1f69bb, 0x72877d6b, 0x09f8ae82, 0x3244278d,
  0x9548ae54, 0xe3c2c19c, 0x207755de, 0x6fef1945, 0x87bd61d9, 0xb12d28c3, 0x18813cef, 0x72df64aa, 0x9fbcd1d6,
  0x7154b00d, 0x48dc5ee5, 0xf49a3154, 0xef0f469e, 0x6e2b2e9a, 0x3e85a595, 0xaa924a9c, 0x45aaec1e, 0xa09e4719,
  0xaa12dfc8, 0x4df69f1d, 0x26f27227, 0xa2ff5e73, 0xe0e4c82c, 0xb7a9dd44, 0xb9d8ce73, 0xe48ca901, 0x6c036e73,
  0xa47153f0, 0xe1e421e1, 0x920418c9, 0xb86c3b79, 0x705d7672, 0x93bdce87, 0xcab79a77, 0xf25ae793, 0x6d869d0c,
  0x1f3194a3, 0x4986c264, 0x9d55c882, 0x096e945e, 0x49fb5ea3, 0x13db0a3e, 0x39b8e653, 0x35d0b34a, 0xe3417bc0,
  0x8327c0a7, 0x440b386b, 0xac0362d1, 0x8fb7262d, 0xe0cdf943, 0x2c41114c, 0xad95a0b1, 0x2ba5cef1, 0x67d54362,
  0xc09b37a8, 0x01e486c9, 0x26d6cdd2, 0x42ff9297, 0x20477abf, 0xbc0a67d2, 0x0f121b41, 0x444d248a, 0x62d4760a,
  0x659b4737, 0x0e044f1d, 0x250bb4a8, 0x08fde365, 0x848bf287, 0xaceec3da, 0xd3369d6e, 0xc2a62182, 0x92449482,
  0x3582dfdc, 0x565d6cd7, 0x2f7e2fd2, 0x178a876b, 0x0a0122b5, 0x085104b4, 0x51ff96ff, 0x14f29f76, 0x050b31ab,
  0x5f87d4e6, 0x84abb28b, 0x8270790a, 0xd5ed439f, 0x85e3f46b, 0x2d6cb59d, 0x6c1e2212, 0x75f55c1b, 0x17655640,
  0xe5436f67, 0x9aeb596d, 0xc2965ecc, 0x023c92b4, 0x01ea03e7, 0x2e013961, 0x4704b4b6, 0x905ea367, 0x0ca8fd3f,
  0x551b2b61, 0x92523a42, 0x390fcd06, 0x1eb7a89c, 0x0392a63e, 0xe7f1d2be, 0x4ddb0c33, 0x96dca264, 0x15339848,
  0x231c210e, 0x70778c8d, 0xe87a28e8, 0x6956e170, 0x9d1de661, 0x2bb09c0b, 0x4ac3c938, 0x6998987d, 0x19be0551,
  0xae09f4d6, 0x8b2376c4, 0x1a3f933d, 0x1de0b765, 0xe39705f4, 0x380d94c7, 0x8c31c31d, 0x3685954b, 0x5bf21a0c,
  0x68533d00, 0x75c79ec9, 0x0bd7626e, 0x42c69d54, 0xca177547, 0xf6d2dbb2, 0xcc6edaff, 0x174a9d18, 0xfd0d8cbd,
  0xaa4578e8, 0x875e8793, 0x9cab2ce6, 0xa976a713, 0xb43ea1db, 0xce37ab11, 0x5259d292, 0x0a7ff1a9, 0x8f84f186,
  0x851b0221, 0xdefaad13, 0xa7222bea, 0x2b0a9144, 0xa2ac78ec, 0xf2fa59c5, 0x5a024051, 0x6147ce38, 0x91d1eca5,
  0xbc2ac690, 0xbe94d523, 0x79ec1a0f, 0x2d8daefd, 0xceb39c97, 0x3bbcd6fd, 0x58f61a95, 0xf5575ffc, 0xadf7b420,
  0xdbd986c4, 0x15f39eb7, 0x81aa8814, 0xb98d976c, 0x6ee2fcf5, 0xcf2f717d, 0x5465475d, 0x6860bbd0, 0x8e24d3c4,
  0x305406dd, 0xe27a6dbe, 0xdd5d1957, 0x8eb7dc7f, 0x387d4d8f, 0xf54a6876, 0xc7762de4, 0x9c479409, 0x99b30778,
  0xbe4d5b5d, 0x6e793682, 0x25380c56, 0xdac740e3, 0x602d37f3, 0x1566e4ae, 0x140deabe, 0xc8de610b, 0x0f893a5d,
  0x67e223ce, 0xe8c515fb, 0x4ead6dc5, 0x7774bfa6, 0x925c728f, 0x89d20f95, 0x098583ce, 0x7a1e0966, 0x93f2a7d7,
  0xa2eedb94, 0x4c304d4a, 0x1b282097, 0xc077282d, 0x0842e3da, 0x357a8313, 0x1aa84db9, 0x190eae46, 0xafb9c0b9,
  0xcd152e65, 0xca04c15a, 0x86c722db, 0x663285b7, 0x6adfc1a6, 0x2df90ab6, 0x3e5aaa65, 0x2069f55f, 0x110c8419,
  0x7704d1ca, 0x63ffed41, 0xfab318ca, 0x1402b9d0, 0xd3b3a13f, 0x2c7bc863, 0x573441c3, 0x578c3e6e, 0x4b301ec4,
  0x0adaf57e, 0xc26fc9c4, 0x7493cea3, 0x96e71bfd, 0x1af81456, 0xd05d4b3f, 0x6a8c608f, 0xdaca2a8a, 0x0725b276,
  0x53ef07f6, 0x1b785ecb, 0x23813d96, 0x8ffcfcc7, 0x717e8a48, 0x2e499542, 0x4f6c36ed, 0x0bd85af3, 0x9b89def7,
  0xa5f35549, 0x3d8ea206, 0xc649a220, 0x581385e1, 0x73cc0927, 0x9bf4bec5, 0x534181f1, 0x46395346, 0x53765db9,
  0x21695501, 0x2c7abc5c, 0x959dae32, 0x86483297, 0x4cea4d18, 0x4cb2284a, 0x48c3bb1b, 0xe49cb14b, 0x050c6c92,
  0xb704e555, 0x21e13bb2, 0x010006ee, 0x4c773b15, 0x5d8c87bf, 0x93991029, 0xb46694f9, 0x48aa81d2, 0x38b6e59f,
  0x0489dd73, 0x84b66165, 0x69281246, 0xebcf0593, 0xa72497ac, 0x21eeac14, 0x1b894d0a, 0x5966a835, 0x732236f1,
  0x974be9d6, 0xc9fcb462, 0x589b6130, 0xd6054385, 0x421d3aa4, 0xc37e2c2e, 0xe84fa840, 0xf926407c, 0x1454e41c,
  0x18abc03d, 0x3f7af644, 0x26605ecd, 0xd6a5eabf, 0x242341a6, 0x216b668e, 0x1edb84f4, 0x04010102, 0xd836edb8,
  0x945e1d8c, 0x5b337ce7, 0x444964ac, 0x4616ce55, 0x4211498b, 0x02108fbc, 0x4e546574, 0x1c8df635, 0x076291e7,
  0xa750080f, 0x99e78281, 0xdc3453f3, 0x4f495dce, 0x0d7779ab, 0x79ffe0cf, 0x49a3f780, 0xa795c128, 0xd78ef100,
  0x6543dfcc, 0xbd5b3adf, 0x0b4d762e, 0x7c413b51, 0x1bc4bc43, 0xc8ac6f83, 0x8043e8c3, 0x27c2c023, 0x40395a86,
  0x81250dca, 0x93c28e89, 0xd1293b9d, 0x6030a82b, 0x8d1bfc82, 0xd375db70, 0xece39ba0, 0x971de303, 0x2a61229e,
  0x215ee719, 0x0635ed2a, 0xbb93abb7, 0xd8e4f713, 0x5a466813, 0x8dfbde1f, 0x0b8a9de6, 0xe474d65a, 0x3b38348b,
  0x0e244068, 0xf2ce7593, 0xb29657f3, 0x4ec4b667, 0xce6e132e, 0x099044b1, 0x47814783, 0xa428a551, 0xf2b04d68,
  0x598360d3, 0x72bc9cd5, 0x2450efe5, 0xe6ffceb8, 0x425bca58, 0x5fc778b9, 0x6a6f4fa9, 0x1b6db987, 0x23e3f30d,
  0xd73215b0, 0x90d9a9bf, 0xefa6c8c8, 0x9bc5ef97, 0xcd275acc, 0x06718440, 0x37874249, 0x2b425efc, 0x01b53e8b,
  0x48dc354c, 0x63046f6e, 0x6694b583, 0x88523e44, 0xfa5c3397, 0x8d36dd7e, 0x2810af20, 0x4450cf5f, 0x53cd5c0c,
  0x3258e273, 0xa6a20fc9, 0x406aa1f4, 0xe3905a09, 0xc1dd6791, 0xf9b2fe60, 0x47f74947, 0x48d68f59, 0xdbeaab33,
  0xd7f12741, 0x177bc077, 0x3b8a0569, 0x1174d109, 0xd96628fe, 0xb154db4b, 0xd3709035, 0x3da0e52c, 0xf66ce755,
  0x21f7da9b, 0x8034ea56, 0x5088b8b1, 0x938ded46, 0xa5f486ac, 0x70343199, 0x3c9b6dc4, 0xe0f77614, 0x70b9fbff,
  0xbb422d4b, 0xa686c995, 0x3d759571, 0xa57102b0, 0x67d5e8cd, 0xc0dcc16a, 0x533ef217, 0x889f6d65, 0xc3ca2e87,
  0x7158c7e4, 0xdc2b4167, 0xfb670dfb, 0x844c257f, 0x75910a01, 0xcf88577d, 0xf336bf07, 0xe45e2ace, 0x22245250,
  0x7ca23d85, 0x2ed92e8d, 0x2b812f58, 0x29f8be4c, 0xcf7d62d2, 0x20d3c982, 0x23ba8150, 0x1f36e29d, 0x92763f9e,
  0x48ae0bf0, 0x1d3a7007, 0x7a527e6b, 0x581a85e3, 0xb4a89097, 0xdc158be5, 0x1f1a520f, 0x167d726e, 0xf98db37d,
  0x1113e862, 0x8802786e, 0x7ae72ce5, 0x75946aba, 0x04ebd226, 0x2e858934, 0xe3de94b5, 0x8580d4c9, 0x3d0683fa,
  0x3f521c44, 0x28c498be, 0xd800901a, 0x1b48cb90, 0x8471501f, 0x5bc58e57, 0xee87be3a, 0xfe27fa60, 0xe1123f25,
  0x9db3b381, 0x263a2cfb, 0xd4df0a4b, 0x9c3a2dee, 0x7d04e61f, 0x728d06e9, 0x42449325, 0x8b1adfbc, 0x7e053a1b,
  0x6ec1d939, 0x66daf707, 0xee2be5c7, 0x810ac7ab, 0x80ba1e14, 0xf530f174, 0xdd2ae778, 0xa464269c, 0xa4ed05fb,
  0x5cd2fe8b, 0x5abc28f9, 0x11a40934, 0xb3aafa22, 0xd7f35379, 0x46021d4c, 0x290777d9, 0x5771a3c2, 0x41f32772,
  0xb7f853de, 0xd95603f3, 0x2e348157, 0x466bbf67, 0x076f0831, 0xa297c1e5, 0x9bc7ccb1, 0x82975b7a, 0x5fac57c3,
  0x97648feb, 0x558880ac, 0x9306c2c3, 0xc30bd923, 0xce9835e4, 0xb4cd6bf1, 0x0ce56507, 0xd52dba58, 0xbe313df1,
  0x2d392c90, 0x84ceaed7, 0x4205a23e, 0x7a2dbfd7, 0x815a816b, 0x3e1e1979, 0x12809e55, 0x9c51467b, 0x4ff5ce0c,
  0xee996d98, 0xed5f815a, 0x0bd3db01, 0xd2e1399d, 0x7a816e68, 0x7afad0d4, 0x0b4c03db, 0x37f8db9d, 0x1c59ef24,
  0xd13a1cf8, 0xf23f2d92, 0x91213462, 0x60b94078, 0x6cab71bd, 0x176cde20, 0x6bdd0a63, 0xee4d54bc, 0x54c9b20c,
  0x9f2ac02f, 0x3cd2d8aa, 0x206eedb0, 0x03f8e617, 0x93086434, 0xc7f68e16, 0x92dd3db9, 0x831469c5, 0x936972d9,
  0x7e9efe70, 0x995a53e2, 0x4e209c82, 0x073e197b, 0xa955eefd, 0x9891ce26, 0x5405809c, 0x3b9fe6c3, 0xff437391,
  0x03ffb90e, 0xac2b12df, 0xd3f181d9, 0x09c7fd78, 0x327b97e0, 0xd5e14041, 0x1f6418f0, 0x254c673c, 0xc1cd6ec9,
  0x09351454, 0x1bcabe39, 0x62ce468e, 0x3a9bb28c, 0x0b40d8d4, 0x47e9f69d, 0x24bb9cdc, 0xf5fe0edc, 0x5e64766f,
  0xf913b301, 0x6bfc2b14, 0x625c3c70, 0x794031aa, 0x75678d7f, 0xa475d0cc, 0xaf2a70da, 0xdbd9850e, 0x1875bf36,
  0xdb46ef63, 0x751267fa, 0xdd0b61f5, 0xa0b0bb30, 0x05482087, 0xd5fbe9cb, 0x9cfe299d, 0x1b60814d, 0x6a178109,
  0xcb28431c, 0xf39be4af, 0x377e29a2, 0xf454152c, 0xdd555915, 0x0c33b51f, 0xe3bc8be9, 0x6855b7c1, 0x022e58f8,
  0xbbbb9bb5, 0x01ab2647, 0xce0bc1bb, 0xb6256d5a, 0x687783c8, 0xb0ca484c, 0xe4d74b53, 0xf65384f0, 0xb8fb733d,
  0xfdad739a, 0xaf1b1b07, 0xb5c7b972, 0xc147dfcb, 0xdf03e036, 0xc4647be5, 0x0019e846, 0xd3b5539c, 0x1239986e,
  0x3fcd6682, 0xbaf1b385, 0xd15a29d3, 0x35388a04, 0x28f55ca8, 0xf721fa09, 0xac1bb660, 0xc4260ce8, 0x05135b99,
  0x763bde32, 0xd2164b80, 0xa379ad75, 0xf233dced, 0x0ee47c9d, 0xeed33628, 0xc90572b3, 0x58ab955e, 0x7743229b,
  0xf4ad58c5, 0x98b678f7, 0xe16c6d44, 0x10fc036a, 0xc9b66513, 0xb2630de5, 0xbfca3418, 0x86980a16, 0xdb52a230,
  0x128dd83a, 0x732a1969, 0xb3f0c36e, 0x38193f06, 0xa449a0ef, 0xdef6b620, 0x69f5de63, 0xf2aa5615, 0x77945df2,
  0x87325c3c, 0x30e90c8d, 0xe0889276, 0x5922ac1c, 0x8df27545, 0xa52b3f63, 0xa7b3ef5c, 0x71de57c4, 0x8e77b214,
  0x834c008b, 0x31682c10, 0x4bd55d31, 0xc76824f0, 0x17b61c71, 0xb6d1c086, 0xc2a5089d, 0x31db0903, 0x184e5d3f,
  0x9c092172, 0x453cadd6, 0x8de2b7bc, 0xbc0bc1f8, 0x203900a7, 0xa6abd3af, 0xbcd86e47, 0x8502effb, 0x911cac12,
  0xec965469, 0x2d550242, 0x29e0017e, 0x0e9f7692, 0x65979885, 0x633f078f, 0x4cf751ef, 0xfb87d449, 0xda601f87,
  0x1cf2c450, 0x8f35b741, 0xeb9112f3, 0x5342813b, 0x8eb7a397, 0x1983d1c1, 0x8f80681e, 0x6758b38d, 0x6b128d2f,
  0xd0749ebe, 0x407f0f50, 0xea3fe0f3, 0x1b5ac2ed, 0xd8f81007, 0x05d9bcd4, 0x070d3aab, 0xe4ac8b33, 0x9a2cd5e5,
  0x2643672b, 0x1cfc9173, 0x52eff79b, 0x90a7c13f, 0x665ca49b, 0xb3efb998, 0x5a8dda59, 0x052f1341, 0x8a5b922d,
  0x3cf9a530, 0xae9ebbab, 0xf56da4d7, 0x35986e7b, 0x03446584, 0xac953951, 0x2de63038, 0x76a360ee, 0x51b2d92c,
  0xd6c1a0b0, 0xfe2f44bf, 0x57acc823, 0x2d3f3948, 0x9282a5de, 0xad531d9b, 0x91650935, 0xc133f48e, 0x277215fb,
  0x3a8ef534, 0xd06d383d, 0x6bc05381, 0x5e1e63ab, 0xd2747232, 0x92f01d1d, 0x65835dcc, 0x3fbfd9d3, 0x32cf0dc6,
  0x3a98901b, 0xbbf6b9ca, 0xf0b4a3d9, 0x2ddc3857, 0xda4e0901, 0xab60d025, 0xbd900e10, 0xdd19e8db, 0x53a1c135,
  0x6ea9f893, 0xbfe8fa00, 0xc6b72f04, 0x9b55e257, 0x957d1650, 0xff0fc327, 0x6c58e7b6, 0x4b0682c1, 0x110f9185,
  0xf35913e8, 0x4bbf3021, 0x1b1c1291, 0x5d433891, 0xeea4ea79, 0xf6f0f46d, 0x755d5dcd, 0x1e84e0e5, 0x19686041,
  0xaea34c93, 0xa5db84d3, 0x7073a732, 0xf9d5bb19, 0x6bcfd7c0, 0xb8d2fe56, 0xf3eb82fa, 0x45775f36, 0xfdff8b58,
  0x8cb20ccc, 0x8374c110, 0x1659b65f, 0x330c789a, 0xb8b4a422, 0x7ae592b8, 0xb2546617, 0xa0f4a9f2, 0xb2339c4a,
  0x79f8eae0, 0xfc5c2cf5, 0xece3ea1e, 0xd8bc8a1e, 0xcf9c747e, 0x2aa33aa5, 0x05fa10ee, 0x964f89d2, 0x0d7b8a0b,
  0x7e35fea3, 0x109bfe16, 0xfcc41672, 0x0c3a1577, 0x290ab802, 0x29c4d040, 0xf6374449, 0xc35d1594, 0xcad607d9,
  0x2ee3e88f, 0xae0d4c9a, 0x1d265b5a, 0xdb92494a, 0x29831ff8, 0xdc537351, 0xb3b69b02, 0xdc8f2b05, 0xe2928a67,
  0x495078df, 0x38d66c99, 0x8699baeb, 0x7d9e403d, 0x969b4663, 0x84ed304b, 0x980893fd, 0xa1938458, 0x6ed55320,
  0x513e63cb, 0x24b215dd, 0xf5fe1ae7, 0x05bdea1b, 0x2ce1a04f, 0xba2f9253, 0x0d7fb3c9, 0x7b955561, 0x1bea4a7d,
  0x1481da4d, 0xf384b29f, 0xf4fcd517, 0x55cff503, 0xf19c2016, 0x06c4df04, 0x108ac09f, 0xe90fb297, 0xefdff4ee,
  0xf933c12c, 0x1d8d5045, 0xcb7ef8b8, 0x975d95f5, 0xd7d604f1, 0xb4094013, 0x4bb808d6, 0x239e5f16, 0x73f42cbb,
  0xf9584ddb, 0x4a2902d6, 0xbde41ad6, 0xeb95cc88, 0x37dd6e2a, 0x0c72cda8, 0xd3c6ea82, 0x43d6f957, 0x7d3ab4fe,
  0x13d3e8e1, 0x57fd66d3, 0x2415a3d6, 0x0f4e43d1, 0xafa218cf, 0xcbc9f257, 0x8e2a4e0c, 0x3972ecb2, 0x4f76e5fa,
  0x7c518a58, 0x1c4e11e1, 0x583ebd0b, 0x41bfb22b, 0x26f11dd0, 0xa0ddfa83, 0x613606b1, 0x639bcf14, 0xdf9496dd,
  0x4e88fdae, 0xeeed36ec, 0x069604f6, 0xcedd1607, 0x39217fea, 0xde6ce26b, 0xb64d18a9, 0xf150a29f, 0x68500f4d,
  0x6d37083d, 0xc54f2959, 0x274a4806, 0x9af51cfb, 0x62a200de, 0x19605d08, 0xce82e5ae, 0x45887f4a, 0x819dc06d,
  0x0a750c0f, 0xcc7a6488, 0x4e548e83, 0x39bacfe3, 0x0c110f05, 0x3d418c76, 0xb1f11588, 0x3e4daa4c, 0x5ffc69ff,
  0x2733e7b5, 0x92053127, 0x46f147bc, 0xd722df94, 0x885b2434, 0xe6fc6b7c, 0x6a444f65, 0xc360e25a, 0x8ce9b6bf,
  0x075a1a78, 0xe6425195, 0x481732f4, 0x9dc756a8, 0x5432b57a, 0x83c0440f, 0xd720281f, 0xc670b3f1, 0xd135e051,
  0x2205910e, 0xdb052be7, 0xded14b0e, 0xc568ea39, 0x697b3d27, 0xb7881c8b, 0x4516b5b8, 0x9a5825b4, 0xcfe743c6,
  0xc24e3024, 0x3d5b8b06, 0xcf8c9326, 0x31c1a413, 0xb632ae3b, 0x5e6eee84, 0x2bd48b14, 0xdfb7eb6b, 0x9a7261e9,
  0x6a651529, 0xaa69133c, 0x996b358d, 0x979f3925, 0xb81d783e, 0xaf4c89a7, 0x1efd130a, 0xfd1bf7fa, 0x525c2144,
  0x1b265a9e, 0x4b296904, 0xb9db65b6, 0xed8e9634, 0x03599d8a, 0x35c82e32, 0x403563f3, 0xdaa7a54f, 0x022c38ab,
  0x9df088ad, 0x7025aa01, 0x396b8d04, 0xe23e9595, 0xa98b2ce9, 0x20bb29f4, 0x9769e7c8, 0x201a51a5, 0x23778ebb,
  0xa9b810a4, 0x653ff433, 0x66f269a7, 0x017773dc, 0x129ae800, 0xbce2ae82, 0x51317d6b, 0x32345151, 0xf67a99fa,
  0x39a3bd51, 0xba72c87f, 0x63441f7c, 0x745125ca, 0xcc3fc76f, 0x9c686d78, 0x670e00c6, 0xa0277d6d, 0xa35c29f9,
  0x3e443178, 0x078badcf, 0x5d1c6e16, 0x1ca01d3f, 0xfc8934cf, 0x23751c99, 0xec245c99, 0x907c4f80, 0x16273128,
  0xa8943d33, 0x2e233ae1, 0x8984e2cb, 0x794c6256, 0x655a4dda, 0xee6e1497, 0x88e95ce7, 0x129d3376, 0x977f927f,
  0x568a3ff3, 0x2758787a, 0xdc3cbce1, 0x0bdf684f, 0x1f095615, 0x1083e2ea, 0x14e68c33, 0x0a28ad77, 0x3d8818be,
  0x6bfc0252, 0xf35850cd, 0xb585113a, 0x30df8aa1, 0x7d935f0b, 0x4ab7e3ac, 0xaddda07c, 0x552f00cb, 0x92c34299,
  0x2909df6c, 0xc33ed1de, 0x10fb29b2, 0x222c4a8a, 0x30b7eb36, 0x55086586, 0x1ee898a1, 0x22d15c09, 0x854090de,
  0xb4a70d45, 0x6f61fbdc, 0x3be7a389, 0xfd3348c4, 0xa7d262af, 0xe66d5552, 0x9682ec29, 0x14cbb8d6, 0x5ef177ea,
  0x7eafb650, 0x3067f793, 0x3bf2a0cb, 0xe37dfbf4, 0x8c3ac824, 0xe6b8e19a, 0xa05e8b4b, 0x8c4930bf, 0x45cdb7bc,
  0xd6912676, 0x05ea892c, 0xcebdce57, 0x8015170f, 0xf00c5403, 0x7b65a3e5, 0x2e12dfcc, 0x6c5f67d0, 0x9bdfc7a9,
  0x986471a7, 0x64a44be0, 0xb721aca9, 0x7f12c705, 0xd760d701, 0xcc2f523c, 0xb46febf2, 0x49bb9288, 0x375964e6,
  0x6a207099, 0x0420792f, 0x6ca4a499, 0x38bca9e8, 0x2188c12d, 0x8ee50f1e, 0x3857f5c4, 0x09a578e4, 0xf8f801d2,
  0xf20f170e, 0xbe6c89fd, 0xabcf2fa9, 0x5ba08b2f, 0x486f3cfc, 0x86803b77, 0x9cf883ea, 0x846a92f7, 0x474feb56,
  0xbfb52676, 0xd252161a, 0x483127b0, 0x6a658c2b, 0x18288cfe, 0x0b3d9e91, 0xe9eaef2d, 0x9ae474f2, 0x58f2023f,
  0xbcf34170, 0x0bdae4b1, 0xb1861d12, 0x9b725d7b, 0x0b4725bb, 0x2bc04f74, 0xd2aefc19, 0xd9fe2c7c, 0x610b818e,
  0x5e985bb6, 0xb4998e4b, 0x58b1117c, 0xee2b2e32, 0xa2ccc539, 0x127f3f60, 0x5d1033e8, 0xbbc4b91d, 0x6958923b,
  0x70aa136d, 0xa077a0cf, 0x641bbf55, 0xd2fa8875, 0x32837130, 0x74d271aa, 0x33c1d7bf, 0xfe89c100, 0x32237e81,
  0x8de08805, 0x874dfaee, 0xf43684ec, 0x88bef633, 0xfdba26b9, 0x5d2a9c91, 0xac299404, 0xa96659e1, 0xeea6a5a0,
  0xd25ec31a, 0xe74a555d, 0xd7d5a482, 0x8663b8f1, 0x1b5845e4, 0x50b490d7, 0xceca9754, 0x83f49167, 0x4b7939a0,
  0x426d2cf6, 0x723fd0bf, 0x2555e355, 0xc4f144e2, 0xa96e6d06, 0x87880e61, 0x4768a8dd, 0xe508e4d5, 0x15543815,
  0xb1b65e15, 0x09d7e772, 0xac302fa0, 0x63439dd6, 0x711b0eb9, 0x96892c1f, 0x780ab954, 0xb905f2c8, 0xa20792db,
  0xace26309, 0x0684e126, 0xec8ac9b3, 0xb40a2447, 0x486ad8b6, 0x9fe3fb24, 0x60121fc1, 0x1a8e3b3f, 0x5626fccf,
  0x6ad1f394, 0x4e568622, 0x4393d2d6, 0xa1d7ba8d, 0x13408e94, 0x3f7d2593, 0xba7172f3, 0x3a6e7375, 0xfb20d9cc,
  0x95ba7341, 0x3726c5da, 0xf6656d08, 0x2e35af89, 0x79d48136, 0xfc71f1fe, 0xc0fa32d5, 0x7bcf2b24, 0x721925c9,
  0xe1337c26, 0x949c9976, 0xd73d68e5, 0x6faadebd, 0xf1b768d9, 0x9e158614, 0x9cc4f069, 0x22dfa557, 0xbe93c6d6,
  0xccd6da17, 0xa504f5b9, 0x24866c61, 0x8d694da1, 0x2121353c, 0x0140b8c6, 0x1c6ca580, 0xdd4d8c5b, 0x28936e2b,
  0xe9056535, 0x613925af, 0x6975bb30, 0x7e293447, 0x0c40bba4, 0x46c390f0, 0x1fda5cbb, 0x04df3cab, 0x9f6fb520,
  0x3a49e708, 0xe54a5dcf, 0x87e918f0, 0x2e7ee120, 0x6d55293c, 0x84ddc20b, 0x23c7bddf, 0x15a6415f, 0xd589bb14,
  0xd4622bb6, 0x9f773481, 0xfe400cc6, 0x1755547a, 0x97c77fe8, 0xfcdbcc9d, 0x94bb513c, 0x95cdc2b5, 0x434a335d,
  0xec3dfb65, 0xe3414909, 0x24eb954e, 0x14cf8dfd, 0x04652209, 0x8f1221a2, 0x28248c1d, 0x50c374dc, 0xa8549a3a,
  0x4822be54, 0xbf262258, 0x64309efd, 0x7666f41b, 0x5fd7cb3f, 0xa3bc7210, 0x817cf611, 0xce7714a7, 0x534f2cc1,
  0x5065639d, 0x2f41deff, 0x02b37a95, 0xe63b89b7, 0x0e44a59a, 0x143ff951, 0x673257dc, 0xd752baf4, 0x19c02205,
  0xc4b7d692, 0x46c23069, 0xfd1502ac, 0x2e6392c3, 0x1b220846, 0x6057b1a2, 0x0c1b5b63, 0xe51ff946, 0x96096717,
  0x81a628b1, 0x33149d8a, 0x2cd684be, 0xfc179122, 0x10e66a80, 0x91d1288c, 0x95bb287b, 0xc37f1929, 0x06e6cc2c,
  0x38ad06a9, 0x2afcc2ac, 0xac25cf5b, 0xb0f23450, 0x08b14d82, 0x8f8c414a, 0xaa1849e3, 0xed9cd03e, 0xb6f6e8f2,
  0xf2096239, 0xbc9c36be, 0xb0163f44, 0x333bb554, 0x66046c85, 0x680b3535, 0xec38f9ef, 0x9b758441, 0x3621c296,
  0xb1932627, 0xeda1428e, 0x76ef8b71, 0x41f5991b, 0x987e7bdf, 0x61b12191, 0xf154291f, 0x18638b25, 0x34bdaf82,
  0x983bb560, 0x947df6be, 0xc302a841, 0x94cc4093, 0xa81b53bf, 0x69be22e1, 0x1b570e8f, 0x633a3237, 0xd6c9efcb,
  0x471886bf, 0xbc946cf9, 0x2c419439, 0xe972082a, 0x9d835424, 0xb3250c55, 0x8653c55d, 0x555a5847, 0x66179cf7,
  0x6bb2590e, 0xc085d34f, 0xc9f81b3f, 0x11823da3, 0xab4b43e4, 0x49426f48, 0x1445ebd7, 0x7c831d9c, 0xfbe589d3,
  0x4c4cfb03, 0x47dcd3cf, 0x376ba82d, 0x2cfd4f5c, 0x1cffa8aa, 0xc3850d69, 0x946094c6, 0xe3473018, 0x8caed6bb,
  0x467f8bfb, 0x0fd87db7, 0x328ba71e, 0x088e5c74, 0x12c17fdd, 0x5097fcf4, 0x7bac7071, 0x3a58d915, 0x24a5d347,
  0xf071cb4c, 0x25f6eae5, 0x6580e9f9, 0xf05d4e5c, 0x42e9dcec, 0xb32d0317, 0xd36548dc, 0xb75ac9ff, 0xd47267b9,
  0xa21c8626, 0x33809d3b, 0x188aa85e, 0x5b450c67, 0xb4cd36ac, 0x8eb85241, 0xf0b18c63, 0x4df2cf69, 0x95bbaa9c,
  0x70932b57, 0xc77b5fbb, 0x20c41b9c, 0x7db752b8, 0xf2a403de, 0x0e5dbbfa, 0x818dae4d, 0xdcf9fa93, 0xc2e6a0a2,
  0x76cd248a, 0xdbe5fd07, 0xe1899f32, 0x991724f3, 0xc7913e91, 0x39cbd686, 0x5eda799c, 0x63d4fc1e, 0xddb595c7,
  0xac4fed54, 0x6b63b80b, 0x7e5fb516, 0x6ea0fc69, 0xd0f1c964, 0x737708ba, 0x11a92ca5, 0x9628745f, 0x9a86967a,
  0x61f37958, 0xd111f8ec, 0x3e0e5c9d, 0xb7c4e760, 0xbcc33f8d, 0xbd392a51, 0x702f9a91, 0xc132e92d, 0x7da4a795,
  0x0bb1151b, 0x1a0b0ae3, 0x02e32251, 0x54febac8, 0x694e9e78, 0xea3a5082, 0xe4fe40b8, 0xe58ffec1, 0xe842d1a6,
  0x0eec642e, 0x64a2f5fd, 0xa2fa16b0, 0x404ab431, 0xd68750a4, 0xeec75d66, 0x7f37a9f7, 0x79f9cb9f, 0x3b5c2bb7,
  0x451b2eb4, 0x27542021, 0x7d91f9d9, 0x902afc37, 0x5f36d153, 0xf23f21bb, 0x4c830320, 0xf3b7963f, 0x903203e3,
  0x842c7aa0, 0xe7327afb, 0xaf22ca0a, 0x967609b6, 0x38e13092, 0x757558f1, 0x73b8fb62, 0xf7eca8c1, 0x3cc3e831,
  0xf6331627, 0xe4174474, 0xc3c40234, 0xa77989ca, 0x00bffe1c, 0xf76c7b0b, 0x980a74d8, 0xb059034b, 0xc623a585,
  0x9a1dccd8, 0xe7bdc815, 0xeab877bc, 0x6e8eb98b, 0xd52de2d1, 0x4a8a0449, 0x8c53e7c2, 0x90ac5a35, 0x842350f3,
  0x212a67bf, 0x81c4bfee, 0xa73e192c, 0x53972552, 0x1f0ca6e8, 0x69f4df81, 0x6e2c8fb1, 0x904697cb, 0x9270341b,
  0x92aa39f3, 0x8e5b4d4d, 0x879221ab, 0x4c649efb, 0x3c14cac7, 0x7d407341, 0xfd27ec79, 0x5b4a63b0, 0x34e40452,
  0x56b1153c, 0xbaff7ab8, 0xf091458f, 0x182a1e56, 0x6d154314, 0x5c14716b, 0x6af64161, 0x355c047a, 0xd38644ab,
  0xfe472272, 0xe96d671d, 0xced472df, 0x9bba8f32, 0x61e249ac, 0x779c783f, 0x13157fbf, 0xee3c76cb, 0xf306a3c8,
  0xd32a1f6e, 0x3cf11623, 0x6863e956, 0xe6d5ab64, 0x5c005c26, 0x3b8a4cbe, 0x9ce6bb27, 0xdcd529a5, 0x04d4b16f,
  0xc4afaa52, 0x7923798d, 0xb0624a26, 0x6b307fab, 0x85e56df6, 0xf5bb45da, 0xa90366c6, 0x278e9bbc, 0x77a1b2e7,
  0x63d5de5c, 0x45dd322e, 0xcbf7777b, 0xa4e37dfd, 0x5a14ef8c, 0x93bd478e, 0xe05125c2, 0xe050df99, 0xc1e2ceb2,
  0x13555461, 0xa0c36e1d, 0x609a6070, 0x3907114d, 0xf37c7441, 0xc9df6b9e, 0x6993ef96, 0xa66133ec, 0x554d1256,
  0x5191fbf4, 0xcb2bcd73, 0x997c7091, 0xa7d78aff, 0x88c02b35, 0x3eedfcb2, 0xd9d20941, 0xfa22b7d6, 0xadf0b394,
  0x329900fb, 0x99018f13, 0x316bb73b, 0x17fe8f39, 0xdc500d1a, 0xd7c0806d, 0xe24e47f0, 0x137c762c, 0x20b3a8c6,
  0xb9ecae05, 0x7bb5d1ef, 0x7c5d2188, 0x1475bac9, 0xdf925ba2, 0xa437c526, 0x0e0398c0, 0xa209d49f, 0x7abaf98d,
  0x8e9c0a08, 0xfcaa77d6, 0xe5a5e63d, 0xc1a1f2cd, 0xadffa60b, 0xe699bc00, 0xc203ff10, 0xd1d2c3ca, 0xdde415fa,
  0x5acde66d, 0xf8bcc894, 0x4b7f7c01, 0x61775299, 0x339237bf, 0xaeceafdd, 0x9b386840, 0xd9c97d6f, 0x278cd0d5,
  0xf32af5dc, 0x287758a9, 0xbb6ec813, 0x541fe8e4, 0xa7090edd, 0xda2423c6, 0x4a5d9a2a, 0x374e6332, 0xd6e6b0ea,
  0xa04d6c11, 0x07d2b7b0, 0xd10ec7fe, 0xc79830dc, 0x6a94a09d, 0xe182e8e3, 0x25fac77c, 0xba4495d2, 0xce5e1418,
  0x402f6c06, 0x35a6bf4d, 0x477ff713, 0x575c625b, 0x260626e7, 0x4ff9d23e, 0x23dcff1f, 0xdfffb03c, 0xe737742e,
  0x7ed6aea1, 0xdd3d4640, 0x00e29b03, 0xde4cf2be, 0x5bf6b853, 0xdc38c4e3, 0x62b93d98, 0x4af556a8, 0xa4e5db9d,
  0x493f4823, 0xc3fcc6cc, 0x4bf133b6, 0xbcd26660, 0xb83ecd49, 0xf9b56b20, 0x313c78b6, 0x1715e3b2, 0x92c4010e,
  0x6424c49b, 0x646f9679, 0x67c241c9, 0xf888dfe8, 0x24f68b49, 0xe12d4b93, 0xa571df20, 0x9a6b62d8, 0x179483cb,
  0x81b4b26d, 0x9511fae2, 0x666f9632, 0xd53aa51f, 0xd281b3e4, 0x7f3dbd16, 0x7f96a765, 0x33f6746c, 0xc7f3a8f8,
  0xfea990ca, 0x21e46f65, 0xcaddb0a9, 0x915fd5c5, 0x78614555, 0xbd41f016, 0x426ffb58, 0x346f4434, 0x14dbc204,
  0x80559436, 0x5a969b7f, 0xf3dd20fe, 0xe899a39a, 0x9d59e956, 0x645e1aa1, 0x6261a141, 0xca2b0dde, 0x9b786a86,
  0x1d40a9b7, 0x2750f85c, 0xf39f5373, 0x45218944, 0x9134d4f0, 0xb81c8c9f, 0xb0f3b721, 0x108507ed, 0x688175d0,
  0x3571dd21, 0xa7c077e6, 0x5dd64232, 0x53544774, 0x511053e4, 0x3adba2bc, 0x834d0ecc, 0xbae371f5, 0x4215d7f7,
  0x6c8663bc, 0xfcfd57bf, 0xd6901b1d, 0xded2383d, 0xb5587dc3, 0x3b49fbb4, 0x07625f62, 0xfd44a08d, 0x9de9b762,
  0x3ee4d65b, 0x5755702b, 0xdec0913d, 0x8e94d5c6, 0x92aaa0d6, 0xdc60b301, 0x14d62bdc, 0xb2c625bf, 0x976d6d25,
  0x8c916145, 0xf979d8ed, 0xd4981dd6, 0xa22ea58c, 0xa6fbf04b, 0xd6713bf4, 0x4ac44bb6, 0xf3ad5f25, 0xb97c19b5,
  0xe31f80e3, 0x737fd627, 0xd1c0ef3f, 0xbd9760e0, 0x2c8a9c27, 0x9e5bb884, 0xbc21bb56, 0xa2b3f460, 0x0732c846,
  0xa7fd5e7f, 0x5ccfa7a2, 0x31a27658, 0x1c2d2e3a, 0x83075a26, 0x7bb0d9da, 0x939f2d90, 0x2dae785f, 0x535b5262,
  0x929daf96, 0xbea5303b, 0x824116b7, 0x98b9e2b7, 0x84a5d1f7, 0xb8c08a2e, 0xed32931f, 0x56f1f067, 0x51728344,
  0x61343bd2, 0x0ca144c6, 0x7e6476f2, 0xb41ad322, 0x1ec34f9e, 0x80802dc9, 0x33810603, 0xd8772d35, 0x530cb4f3,
  0x3f06d66c, 0xc475c129, 0x7be5ed0d, 0x31e82b10, 0xcb9e3c19, 0xc9ff6b4c, 0xc63d2857, 0x92a1b45e, 0xb92118c6,
  0x7285bbca, 0x0aec4414, 0x9b98f9ca, 0xa371aa4e, 0x70d42e60, 0x77928507, 0xd33cdaf3, 0xadbfe15a, 0xbd19c92a,
  0x89ab369a, 0x038a7064, 0x5f69e22b, 0xbdc40325, 0x733ff63b, 0xdd46c938, 0x5d011ce5, 0x26688f8f, 0xd6ef09a6,
  0x6ba112c4, 0x8f527301, 0x6ce9991b, 0x1c7ea712, 0x2c648e27, 0xfae740dc, 0x3f48bb41, 0x8ebe6f02, 0x292d3b22,
  0x3b65fc6c, 0xd72e5542, 0xa23317b5, 0x77b183a2, 0x22361785, 0x5346f472, 0x38f22b3b, 0x55c125ae, 0x73ef7443,
  0xf068a26f, 0x82acc836, 0x149d86c1, 0x6e650fc9, 0xc232e9ac, 0xe219f88e, 0xfba90374, 0xf2f21c00, 0x1a7c73e3,
  0x06d45206, 0xe5c86a4d, 0x4ec902fd, 0xbdf981b3, 0xa419a77c, 0x9e31f690, 0xebe44932, 0x37bf876d, 0xa6e6a433,
  0x023ece30, 0x36aed0c1, 0xe591214b, 0xe5676428, 0x284f4745, 0x31dba5e8, 0xc8fb96d2, 0x0e63dfd3, 0xbe4add86,
  0x6fcbb4d8, 0xa8db3b59, 0xa2479e5f, 0x160849af, 0x504dbbaa, 0x3424d98b, 0xec8af847, 0x223c1cb4, 0x563e79b5,
  0xa96b2820, 0x9ed209af, 0x893a9c43, 0x6923dde3, 0xe2037877, 0x3b3c8f1f, 0x5f5f2512, 0x62a37c04, 0x820d9541,
  0x0e581f06, 0x7306dd5d, 0xa64feeaf, 0x0dfb0149, 0x615c1d9c, 0x2023145e, 0xe77bdc51, 0xbe1f3d31, 0x4b54803c,
  0x77ee045f, 0xebe3a0b0, 0x7e35dc63, 0x708c07d9, 0x7ae81483, 0xa4fbfcd6, 0xe7a06617, 0x16a59ce9, 0x96a54b75,
  0xb6d77a6e, 0xb649d8fd, 0xf5a37e5b, 0x77f5b811, 0xf0f217e7, 0xab4256cb, 0x19567903, 0xa5df4bea, 0xf73d3938,
  0x1e49b510, 0xb6e71380, 0x3667f456, 0xc83b6447, 0xb59a3670, 0xc464e583,
]
// gen-p256-table:end

/** The limbs one comb table entry takes: X and Y, eight each (Z is 1). */
const P256_BASE_ENTRY: i32 = 16

/**
 * Digit `i` (0 to 63) of the comb: bits `i`, `i + 64`, `i + 128` and
 * `i + 192` of the 32 big-endian bytes `k`, as bits 0 to 3. The byte and
 * bit positions are the caller's loop position; the bits only reach `digit`.
 */
const p256BaseDigit = (k: u8[], i: i32): u32 => {
  const kLength: i32 = toI32(k.length)
  let digit: u32 = 0
  for (let b: i32 = 0; b < 4; b++) {
    const bit: i32 = i + 64 * b
    const from: i32 = bit >> 3
    const at: i32 = 31 - from
    const byte: u32 = at >= 0 && at < kLength ? toU32(k[at]) : 0
    digit = digit | (((byte >> toU32(bit & 7)) & 1) << toU32(b))
  }
  return digit
}

/**
 * Entry `digit` of comb sub-table `c` into `out.x` and `out.y`, without
 * indexing by `digit`: all fifteen entries are read, and `p256TableMove`
 * keeps entry `j` when `ctEq` says `j` is the digit. A zero digit keeps
 * none, and leaves `out` (0, 0), which `p256BaseKeep` then discards.
 */
const p256BaseSelect = (out: P256ProjectivePoint, table: u32[], c: i32, digit: u32): void => {
  p256SetZero(out.x)
  p256SetZero(out.y)
  for (let j: i32 = 1; j < 16; j++) {
    const hit: u32 = ctEq(toU32(j), digit) & 1
    const at: i32 = (c * 15 + j - 1) * P256_BASE_ENTRY
    p256TableMove(out.x, table, at, hit)
    p256TableMove(out.y, table, at + 8, hit)
  }
}

/**
 * `s.sum = p + q` for an affine `q` (its Z taken as 1 and never read), by
 * Renes, Costello and Batina's Algorithm 5 (complete mixed addition for
 * a = -3), step for step in the paper's order. Complete for every `p`, the
 * identity included, and every `q` but the identity, which the comb table
 * never holds: the caller keeps or discards the sum by the digit.
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

/** `acc = sum` limb by limb when `digit` is not 0, and `acc` unchanged when it is: fiat's conditional move. */
const p256BaseKeep = (acc: u32[], sum: u32[], digit: u32): void => {
  if (toI32(acc.length) < 8 || toI32(sum.length) < 8) {
    return
  }
  for (let i: i32 = 0; i < 8; i++) {
    acc[i] = p256FiatCmovznzU32(digit, acc[i], sum[i])
  }
}

/**
 * `out = k * G` for 32 big-endian bytes `k`, in constant time, by the comb
 * described in the module's header: 4 rows from the top down, a doubling
 * between rows, and in each row one entry of each of the 16 sub-tables, read
 * by `p256BaseSelect`, added by `p256PointAddMixed` and kept by
 * `p256BaseKeep`. A zero digit costs what any other does: the scan, the
 * addition and the move all run, and only the move's mask differs. The same
 * point as `p256ScalarMult(out, k, G, s)`, which tests/link/crypto_p256_agree
 * checks bit for bit.
 */
const p256BaseMult = (out: P256ProjectivePoint, k: u8[], s: P256PointScratch): void => {
  const table: u32[] = p256BaseTable()
  p256BaseMultWith(out, k, s, table)
}

/**
 * `p256BaseMult` in the caller's table (`p256BaseTable()`), so that it
 * allocates nothing: what `P256SignScratch` signs with. `out` is the
 * accumulator, overwritten step by step until it holds `k * G`. The entry
 * selected into `s.entry` follows the scalar's digits, so it is wiped before
 * this returns, and `s.sum` with the rest of `s` by the caller's
 * `p256WipeScratch`; the table is a function of G alone, and kept.
 */
const p256BaseMultWith = (out: P256ProjectivePoint, k: u8[], s: P256PointScratch, table: u32[]): void => {
  if (toI32(k.length) < 32) {
    return
  }
  p256SetIdentity(out)
  for (let r: i32 = 3; r >= 0; r--) {
    if (r < 3) {
      p256PointDouble(out, out, s)
    }
    for (let c: i32 = 0; c < 16; c++) {
      const digit: u32 = p256BaseDigit(k, r + 4 * c)
      p256BaseSelect(s.entry, table, c, digit)
      p256PointAddMixed(out, s.entry, s)
      p256BaseKeep(out.x, s.sum.x, digit)
      p256BaseKeep(out.y, s.sum.y, digit)
      p256BaseKeep(out.z, s.sum.z, digit)
    }
  }
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
 * The ECDSA signature (FIPS 186-4 §6.4) of `digest` under `priv`, as `r || s`,
 * 64 bytes, with the deterministic nonce of RFC 6979 §3.2 over HMAC-SHA-256.
 * `digest` is the message's hash, taken as bits2int does: its leftmost 256
 * bits. The same key and digest always give the same signature, and `s` is
 * not normalised to the lower half. Answers `null` for a private key
 * `p256PublicKey` would refuse.
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

/**
 * Whether `sig` (`r || s`) is a valid ECDSA signature of `digest` under the
 * public key `pub` (FIPS 186-4 §6.4.2): `r` and `s` in [1, n), and the
 * x-coordinate of `u1 * G + u2 * Q` equal to `r` mod n, with `w = s^-1`,
 * `u1 = z w` and `u2 = r w`. A key or signature of the wrong length, a key
 * that is not a point on the curve, and a sum that is the identity all answer
 * `false`. Every value here is public, so the answer may be reached by
 * branches; the multiplications are the constant-time ones all the same.
 *
 * ECDSA is malleable, and so is this: when `(r, s)` verifies, `(r, n - s)`
 * verifies too, as FIPS 186-4 and SEC 1 have it. Nothing here asks for the
 * lower `s`, so a protocol that needs one signature per message and key (a
 * signature used as an identifier, say) has to refuse the upper half itself.
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
  p256ScalarInvert(w, w)
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
  const other = new P256ProjectivePoint()
  p256ScalarMult(sum, u1Bytes, p256Generator(), scratch)
  p256ScalarMult(other, u2Bytes, q, scratch)
  p256PointAdd(sum, sum, other, scratch)
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

/** `p256Sign` of the SHA-256 of `msg`: ECDSA with SHA-256 over the whole message. */
export const p256SignSha256 = (priv: Secret<u8[]>, msg: u8[]): u8[] | null => p256Sign(priv, sha256(msg))

/** `p256Verify` of the SHA-256 of `msg`. */
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
  /** FIPS 180-4 §4.2.2's round constants. */
  kt: u32[]
  /** A SHA-256 hash value, schedule and padded tail. */
  hash: u32[]
  schedule: u32[]
  tail: u8[]
  /** An HMAC key block and the message after it. */
  block: u8[]
  /** `V || sep`, where every key update's message starts (RFC 6979 §3.2 steps d, f and h.3). */
  message: u8[]
  /** RFC 6979's `K` and `V`; the last `V` is the nonce. */
  k: u8[]
  v: u8[]
  /** The message's digest, then int2octets of it mod n: RFC 6979's `h1`. */
  h1: u8[]
  /** The digest mod n, `r`, the nonce point's affine x, and `k^-1` in the Montgomery domain. */
  z: u32[]
  r: u32[]
  x: u32[]
  kM: u32[]
  /** The order n and R^2 mod n. */
  n: u32[]
  r2: u32[]
  /** The nonce's multiple of G, the comb table of G and point scratch. */
  point: P256ProjectivePoint
  table: u32[]
  points: P256PointScratch

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
    this.table = p256BaseTable()
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
