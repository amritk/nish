/**
 * `nish/crypto/p384` — ECDSA signature verification over NIST P-384
 * (secp384r1), the curve TLS certificates sign with after P-256.
 *
 *     import { p384VerifySha384 } from "nish/crypto/p384";
 *
 *     const ok: boolean = p384VerifySha384(pub, message, sig);
 *
 * A public key is the uncompressed SEC1 encoding of SEC 1 §2.3.3, 97 bytes:
 * 0x04, then X and Y as 48 big-endian bytes each. A signature is `r` and `s`
 * as 48 big-endian bytes each — the raw form `nish/crypto/p256` takes, not the
 * DER that X.509 and TLS wrap it in; unwrapping that is `nish/crypto/x509`'s
 * business. Anything of the wrong length, a key that is not on the curve, and
 * an `r` or `s` of 0 or n or more answer `false`, never a panic.
 *
 * Only verification is here. There is no signing, so there is no private key
 * and no nonce, and every value the module handles — the key, the message, the
 * digest and the signature — is public. That is why it runs on
 * `nish/crypto/bignum`'s variable-time arithmetic: its branches and loop
 * counts follow those public values and nothing else.
 *
 * **The curve** is `y^2 = x^3 - 3x + b` over GF(p), p = 2^384 - 2^128 - 2^96
 * + 2^32 - 1, with the base point G and its order n from SEC 2 §2.5.1 (FIPS
 * 186-4 §D.1.2.4). Points are projective (X : Y : Z), Z = 0 the identity, and
 * are added and doubled with the complete formulas of J. Renes, C. Costello
 * and L. Batina, "Complete addition formulas for prime order elliptic curves"
 * (EUROCRYPT 2016), Algorithms 4 and 6 for a = -3 — the formulas
 * `nish/crypto/p256` uses, so P + P, P + (-P) and P + O need no case of their
 * own. Verification (SEC 1 §4.1.4) computes u1 G + u2 Q in one pass by
 * Shamir's trick: one doubling per bit and an addition of G, Q or G + Q
 * where either scalar has a bit set. The field and the scalars are
 * `bignum`'s Montgomery arithmetic modulo p and n, and both inversions are
 * Fermat's, by the public exponents p - 2 and n - 2.
 *
 * Everything here is written for this module from the documents it names;
 * nothing is ported.
 *
 * ECDSA signatures are malleable: when (r, s) verifies, so does (r, n - s).
 * A caller that needs one encoding per signature must refuse the high `s`
 * itself.
 */
import { sha256 } from "nish/crypto/sha256"
import { sha384 } from "nish/crypto/sha512"
import {
  BnModulus,
  bnCompare,
  bnCopy,
  bnFromBytes,
  bnFromMont,
  bnIsZero,
  bnModAdd,
  bnModSub,
  bnModulus,
  bnMontInvertPrime,
  bnMontMul,
  bnReduceOnce,
  bnToMont,
} from "nish/crypto/bignum"

/** Bytes in a coordinate, a scalar and each half of a signature. */
export const P384_SCALAR_SIZE: i32 = 48

/** Bytes in an uncompressed public key: 0x04, X, Y. */
export const P384_POINT_SIZE: i32 = 97

/** Bytes in a signature: `r || s`. */
export const P384_SIGNATURE_SIZE: i32 = 96

/** Limbs in a field element or scalar: 384 bits of 32. */
const P384_LIMBS: i32 = 12

/** The field prime p = 2^384 - 2^128 - 2^96 + 2^32 - 1, as plain limbs. */
const p384Prime = (): u32[] => [
  0xffffffff, 0x00000000, 0x00000000, 0xffffffff, 0xfffffffe, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff,
  0xffffffff, 0xffffffff, 0xffffffff,
]

/** The group order n (SEC 2 §2.5.1), as plain limbs. */
const p384Order = (): u32[] => [
  0xccc52973, 0xecec196a, 0x48b0a77a, 0x581a0db2, 0xf4372ddf, 0xc7634d81, 0xffffffff, 0xffffffff, 0xffffffff,
  0xffffffff, 0xffffffff, 0xffffffff,
]

