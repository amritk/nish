/**
 * `nish/crypto/p384` — ECDSA signature verification over NIST P-384
 * (secp384r1).
 *
 *     import { p384DerSignatureRS, p384VerifySha384 } from "nish/crypto/p384";
 *
 *     const rs: u8[] | null = p384DerSignatureRS(derSig);       // 96 bytes, r || s
 *     const ok: boolean = rs !== null && p384VerifySha384(pub, message, rs);
 *
 * A public key is the uncompressed SEC1 encoding of SEC 1 §2.3.3, `04 || X ||
 * Y`, 97 bytes; a signature is `r` and `s` as 48 big-endian bytes each. A key
 * of the wrong length, with another first byte, with a coordinate of p or more
 * or off the curve, and an `r` or `s` of 0 or n or more all answer `false`,
 * never a panic. `p384DerSignatureRS` takes the DER `ECDSA-Sig-Value` a TLS
 * `CertificateVerify` or an X.509 signature carries to the `r || s` the
 * verifier wants, strictly.
 *
 * This module verifies and does nothing else: there is no private key and no
 * nonce here, so every value it touches is public — a key someone sent, a
 * digest and a signature — and its arithmetic may branch and take variable
 * time. That is why it can be small: the field and the scalars are
 * `RsaMont` from `nish/crypto/rsa`, generic Montgomery multiplication on
 * twelve limbs, rather than a curve-specific constant-time implementation
 * like `nish/crypto/p256`'s.
 *
 * **The curve** is `y^2 = x^3 - 3x + b` over GF(p), p = 2^384 - 2^128 - 2^96
 * + 2^32 - 1, with the base point G and its order n from SEC 2 §2.5.1 (FIPS
 * 186-4 §D.1.2.4). Its cofactor is 1, so a point on the curve is in the group
 * of order n and the on-curve check is the whole of SEC 1 §3.2.2.1's key
 * validation. Points are Jacobian, (X : Y : Z) for (X / Z^2, Y / Z^3), Z = 0
 * the identity, and are doubled with dbl-2001-b and added with add-2007-bl
 * of the Explicit-Formulas Database (https://hyperelliptic.org/EFD/,
 * g1p/auto-shortw-jacobian-3.html). Those addition formulas are not complete,
 * so `p384Add` checks for the identity and for P + P and P + (-P) and handles
 * each, which it may, since nothing here is secret.
 *
 * **Verification** is SEC 1 §4.1.4: `u1 G + u2 Q` by Shamir's trick, one
 * doubling per bit and at most one addition of G, Q or G + Q; the x of the
 * sum reduced mod n is compared with `r`. The digest's leftmost 384 bits are
 * the integer signed (step 5), whatever the hash. Nothing here is ported; it
 * is written for this module from the documents it names.
 *
 * Private names carry the `p384` prefix because a `std/` module's private
 * functions share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 */
import {
  RsaMont,
  rsaLimbsBelow,
  rsaLimbsFromBytes,
  rsaLimbsIsZero,
  rsaLimbsToBytes,
  rsaMontNew,
} from "nish/crypto/rsa"
import { sha384 } from "nish/crypto/sha512"
import { timingSafeEqual } from "nish/crypto/ct"

/** Bytes in a scalar or a coordinate. */
export const P384_SCALAR_SIZE: i32 = 48

/** Bytes in an uncompressed SEC1 point, `04 || X || Y`. */
export const P384_POINT_SIZE: i32 = 97

/** Bytes in a signature as `p384Verify` takes it, `r || s`. */
export const P384_SIGNATURE_SIZE: i32 = 96

/** Limbs in a field element or a scalar. */
const P384_LIMBS: i32 = 12

/** The bit length of p and of n, which Shamir's loop walks down from. */
const P384_BITS: i32 = 384

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Twelve little-endian limbs, least significant first. */
const p384Limbs = (
  l0: u32,
  l1: u32,
  l2: u32,
  l3: u32,
  l4: u32,
  l5: u32,
  l6: u32,
  l7: u32,
  l8: u32,
  l9: u32,
  l10: u32,
  l11: u32
): u32[] => {
  const out: u32[] = new Array<u32>(12)
  if (toI32(out.length) < 12) {
    return out
  }
  out[0] = l0
  out[1] = l1
  out[2] = l2
  out[3] = l3
  out[4] = l4
  out[5] = l5
  out[6] = l6
  out[7] = l7
  out[8] = l8
  out[9] = l9
  out[10] = l10
  out[11] = l11
  return out
}

/** The field prime p = 2^384 - 2^128 - 2^96 + 2^32 - 1. */
const p384Prime = (): u32[] =>
  p384Limbs(
    0xffffffff,
    0,
    0,
    0xffffffff,
    0xfffffffe,
    0xffffffff,
    0xffffffff,
    0xffffffff,
    0xffffffff,
    0xffffffff,
    0xffffffff,
    0xffffffff
  )

/** p - 2, the exponent that inverts by Fermat's little theorem. */
const p384PrimeMinusTwo = (): u32[] =>
  p384Limbs(
    0xfffffffd,
    0,
    0,
    0xffffffff,
    0xfffffffe,
    0xffffffff,
    0xffffffff,
    0xffffffff,
    0xffffffff,
    0xffffffff,
    0xffffffff,
    0xffffffff
  )

/** The group order n (SEC 2 §2.5.1). */
const p384Order = (): u32[] =>
  p384Limbs(
    0xccc52973,
    0xecec196a,
    0x48b0a77a,
    0x581a0db2,
    0xf4372ddf,
    0xc7634d81,
    0xffffffff,
    0xffffffff,
    0xffffffff,
    0xffffffff,
    0xffffffff,
    0xffffffff
  )

/** n - 2, for inverting `s`. */
const p384OrderMinusTwo = (): u32[] =>
  p384Limbs(
    0xccc52971,
    0xecec196a,
    0x48b0a77a,
    0x581a0db2,
    0xf4372ddf,
    0xc7634d81,
    0xffffffff,
    0xffffffff,
    0xffffffff,
    0xffffffff,
    0xffffffff,
    0xffffffff
  )

/** The curve's b (SEC 2 §2.5.1), plain. */
const p384CurveB = (): u32[] =>
  p384Limbs(
    0xd3ec2aef,
    0x2a85c8ed,
    0x8a2ed19d,
    0xc656398d,
    0x5013875a,
    0x0314088f,
    0xfe814112,
    0x181d9c6e,
    0xe3f82d19,
    0x988e056b,
    0xe23ee7e4,
    0xb3312fa7
  )

/** G's x, plain. */
const p384GeneratorX = (): u32[] =>
  p384Limbs(
    0x72760ab7,
    0x3a545e38,
    0xbf55296c,
    0x5502f25d,
    0x82542a38,
    0x59f741e0,
    0x8ba79b98,
    0x6e1d3b62,
    0xf320ad74,
    0x8eb1c71e,
    0xbe8b0537,
    0xaa87ca22
  )

/** G's y, plain. */
const p384GeneratorY = (): u32[] =>
  p384Limbs(
    0x90ea0e5f,
    0x7a431d7c,
    0x1d7e819d,
    0x0a60b1ce,
    0xb5f0b8c0,
    0xe9da3113,
    0x289a147c,
    0xf8f41dbd,
    0x9292dc29,
    0x5d9e98bf,
    0x96262c6f,
    0x3617de4a
  )

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

/** A Jacobian point, every coordinate in the field's Montgomery domain; Z = 0 is the identity. */
class P384Point {
  x: u32[]
  y: u32[]
  z: u32[]

  constructor() {
    this.x = new Array<u32>(12)
    this.y = new Array<u32>(12)
    this.z = new Array<u32>(12)
  }
}

/**
 * The field and its scratch. The seven temporaries are kept here so that
 * a doubling or an addition, run about 700 times a verification, allocates
 * nothing.
 */
class P384Field {
  fp: RsaMont
  t0: u32[]
  t1: u32[]
  t2: u32[]
  t3: u32[]
  t4: u32[]
  t5: u32[]
  t6: u32[]

  constructor(fp: RsaMont) {
    this.fp = fp
    this.t0 = new Array<u32>(12)
    this.t1 = new Array<u32>(12)
    this.t2 = new Array<u32>(12)
    this.t3 = new Array<u32>(12)
    this.t4 = new Array<u32>(12)
    this.t5 = new Array<u32>(12)
    this.t6 = new Array<u32>(12)
  }
}