/** The curve's `b` (SEC 2 §2.5.1), as plain limbs. */
const p384CurveB = (): u32[] => [
  0xd3ec2aef, 0x2a85c8ed, 0x8a2ed19d, 0xc656398d, 0x5013875a, 0x0314088f, 0xfe814112, 0x181d9c6e, 0xe3f82d19,
  0x988e056b, 0xe23ee7e4, 0xb3312fa7,
]

/** The base point's x (SEC 2 §2.5.1), as plain limbs. */
const p384GeneratorX = (): u32[] => [
  0x72760ab7, 0x3a545e38, 0xbf55296c, 0x5502f25d, 0x82542a38, 0x59f741e0, 0x8ba79b98, 0x6e1d3b62, 0xf320ad74,
  0x8eb1c71e, 0xbe8b0537, 0xaa87ca22,
]

/** The base point's y (SEC 2 §2.5.1), as plain limbs. */
const p384GeneratorY = (): u32[] => [
  0x90ea0e5f, 0x7a431d7c, 0x1d7e819d, 0x0a60b1ce, 0xb5f0b8c0, 0xe9da3113, 0x289a147c, 0xf8f41dbd, 0x9292dc29,
  0x5d9e98bf, 0x96262c6f, 0x3617de4a,
]

/** A fresh twelve-limb array, zero. */
const p384Limbs = (): u32[] => new Array<u32>(P384_LIMBS)

/** A point (X : Y : Z), each coordinate in the Montgomery domain mod p. */
class P384Point {
  x: u32[]
  y: u32[]
  z: u32[]

  /** All three coordinates zero, which is no point: the caller fills them. */
  constructor() {
    this.x = p384Limbs()
    this.y = p384Limbs()
    this.z = p384Limbs()
  }
}

/**
 * The two moduli, the curve's `b` in the Montgomery domain, and the
 * temporaries of one addition or doubling, made once per verification.
 */
class P384Curve {
  field: BnModulus
  order: BnModulus
  b: u32[]
  t0: u32[]
  t1: u32[]
  t2: u32[]
  t3: u32[]
  t4: u32[]
  sum: P384Point

  constructor(field: BnModulus, order: BnModulus) {
    this.field = field
    this.order = order
    this.b = p384Limbs()
    bnToMont(this.b, p384CurveB(), field)
    this.t0 = p384Limbs()
    this.t1 = p384Limbs()
    this.t2 = p384Limbs()
    this.t3 = p384Limbs()
    this.t4 = p384Limbs()
    this.sum = new P384Point()
  }
}

/** The curve's constants, or `null` if `bnModulus` refused p or n, which it never does. */
const p384Curve = (): P384Curve | null => {
  const field: BnModulus | null = bnModulus(p384Prime())
  const order: BnModulus | null = bnModulus(p384Order())
  if (field === null || order === null) {
    return null
  }
  return new P384Curve(field, order)
}

/** `out = a b` in the field. */
const p384Mul = (out: u32[], a: u32[], b: u32[], c: P384Curve): void => bnMontMul(out, a, b, c.field)

/** `out = a + b` in the field. */
const p384Add = (out: u32[], a: u32[], b: u32[], c: P384Curve): void => bnModAdd(out, a, b, c.field)

/** `out = a - b` in the field. */
const p384Sub = (out: u32[], a: u32[], b: u32[], c: P384Curve): void => bnModSub(out, a, b, c.field)

/** `out = p`, coordinate by coordinate. */
const p384PointCopy = (out: P384Point, p: P384Point): void => {
  bnCopy(out.x, p.x)
  bnCopy(out.y, p.y)
  bnCopy(out.z, p.z)
}

/** `p = (0 : 1 : 0)`, the identity. */
const p384SetIdentity = (p: P384Point, c: P384Curve): void => {
  bnCopy(p.x, p384Limbs())
  bnCopy(p.y, c.field.one)
  bnCopy(p.z, p384Limbs())
}