/** `out = a`, limb by limb. */
const p384Copy = (out: u32[], a: u32[]): void => {
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(a.length); i++) {
    out[i] = a[i]
  }
}

/** Whether `a` and `b` hold the same limbs. Both are public. */
const p384Equal = (a: u32[], b: u32[]): boolean => {
  if (toI32(a.length) !== toI32(b.length)) {
    return false
  }
  for (let i: i32 = 0; i < toI32(a.length) && i < toI32(b.length); i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

/** Whether `p` is the identity. */
const p384IsIdentity = (p: P384Point): boolean => rsaLimbsIsZero(p.z, P384_LIMBS)

/** `out = p`. */
const p384PointCopy = (out: P384Point, p: P384Point): void => {
  p384Copy(out.x, p.x)
  p384Copy(out.y, p.y)
  p384Copy(out.z, p.z)
}

/** `out = O`, the identity. */
const p384SetIdentity = (out: P384Point): void => {
  for (let i: i32 = 0; i < toI32(out.z.length); i++) {
    out.z[i] = 0
  }
}

/**
 * `out = 2p` by dbl-2001-b, for a = -3. `out` may be `p`: every coordinate
 * of `p` is read before the first is written. The identity doubles to itself,
 * since its Z = 0 gives Z3 = 0; there is no point of order 2 on a curve of
 * prime order to give Y = 0.
 */
const p384Double = (f: P384Field, out: P384Point, p: P384Point): void => {
  const fp: RsaMont = f.fp
  const delta: u32[] = f.t0
  const gamma: u32[] = f.t1
  const beta: u32[] = f.t2
  const alpha: u32[] = f.t3
  const t: u32[] = f.t4
  const z3: u32[] = f.t5
  const x3: u32[] = f.t6
  fp.mul(delta, p.z, p.z)
  fp.mul(gamma, p.y, p.y)
  fp.mul(beta, p.x, gamma)
  // alpha = 3 (X1 - delta) (X1 + delta)
  fp.sub(alpha, p.x, delta)
  fp.add(t, p.x, delta)
  fp.mul(alpha, alpha, t)
  fp.add(t, alpha, alpha)
  fp.add(alpha, t, alpha)
  // Z3 = (Y1 + Z1)^2 - gamma - delta
  fp.add(z3, p.y, p.z)
  fp.mul(z3, z3, z3)
  fp.sub(z3, z3, gamma)
  fp.sub(z3, z3, delta)
  // X3 = alpha^2 - 8 beta
  fp.add(beta, beta, beta)
  fp.add(beta, beta, beta)
  fp.mul(x3, alpha, alpha)
  fp.sub(x3, x3, beta)
  fp.sub(x3, x3, beta)
  // Y3 = alpha (4 beta - X3) - 8 gamma^2
  fp.sub(beta, beta, x3)
  fp.mul(beta, alpha, beta)
  fp.mul(gamma, gamma, gamma)
  fp.add(gamma, gamma, gamma)
  fp.add(gamma, gamma, gamma)
  fp.add(gamma, gamma, gamma)
  fp.sub(out.y, beta, gamma)
  p384Copy(out.x, x3)
  p384Copy(out.z, z3)
}

/**
 * `out = p + q` by add-2007-bl. The formulas divide by nothing but are wrong
 * for an identity input and for p = ±q, so those are answered first: the
 * other point, a doubling, or the identity. `out` may be `p` or `q`.
 */
const p384Add = (f: P384Field, out: P384Point, p: P384Point, q: P384Point): void => {
  if (p384IsIdentity(p)) {
    p384PointCopy(out, q)
    return
  }
  if (p384IsIdentity(q)) {
    p384PointCopy(out, p)
    return
  }
  const fp: RsaMont = f.fp
  const z1z1: u32[] = f.t0
  const z2z2: u32[] = f.t1
  const u1: u32[] = f.t2
  const h: u32[] = f.t3
  const s1: u32[] = f.t4
  const r: u32[] = f.t5
  const z3: u32[] = f.t6
  fp.mul(z1z1, p.z, p.z)
  fp.mul(z2z2, q.z, q.z)
  fp.mul(u1, p.x, z2z2)
  fp.mul(h, q.x, z1z1)
  fp.mul(s1, p.y, q.z)
  fp.mul(s1, s1, z2z2)
  fp.mul(r, q.y, p.z)
  fp.mul(r, r, z1z1)
  // H = U2 - U1 and r = S2 - S1: both zero for p = q, only H for p = -q.
  fp.sub(h, h, u1)
  fp.sub(r, r, s1)
  if (rsaLimbsIsZero(h, P384_LIMBS)) {
    if (rsaLimbsIsZero(r, P384_LIMBS)) {
      p384Double(f, out, p)
    } else {
      p384SetIdentity(out)
    }
    return
  }
  fp.add(r, r, r)
  // Z3 = ((Z1 + Z2)^2 - Z1Z1 - Z2Z2) H
  fp.add(z3, p.z, q.z)
  fp.mul(z3, z3, z3)
  fp.sub(z3, z3, z1z1)
  fp.sub(z3, z3, z2z2)
  fp.mul(z3, z3, h)
  // I = (2H)^2 into z1z1, J = H I into z2z2, V = U1 I into u1.
  fp.add(z1z1, h, h)
  fp.mul(z1z1, z1z1, z1z1)
  fp.mul(z2z2, h, z1z1)
  fp.mul(u1, u1, z1z1)
  // X3 = r^2 - J - 2V, into h, which is done with.
  fp.mul(h, r, r)
  fp.sub(h, h, z2z2)
  fp.sub(h, h, u1)
  fp.sub(h, h, u1)
  // Y3 = r (V - X3) - 2 S1 J
  fp.sub(u1, u1, h)
  fp.mul(u1, r, u1)
  fp.mul(s1, s1, z2z2)
  fp.add(s1, s1, s1)
  fp.sub(out.y, u1, s1)
  p384Copy(out.x, h)
  p384Copy(out.z, z3)
}

/** Bit `i` of the little-endian limbs `e`. */
const p384Bit = (e: u32[], i: i32): boolean => {
  const limb: i32 = i >> 5
  if (limb < 0 || limb >= toI32(e.length)) {
    return false
  }
  return ((e[limb] >> toU32(i & 31)) & 1) !== 0
}

/**
 * The public key `pub` as a point in the Montgomery domain, or `null` unless
 * it is `04 || X || Y` with X and Y below p and on the curve (SEC 1 §2.3.4
 * and §3.2.2.1). There is no encoding of the identity at this length, and
 * with cofactor 1 every point on the curve has order n.
 */
const p384DecodePoint = (fp: RsaMont, pub: u8[]): P384Point | null => {
  if (toI32(pub.length) !== P384_POINT_SIZE || toI32(pub[0]) !== 4) {
    return null
  }
  const prime: u32[] = p384Prime()
  const x: u32[] = rsaLimbsFromBytes(pub, 1, P384_SCALAR_SIZE, P384_LIMBS)
  const y: u32[] = rsaLimbsFromBytes(pub, 1 + P384_SCALAR_SIZE, P384_SCALAR_SIZE, P384_LIMBS)
  if (!rsaLimbsBelow(x, prime, P384_LIMBS) || !rsaLimbsBelow(y, prime, P384_LIMBS)) {
    return null
  }
  const out = new P384Point()
  fp.toMont(out.x, x)
  fp.toMont(out.y, y)
  const one: u32[] = new Array<u32>(12)
  one[0] = 1
  fp.toMont(out.z, one)
  // y^2 = x^3 - 3x + b
  const lhs: u32[] = new Array<u32>(12)
  const rhs: u32[] = new Array<u32>(12)
  const t: u32[] = new Array<u32>(12)
  fp.mul(lhs, out.y, out.y)
  fp.mul(rhs, out.x, out.x)
  fp.mul(rhs, rhs, out.x)
  fp.add(t, out.x, out.x)
  fp.add(t, t, out.x)
  fp.sub(rhs, rhs, t)
  fp.toMont(t, p384CurveB())
  fp.add(rhs, rhs, t)
  if (!p384Equal(lhs, rhs)) {
    return null
  }
  return out
}

/** G as a point in the Montgomery domain. */
const p384Generator = (fp: RsaMont): P384Point => {
  const out = new P384Point()
  fp.toMont(out.x, p384GeneratorX())
  fp.toMont(out.y, p384GeneratorY())
  const one: u32[] = new Array<u32>(12)
  one[0] = 1
  fp.toMont(out.z, one)
  return out
}

/** Whether the scalar `a` is in [1, n - 1]. */
const p384ScalarInRange = (a: u32[], n: u32[]): boolean =>
  !rsaLimbsIsZero(a, P384_LIMBS) && rsaLimbsBelow(a, n, P384_LIMBS)

// ---------------------------------------------------------------------------
// ECDSA
// ---------------------------------------------------------------------------

/**
 * Whether `sig`, `r || s` as 48 big-endian bytes each, is a valid ECDSA
 * signature of `digest` under the public key `pub`, uncompressed SEC1 (SEC 1
 * §4.1.4). The digest's leftmost 384 bits are the integer signed, so a
 * SHA-384 digest is used whole and a longer one is cut; a shorter one is used
 * whole as it is.
 *
 * ECDSA is malleable, and so is this: when `(r, s)` verifies, `(r, n - s)`
 * verifies too, as FIPS 186-4 and SEC 1 have it. Nothing here asks for the
 * lower `s`, so a protocol that needs one signature per message and key has
 * to refuse the upper half itself.
 */
export const p384Verify = (pub: u8[], digest: u8[], sig: u8[]): boolean => {
  if (toI32(sig.length) !== P384_SIGNATURE_SIZE) {
    return false
  }
  const fp: RsaMont | null = rsaMontNew(p384Prime(), P384_LIMBS)
  const n: u32[] = p384Order()
  const fn: RsaMont | null = rsaMontNew(n, P384_LIMBS)
  if (fp === null || fn === null) {
    return false
  }
  const q: P384Point | null = p384DecodePoint(fp, pub)
  if (q === null) {
    return false
  }
  const r: u32[] = rsaLimbsFromBytes(sig, 0, P384_SCALAR_SIZE, P384_LIMBS)
  const s: u32[] = rsaLimbsFromBytes(sig, P384_SCALAR_SIZE, P384_SCALAR_SIZE, P384_LIMBS)
  if (!p384ScalarInRange(r, n) || !p384ScalarInRange(s, n)) {
    return false
  }
  // Step 5: e is the leftmost 384 bits; 2^384 < 2n, so one subtraction
  // reduces it.
  let take: i32 = toI32(digest.length)
  if (take > P384_SCALAR_SIZE) {
    take = P384_SCALAR_SIZE
  }
  const e: u32[] = rsaLimbsFromBytes(digest, 0, take, P384_LIMBS)
  if (!rsaLimbsBelow(e, n, P384_LIMBS)) {
    fn.sub(e, e, n)
  }
  // w = s^-1 in the Montgomery domain; u1 = e w and u2 = r w multiply a plain
  // value by it, so they come out plain.
  const w: u32[] = new Array<u32>(12)
  fn.toMont(w, s)
  fn.pow(w, w, p384OrderMinusTwo())
  const u1: u32[] = new Array<u32>(12)
  const u2: u32[] = new Array<u32>(12)
  fn.mul(u1, e, w)
  fn.mul(u2, r, w)

  // Shamir's trick: u1 G + u2 Q in one pass down the bits.
  const f = new P384Field(fp)
  const g: P384Point = p384Generator(fp)
  const both = new P384Point()
  p384Add(f, both, g, q)
  const sum = new P384Point()
  for (let i: i32 = P384_BITS - 1; i >= 0; i--) {
    p384Double(f, sum, sum)
    const a: boolean = p384Bit(u1, i)
    const b: boolean = p384Bit(u2, i)
    if (a && b) {
      p384Add(f, sum, sum, both)
    } else if (a) {
      p384Add(f, sum, sum, g)
    } else if (b) {
      p384Add(f, sum, sum, q)
    }
  }
  if (p384IsIdentity(sum)) {
    return false
  }
  // x = X / Z^2, out of the domain, reduced mod n; p < 2n, so once.
  const zInv: u32[] = new Array<u32>(12)
  fp.pow(zInv, sum.z, p384PrimeMinusTwo())
  fp.mul(zInv, zInv, zInv)
  const x: u32[] = new Array<u32>(12)
  fp.mul(x, sum.x, zInv)
  fp.fromMont(x, x)
  if (!rsaLimbsBelow(x, n, P384_LIMBS)) {
    fn.sub(x, x, n)
  }
  const rBytes: u8[] = rsaLimbsToBytes(r, P384_SCALAR_SIZE)
  return timingSafeEqual(rsaLimbsToBytes(x, P384_SCALAR_SIZE), rBytes)
}

/** `p384Verify` of the SHA-384 of `msg`: ECDSA with SHA-384, the pairing TLS 1.3 names `ecdsa_secp384r1_sha384`. */
export const p384VerifySha384 = (pub: u8[], msg: u8[], sig: u8[]): boolean =>
  p384Verify(pub, sha384(msg), sig)

// ---------------------------------------------------------------------------
// DER
// ---------------------------------------------------------------------------

/** `der[i]`, or -1 past either end, so a truncated encoding reads as a wrong tag rather than a panic. */
const p384ByteAt = (der: u8[], i: i32): i32 => {
  if (i < 0 || i >= toI32(der.length)) {
    return -1
  }
  return toI32(der[i])
}

/**
 * The DER INTEGER at `der[at]`, inside `end`, right-aligned into `out[off ..
 * off + 48)`; answers the index after it, or -1 unless it is a minimal,
 * non-negative INTEGER (X.690 §8.3) whose value fits in 48 bytes.
 */
const p384DerUnsignedInto = (der: u8[], at: i32, end: i32, out: u8[], off: i32): i32 => {
  if (p384ByteAt(der, at) !== 0x02) {
    return -1
  }
  const length: i32 = p384ByteAt(der, at + 1)
  const start: i32 = at + 2
  const stop: i32 = start + length
  // Fewer than 128 bytes is the short form, and nothing here is longer, so a
  // long-form length (top bit set) is refused as not minimal.
  if (length < 1 || length >= 0x80 || stop > end) {
    return -1
  }
  const first: i32 = p384ByteAt(der, start)
  if (first >= 0x80) {
    return -1
  }
  let from: i32 = start
  if (first === 0 && length > 1) {
    // A leading zero is allowed only to keep the next byte's top bit from
    // reading as a sign.
    if (p384ByteAt(der, start + 1) < 0x80) {
      return -1
    }
    from = start + 1
  }
  const size: i32 = stop - from
  if (size > P384_SCALAR_SIZE) {
    return -1
  }
  for (let k: i32 = 0; k < size; k++) {
    const to: i32 = off + P384_SCALAR_SIZE - size + k
    const byte: i32 = p384ByteAt(der, from + k)
    if (to >= 0 && to < toI32(out.length) && byte >= 0) {
      out[to] = toU8(byte)
    }
  }
  return stop
}

/**
 * `r || s`, 48 bytes each, out of a DER ECDSA-Sig-Value `SEQUENCE { INTEGER
 * r, INTEGER s }` (RFC 5480 §2.2 by way of RFC 3279 §2.2.3), or `null` unless
 * it is exactly one, with both integers minimal, non-negative and below
 * 2^384, and nothing after it. This is the form a TLS `CertificateVerify` and
 * an X.509 signature carry; `x509DerSignatureRS` in `nish/crypto/x509` is the
 * P-256 twin. A zero `r` or `s` gets through here and is refused by
 * `p384Verify`.
 */
export const p384DerSignatureRS = (der: u8[]): u8[] | null => {
  const total: i32 = toI32(der.length)
  // The short-form length covers every valid signature: two INTEGERs of at
  // most 2 + 49 bytes each.
  if (total - 2 >= 0x80 || p384ByteAt(der, 0) !== 0x30 || p384ByteAt(der, 1) !== total - 2) {
    return null
  }
  const out: u8[] = new Array<u8>(96)
  const afterR: i32 = p384DerUnsignedInto(der, 2, total, out, 0)
  if (afterR < 0) {
    return null
  }
  if (p384DerUnsignedInto(der, afterR, total, out, P384_SCALAR_SIZE) !== total) {
    return null
  }
  return out
}