/**
 * `out = p + q`, by Renes, Costello and Batina's Algorithm 4 (complete
 * addition for a = -3), step for step in the paper's order and with its
 * names, as `nish/crypto/p256` writes it. `out` may be `p` or `q`: the sum is
 * built in the curve's scratch and copied out.
 */
const p384PointAdd = (out: P384Point, p: P384Point, q: P384Point, c: P384Curve): void => {
  const t0: u32[] = c.t0
  const t1: u32[] = c.t1
  const t2: u32[] = c.t2
  const t3: u32[] = c.t3
  const t4: u32[] = c.t4
  const x3: u32[] = c.sum.x
  const y3: u32[] = c.sum.y
  const z3: u32[] = c.sum.z
  p384Mul(t0, p.x, q.x, c) // 1
  p384Mul(t1, p.y, q.y, c)
  p384Mul(t2, p.z, q.z, c)
  p384Add(t3, p.x, p.y, c)
  p384Add(t4, q.x, q.y, c) // 5
  p384Mul(t3, t3, t4, c)
  p384Add(t4, t0, t1, c)
  p384Sub(t3, t3, t4, c)
  p384Add(t4, p.y, p.z, c)
  p384Add(x3, q.y, q.z, c) // 10
  p384Mul(t4, t4, x3, c)
  p384Add(x3, t1, t2, c)
  p384Sub(t4, t4, x3, c)
  p384Add(x3, p.x, p.z, c)
  p384Add(y3, q.x, q.z, c) // 15
  p384Mul(x3, x3, y3, c)
  p384Add(y3, t0, t2, c)
  p384Sub(y3, x3, y3, c)
  p384Mul(z3, c.b, t2, c)
  p384Sub(x3, y3, z3, c) // 20
  p384Add(z3, x3, x3, c)
  p384Add(x3, x3, z3, c)
  p384Sub(z3, t1, x3, c)
  p384Add(x3, t1, x3, c)
  p384Mul(y3, c.b, y3, c) // 25
  p384Add(t1, t2, t2, c)
  p384Add(t2, t1, t2, c)
  p384Sub(y3, y3, t2, c)
  p384Sub(y3, y3, t0, c)
  p384Add(t1, y3, y3, c) // 30
  p384Add(y3, t1, y3, c)
  p384Add(t1, t0, t0, c)
  p384Add(t0, t1, t0, c)
  p384Sub(t0, t0, t2, c)
  p384Mul(t1, t4, y3, c) // 35
  p384Mul(t2, t0, y3, c)
  p384Mul(y3, x3, z3, c)
  p384Add(y3, y3, t2, c)
  p384Mul(x3, t3, x3, c)
  p384Sub(x3, x3, t1, c) // 40
  p384Mul(z3, t4, z3, c)
  p384Mul(t1, t3, t0, c)
  p384Add(z3, z3, t1, c)
  p384PointCopy(out, c.sum)
}

/**
 * `out = 2p`, by Renes, Costello and Batina's Algorithm 6 (exception-free
 * doubling for a = -3), step for step. `out` may be `p`.
 */
const p384PointDouble = (out: P384Point, p: P384Point, c: P384Curve): void => {
  const t0: u32[] = c.t0
  const t1: u32[] = c.t1
  const t2: u32[] = c.t2
  const t3: u32[] = c.t3
  const x3: u32[] = c.sum.x
  const y3: u32[] = c.sum.y
  const z3: u32[] = c.sum.z
  p384Mul(t0, p.x, p.x, c) // 1
  p384Mul(t1, p.y, p.y, c)
  p384Mul(t2, p.z, p.z, c)
  p384Mul(t3, p.x, p.y, c)
  p384Add(t3, t3, t3, c) // 5
  p384Mul(z3, p.x, p.z, c)
  p384Add(z3, z3, z3, c)
  p384Mul(y3, c.b, t2, c)
  p384Sub(y3, y3, z3, c)
  p384Add(x3, y3, y3, c) // 10
  p384Add(y3, x3, y3, c)
  p384Sub(x3, t1, y3, c)
  p384Add(y3, t1, y3, c)
  p384Mul(y3, x3, y3, c)
  p384Mul(x3, x3, t3, c) // 15
  p384Add(t3, t2, t2, c)
  p384Add(t2, t2, t3, c)
  p384Mul(z3, c.b, z3, c)
  p384Sub(z3, z3, t2, c)
  p384Sub(z3, z3, t0, c) // 20
  p384Add(t3, z3, z3, c)
  p384Add(z3, z3, t3, c)
  p384Add(t3, t0, t0, c)
  p384Add(t0, t3, t0, c)
  p384Sub(t0, t0, t2, c) // 25
  p384Mul(t0, t0, z3, c)
  p384Add(y3, y3, t0, c)
  p384Mul(t0, p.y, p.z, c)
  p384Add(t0, t0, t0, c)
  p384Mul(z3, t0, z3, c) // 30
  p384Sub(x3, x3, z3, c)
  p384Mul(z3, t0, t1, c)
  p384Add(z3, z3, z3, c)
  p384Add(z3, z3, z3, c)
  p384PointCopy(out, c.sum)
}

/** The affine point (x, y), plain limbs below p, as (x R : y R : R). */
const p384AffinePoint = (x: u32[], y: u32[], c: P384Curve): P384Point => {
  const p = new P384Point()
  bnToMont(p.x, x, c.field)
  bnToMont(p.y, y, c.field)
  bnCopy(p.z, c.field.one)
  return p
}

/**
 * The point a SEC 1 §2.3.4 uncompressed encoding names, or `null` when it
 * names none: a length other than 97, a first byte other than 0x04, a
 * coordinate of p or more, or a pair that is not on the curve. The identity
 * has no 97-byte encoding (SEC 1 writes it as the single byte 0x00), so the
 * length refuses it, and its would-be spelling as (0, 0) is not on the curve.
 * A point on the curve is in the group of order n, because the curve's
 * cofactor is 1, so no further check is owed.
 */
const p384DecodePoint = (bytes: u8[], c: P384Curve): P384Point | null => {
  if (toI32(bytes.length) !== P384_POINT_SIZE || toI32(bytes[0]) !== 4) {
    return null
  }
  const x: u32[] = bnFromBytes(bytes, 1, P384_SCALAR_SIZE, P384_LIMBS)
  const y: u32[] = bnFromBytes(bytes, P384_SCALAR_SIZE + 1, P384_SCALAR_SIZE, P384_LIMBS)
  if (bnCompare(x, c.field.m) >= 0 || bnCompare(y, c.field.m) >= 0) {
    return null
  }
  const p: P384Point = p384AffinePoint(x, y, c)
  // y^2 = x^3 - 3x + b, both sides in the Montgomery domain.
  const lhs: u32[] = p384Limbs()
  const rhs: u32[] = p384Limbs()
  const t: u32[] = p384Limbs()
  p384Mul(lhs, p.y, p.y, c)
  p384Mul(rhs, p.x, p.x, c)
  p384Mul(rhs, rhs, p.x, c)
  p384Add(t, p.x, p.x, c)
  p384Add(t, t, p.x, c)
  p384Sub(rhs, rhs, t, c)
  p384Add(rhs, rhs, c.b, c)
  if (bnCompare(lhs, rhs) !== 0) {
    return null
  }
  return p
}

/** Whether bit `i` (0 the least significant) of the plain limbs `a` is set. */
const p384Bit = (a: u32[], i: i32): boolean => {
  const limb: i32 = i >> 5
  return ((a[limb] >> toU32(i & 31)) & 1) === 1
}

/**
 * `out = u1 G + u2 Q` for plain scalars `u1` and `u2` below n, by Shamir's
 * trick: from the top bit down, double, then add G, Q or G + Q as the two
 * bits ask. The branches follow the scalars, which verification computes
 * from public values.
 */
const p384TwinMult = (out: P384Point, u1: u32[], u2: u32[], q: P384Point, c: P384Curve): void => {
  const g: P384Point = p384AffinePoint(p384GeneratorX(), p384GeneratorY(), c)
  const both = new P384Point()
  p384PointAdd(both, g, q, c)
  p384SetIdentity(out, c)
  for (let i: i32 = P384_LIMBS * 32 - 1; i >= 0; i--) {
    p384PointDouble(out, out, c)
    const a: boolean = p384Bit(u1, i)
    const b: boolean = p384Bit(u2, i)
    if (a && b) {
      p384PointAdd(out, out, both, c)
    } else if (a) {
      p384PointAdd(out, out, g, c)
    } else if (b) {
      p384PointAdd(out, out, q, c)
    }
  }
}

/**
 * Whether `sig`, as `r || s`, is a P-384 ECDSA signature of `digest` under
 * the public key `pub` (SEC 1 §4.1.4).
 *
 * `digest` is the message's hash, of any length: its leftmost 384 bits are
 * the integer the signature covers, taken mod n, so a SHA-512 digest is cut
 * to its first 48 bytes and a SHA-256 one is used whole. `pub` is 97 bytes of
 * uncompressed SEC 1 on the curve and `sig` is 96 bytes with `r` and `s` each
 * in [1, n); anything else answers `false`. So does a sum u1 G + u2 Q at the
 * identity, which has no x for `r` to equal.
 *
 * Every input is public, and the check takes time that depends on them.
 */
export const p384Verify = (pub: u8[], digest: u8[], sig: u8[]): boolean => {
  if (toI32(sig.length) !== P384_SIGNATURE_SIZE) {
    return false
  }
  const c: P384Curve | null = p384Curve()
  if (c === null) {
    return false
  }
  const q: P384Point | null = p384DecodePoint(pub, c)
  if (q === null) {
    return false
  }
  const n: BnModulus = c.order
  const r: u32[] = bnFromBytes(sig, 0, P384_SCALAR_SIZE, P384_LIMBS)
  const w: u32[] = bnFromBytes(sig, P384_SCALAR_SIZE, P384_SCALAR_SIZE, P384_LIMBS)
  if (bnIsZero(r) || bnIsZero(w) || bnCompare(r, n.m) >= 0 || bnCompare(w, n.m) >= 0) {
    return false
  }
  // z: the leftmost min(384, 8 × length) bits of the digest, below 2^384 <
  // 2n, so one subtraction reduces it.
  const digestLength: i32 = toI32(digest.length)
  const z: u32[] = p384Limbs()
  bnReduceOnce(
    z,
    bnFromBytes(digest, 0, digestLength < P384_SCALAR_SIZE ? digestLength : P384_SCALAR_SIZE, P384_LIMBS),
    n
  )
  // w = s^-1 in the Montgomery domain; u1 = z w and u2 = r w multiply a
  // plain value by it, so they come out plain.
  bnToMont(w, w, n)
  bnMontInvertPrime(w, w, n)
  const u1: u32[] = p384Limbs()
  const u2: u32[] = p384Limbs()
  bnMontMul(u1, z, w, n)
  bnMontMul(u2, r, w, n)

  const sum = new P384Point()
  p384TwinMult(sum, u1, u2, q, c)
  if (bnIsZero(sum.z)) {
    return false
  }
  // The affine x = X / Z, out of the Montgomery domain, then mod n: x < p <
  // 2n, so one subtraction reduces it.
  const x: u32[] = p384Limbs()
  bnMontInvertPrime(x, sum.z, c.field)
  p384Mul(x, sum.x, x, c)
  bnFromMont(x, x, c.field)
  bnReduceOnce(x, x, n)
  return bnCompare(x, r) === 0
}

/** `p384Verify` of the SHA-384 of `msg`: ECDSA with SHA-384, as TLS's ecdsa_secp384r1_sha384 signs. */
export const p384VerifySha384 = (pub: u8[], msg: u8[], sig: u8[]): boolean =>
  p384Verify(pub, sha384(msg), sig)

/** `p384Verify` of the SHA-256 of `msg`: ECDSA with SHA-256, as a P-384 certificate may be signed. */
export const p384VerifySha256 = (pub: u8[], msg: u8[], sig: u8[]): boolean =>
  p384Verify(pub, sha256(msg), sig)
