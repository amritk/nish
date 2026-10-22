/**
 * `nish/crypto/ed25519` — the Ed25519 signature scheme of RFC 8032 (§5.1).
 *
 * Written from the specification (RFC 8032 §5.1.1 to §5.1.7), in this
 * module's own structure: nothing here is ported from another implementation.
 * The field is `nish/crypto/x25519`'s GF(2^255 - 19), imported rather than
 * written twice, and SHA-512 is `nish/crypto/sha512`'s. The point formulas are
 * the extended twisted Edwards ones of Hisil, Wong, Carter and Dawson,
 * "Twisted Edwards Curves Revisited" (ASIACRYPT 2008), for a = -1; the code is
 * this module's.
 *
 * **The curve.** -x^2 + y^2 = 1 + d x^2 y^2 over GF(p), d = -121665/121666. A
 * point is held in extended coordinates (X : Y : Z : T), x = X/Z, y = Y/Z and
 * x y = T/Z. The addition is complete — it is right for every pair of points,
 * the identity and a point added to itself included, because -1 is a square
 * and d is not — so no input steers it down another path. A point about to be
 * added is first put in the "cached" form (Y + X, Y - X, 2 d T, 2 Z) the
 * addition reads.
 *
 * **Bounds.** `f25519Mul` accepts limbs below 2^27 in magnitude: a reduced
 * element, or one sum or difference of two. Every product below is given one
 * of those; a value two sums away from reduced (`F` and `E` in the doubling)
 * is carried first, and so is every cached coordinate. The field functions
 * state their own bounds (`nish/crypto/x25519`).
 *
 * **Constant time, by construction.** Signing and the public key multiply
 * the base point by a secret scalar, and that multiplication branches on and
 * indexes by nothing the scalar reaches. The scalar is recoded into 64 signed
 * radix-16 digits in [-8, 8]; each step doubles four times and adds the table
 * entry for the digit, which is chosen by reading all eight entries and
 * keeping one under a mask, and negated with a masked swap and a masked
 * select. The digit arithmetic and the masks use `f25519Add64`, `f25519Sub64`
 * and `f25519Mul64`, because signed overflow is undefined and a checked
 * operation branches. The reductions mod L run a fixed 512 steps of a
 * shift and a masked conditional subtraction over 32-bit limbs in `u64`,
 * whose subtraction wraps. Every `if` and every loop bound is on a public
 * quantity: a digit position, a limb number, a bit position or a length.
 * This is discipline, checked by reading, not by a disassembly fixture as
 * `f25519Mul` and the X25519 ladder are (ECC-5, docs/security/crypto-ecc.md).
 *
 * **Verification is variable time.** Every value `ed25519Verify` handles is
 * public — the key, the message and the signature — so it may branch on them:
 * it refuses early, and compares the final encoding byte by byte. It uses the
 * same multiplication as signing all the same.
 *
 * **What is refused.** `ed25519Verify` is RFC 8032 §5.1.7 with the cofactorless
 * equation [S]B = R + [k]A: an S of L or more, a public key whose y is not
 * below p or that is not on the curve, and an x of zero with the sign bit set
 * are all refused (§5.1.3). R is not decoded: [S]B - [k]A is encoded and
 * compared with R's bytes, and since the encoding is canonical, an R that is
 * not the canonical encoding of a point never matches. A public key of small
 * order is not refused, as RFC 8032 does not ask it to be: under such a key,
 * some signatures verify for messages its owner never signed, so a protocol
 * that needs a signature to bind one key checks the key itself.
 *
 * **The seed is a `Secret`** (`nish:secret`, docs/LANGUAGE.md "Secrets").
 * `ed25519PublicKey` and `ed25519Sign` take the 32-byte seed as a
 * `Secret<u8[]>` and run inside `expose` / `exposeWith`; the seed's hash, the
 * clamped scalar and the prefix, the nonce and its hash, the digits, the
 * accumulator, the selected table entry and the formula temporaries are all
 * wiped before they return, and so are both SHA-512 states (ECC-5).
 *
 * **Loop bounds are literals.** As in `nish/crypto/x25519`, each function that
 * indexes an array opens with an early `return` for a shorter one, which
 * cannot happen but lets the compiler drop the loops' bounds checks.
 *
 * Private names carry the `ed25519` / `Ed25519` prefix because a `std/`
 * module's private functions share the importing program's flat symbol
 * namespace (`docs/wp26-stdlib.md` §3e).
 */

import { Secret, expose, exposeWith, wipe } from "nish:secret"
import { SHA512_SIZE, Sha512 } from "nish/crypto/sha512"
import {
  f25519Add,
  f25519Add64,
  f25519Carry,
  f25519Copy,
  f25519Decode,
  f25519Encode,
  f25519Invert,
  f25519Mul,
  f25519Mul64,
  f25519Pow250,
  f25519Small,
  f25519Square,
  f25519SquareTimes,
  f25519Sub,
  f25519Sub64,
  f25519Swap,
  f25519Zero,
} from "nish/crypto/x25519"

/** The length in bytes of a seed (the private key), RFC 8032 §5.1.5. */
export const ED25519_SEED_SIZE: i32 = 32

/** The length in bytes of an encoded public key. */
export const ED25519_PUBLIC_KEY_SIZE: i32 = 32

/** The length in bytes of a signature, `R || S`. */
export const ED25519_SIGNATURE_SIZE: i32 = 64

/** Where a method call starts reading an array: its first byte. */
const ED25519_FROM: i32 = 0

/** Where the prefix starts in the seed's hash, and how long R, A and a scalar are. */
const ED25519_HALF: i32 = 32

/** The limbs of one table entry: four field elements of ten. */
const ED25519_ENTRY: i32 = 40

/** d = -121665/121666, the curve's constant, little-endian (RFC 8032 §5.1). */
const ed25519D = (): i64[] => {
  const bytes: u8[] = [
    0xa3, 0x78, 0x59, 0x13, 0xca, 0x4d, 0xeb, 0x75, 0xab, 0xd8, 0x41, 0x41, 0x4d, 0x0a, 0x70, 0x00, 0x98,
    0xe8, 0x79, 0x77, 0x79, 0x40, 0xc7, 0x8c, 0x73, 0xfe, 0x6f, 0x2b, 0xee, 0x6c, 0x03, 0x52,
  ]
  return f25519Decode(bytes)
}

/** sqrt(-1) = 2^((p - 1) / 4), which §5.1.3 multiplies a candidate x by. */
const ed25519SqrtM1 = (): i64[] => {
  const bytes: u8[] = [
    0xb0, 0xa0, 0x0e, 0x4a, 0x27, 0x1b, 0xee, 0xc4, 0x78, 0xe4, 0x2f, 0xad, 0x06, 0x18, 0x43, 0x2f, 0xa7,
    0xd7, 0xfb, 0x3d, 0x99, 0x00, 0x4d, 0x2b, 0x0b, 0xdf, 0xc1, 0x4f, 0x80, 0x24, 0x83, 0x2b,
  ]
  return f25519Decode(bytes)
}

/** The base point B's x (RFC 8032 §5.1). */
const ed25519BaseX = (): i64[] => {
  const bytes: u8[] = [
    0x1a, 0xd5, 0x25, 0x8f, 0x60, 0x2d, 0x56, 0xc9, 0xb2, 0xa7, 0x25, 0x95, 0x60, 0xc7, 0x2c, 0x69, 0x5c,
    0xdc, 0xd6, 0xfd, 0x31, 0xe2, 0xa4, 0xc0, 0xfe, 0x53, 0x6e, 0xcd, 0xd3, 0x36, 0x69, 0x21,
  ]
  return f25519Decode(bytes)
}

/** The base point B's y, 4/5 (RFC 8032 §5.1). */
const ed25519BaseY = (): i64[] => {
  const bytes: u8[] = [
    0x58, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66,
    0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66,
  ]
  return f25519Decode(bytes)
}

/** L = 2^252 + 27742317777372353535851937790883648493, the group order, as eight 32-bit limbs. */
const ed25519Order = (): u64[] => [
  0x5cf5d3ed, 0x5812631a, 0xa2f79cd6, 0x14def9de, 0x00000000, 0x00000000, 0x00000000, 0x10000000,
]

/** A point (X : Y : Z : T) in extended coordinates. */
class Ed25519Point {
  x: i64[]
  y: i64[]
  z: i64[]
  t: i64[]

  /** The identity, (0 : 1 : 1 : 0). */
  constructor() {
    this.x = f25519Zero()
    this.y = f25519Small(toI64(1))
    this.z = f25519Small(toI64(1))
    this.t = f25519Zero()
  }
}

/** A point in the form the addition reads: (Y + X, Y - X, 2 d T, 2 Z), each carried. */
class Ed25519Cached {
  ypx: i64[]
  ymx: i64[]
  t2d: i64[]
  z2: i64[]

  /** The identity, (1, 1, 0, 2). */
  constructor() {
    this.ypx = f25519Small(toI64(1))
    this.ymx = f25519Small(toI64(1))
    this.t2d = f25519Zero()
    this.z2 = f25519Small(toI64(2))
  }
}

/**
 * The temporaries of the point formulas, allocated once per operation rather
 * than once per step; the entry a multiplication selects; the point a table
 * is built in; and 2 d, which the cached form multiplies by.
 */
class Ed25519Scratch {
  a: i64[]
  b: i64[]
  c: i64[]
  d: i64[]
  e: i64[]
  f: i64[]
  g: i64[]
  h: i64[]
  entry: Ed25519Cached
  sum: Ed25519Point
  d2: i64[]

  constructor() {
    this.a = f25519Zero()
    this.b = f25519Zero()
    this.c = f25519Zero()
    this.d = f25519Zero()
    this.e = f25519Zero()
    this.f = f25519Zero()
    this.g = f25519Zero()
    this.h = f25519Zero()
    this.entry = new Ed25519Cached()
    this.sum = new Ed25519Point()
    this.d2 = ed25519D()
    f25519Add(this.d2, this.d2, this.d2)
    f25519Carry(this.d2)
  }
}

/** Zero `p`'s four coordinates, with the store `nish:secret` keeps from the optimiser (ECC-5). */
const ed25519WipePoint = (p: Ed25519Point): void => {
  wipe(p.x)
  wipe(p.y)
  wipe(p.z)
  wipe(p.t)
}

/** Zero every temporary a point operation left in `s`; `d2` is the curve's public constant. */
const ed25519WipeScratch = (s: Ed25519Scratch): void => {
  wipe(s.a)
  wipe(s.b)
  wipe(s.c)
  wipe(s.d)
  wipe(s.e)
  wipe(s.f)
  wipe(s.g)
  wipe(s.h)
  wipe(s.entry.ypx)
  wipe(s.entry.ymx)
  wipe(s.entry.t2d)
  wipe(s.entry.z2)
  ed25519WipePoint(s.sum)
}

/**
 * Zero what a SHA-512 hasher holds of what it was fed — its hash value, its
 * pending block and its message schedule — as `nish/crypto/hmac` does.
 */
const ed25519WipeHasher = (h: Sha512): void => {
  wipe(h.engine.state)
  wipe(h.engine.block)
  wipe(h.engine.schedule)
}

/** `out = p` in the cached form. */
const ed25519ToCached = (out: Ed25519Cached, p: Ed25519Point, s: Ed25519Scratch): void => {
  f25519Add(out.ypx, p.y, p.x)
  f25519Carry(out.ypx)
  f25519Sub(out.ymx, p.y, p.x)
  f25519Carry(out.ymx)
  f25519Mul(out.t2d, p.t, s.d2)
  f25519Add(out.z2, p.z, p.z)
  f25519Carry(out.z2)
}

/**
 * `out = p + q` ("add-2008-hwcd-3" for a = -1, with q cached). `out` may be
 * `p`: `p` is read only into the temporaries, before `out` is written.
 * `A`, `B`, `C` and `D` are products, so reduced, and `E`, `F`, `G` and `H`
 * are one sum or difference of two of them.
 */
const ed25519Add = (out: Ed25519Point, p: Ed25519Point, q: Ed25519Cached, s: Ed25519Scratch): void => {
  f25519Sub(s.a, p.y, p.x)
  f25519Mul(s.a, s.a, q.ymx)
  f25519Add(s.b, p.y, p.x)
  f25519Mul(s.b, s.b, q.ypx)
  f25519Mul(s.c, p.t, q.t2d)
  f25519Mul(s.d, p.z, q.z2)
  f25519Sub(s.e, s.b, s.a)
  f25519Sub(s.f, s.d, s.c)
  f25519Add(s.g, s.d, s.c)
  f25519Add(s.h, s.b, s.a)
  f25519Mul(out.x, s.e, s.f)
  f25519Mul(out.y, s.g, s.h)
  f25519Mul(out.t, s.e, s.h)
  f25519Mul(out.z, s.f, s.g)
}

/**
 * `out = 2 p` ("dbl-2008-hwcd" for a = -1, with `E`, `F`, `G` and `H` all
 * negated, which leaves every product the same and saves a negation). `out`
 * may be `p`. `C = 2 Z^2` and `H = A + B` are one sum away from reduced;
 * `E = H - (X + Y)^2` and `F = C + G` are two, so they are carried.
 */
const ed25519Double = (out: Ed25519Point, p: Ed25519Point, s: Ed25519Scratch): void => {
  f25519Square(s.a, p.x)
  f25519Square(s.b, p.y)
  f25519Square(s.c, p.z)
  f25519Add(s.c, s.c, s.c)
  f25519Add(s.d, p.x, p.y)
  f25519Square(s.d, s.d)
  f25519Add(s.h, s.a, s.b)
  f25519Sub(s.e, s.h, s.d)
  f25519Carry(s.e)
  f25519Sub(s.g, s.a, s.b)
  f25519Add(s.f, s.c, s.g)
  f25519Carry(s.f)
  f25519Mul(out.x, s.e, s.f)
  f25519Mul(out.y, s.g, s.h)
  f25519Mul(out.t, s.e, s.h)
  f25519Mul(out.z, s.f, s.g)
}

/** `out = (0 : 1 : 1 : 0)`, the identity, in place. */
const ed25519SetIdentity = (out: Ed25519Point): void => {
  f25519Copy(out.x, f25519Zero())
  f25519Copy(out.y, f25519Small(toI64(1)))
  f25519Copy(out.z, f25519Small(toI64(1)))
  f25519Copy(out.t, f25519Zero())
}

/** Stores the cached `q` as entry `i` of `table`. */
const ed25519TableStore = (table: i64[], i: i32, q: Ed25519Cached): void => {
  if (toI32(table.length) < 8 * ED25519_ENTRY || i < 0 || i >= 8 || toI32(q.ypx.length) < 10) {
    return
  }
  const at: i32 = i * ED25519_ENTRY
  for (let j: i32 = 0; j < 10; j++) {
    table[at + j] = q.ypx[j]
    table[at + 10 + j] = q.ymx[j]
    table[at + 20 + j] = q.t2d[j]
    table[at + 30 + j] = q.z2[j]
  }
}

/** `1 p` to `8 p`, cached, as eight entries of forty limbs. */
const ed25519Table = (p: Ed25519Point, s: Ed25519Scratch): i64[] => {
  const table: i64[] = new Array<i64>(8 * ED25519_ENTRY)
  const one = new Ed25519Cached()
  ed25519ToCached(one, p, s)
  ed25519TableStore(table, 0, one)
  ed25519Double(s.sum, p, s)
  for (let i: i32 = 1; i < 8; i++) {
    if (i > 1) {
      ed25519Add(s.sum, s.sum, one, s)
    }
    ed25519ToCached(s.entry, s.sum, s)
    ed25519TableStore(table, i, s.entry)
  }
  return table
}

/**
 * The scalar `k` (32 bytes, little-endian, below 2^255) as 64 signed radix-16
 * digits in [-8, 8], least significant first: each nibble, plus the carry
 * from the one below, is moved into [-8, 8) by carrying 16 out of it when it
 * is 8 or more. The top nibble is at most 7, so the last digit, with its
 * carry, is at most 8. Every operation is the same for every `k`.
 */
const ed25519Digits = (k: u8[]): i64[] => {
  const e: i64[] = new Array<i64>(64)
  if (toI32(k.length) < 32) {
    return e
  }
  for (let i: i32 = 0; i < 32; i++) {
    e[2 * i] = toI64(k[i] & toU8(15))
    e[2 * i + 1] = toI64(k[i] >> toU8(4))
  }
  let carry: i64 = 0
  for (let i: i32 = 0; i < 63; i++) {
    const v: i64 = f25519Add64(e[i], carry)
    carry = f25519Add64(v, toI64(8)) >> toI64(4)
    e[i] = f25519Sub64(v, f25519Mul64(carry, toI64(16)))
  }
  e[63] = f25519Add64(e[63], carry)
  return e
}

/**
 * `out = digit * p`, from the table of `1 p` to `8 p`, for a digit in
 * [-8, 8]. Every entry is read; the one whose index is the digit's magnitude
 * is kept under an all-ones mask and the rest under a zero one, and a zero
 * digit keeps none and leaves the identity. A negative digit then negates the
 * entry: -(x, y) = (-x, y), so Y + X and Y - X swap and 2 d T changes sign,
 * by a masked swap and a masked select of the negation.
 */
const ed25519Select = (out: Ed25519Cached, table: i64[], digit: i64, s: Ed25519Scratch): void => {
  if (toI32(table.length) < 8 * ED25519_ENTRY || toI32(out.ypx.length) < 10 || toI32(s.a.length) < 10) {
    return
  }
  const sign: i64 = digit >> toI64(63)
  const magnitude: i64 = f25519Sub64(digit ^ sign, sign)
  f25519Copy(out.ypx, f25519Small(toI64(1)))
  f25519Copy(out.ymx, f25519Small(toI64(1)))
  f25519Copy(out.t2d, f25519Zero())
  f25519Copy(out.z2, f25519Small(toI64(2)))
  for (let i: i32 = 0; i < 8; i++) {
    // All ones when `magnitude` is `i + 1`: the xor is then 0, and 0 - 1 is
    // the only difference here whose sign bit is set.
    const hit: i64 = f25519Sub64(magnitude ^ toI64(i + 1), toI64(1)) >> toI64(63)
    const at: i32 = i * ED25519_ENTRY
    for (let j: i32 = 0; j < 10; j++) {
      out.ypx[j] = out.ypx[j] ^ (hit & (out.ypx[j] ^ table[at + j]))
      out.ymx[j] = out.ymx[j] ^ (hit & (out.ymx[j] ^ table[at + 10 + j]))
      out.t2d[j] = out.t2d[j] ^ (hit & (out.t2d[j] ^ table[at + 20 + j]))
      out.z2[j] = out.z2[j] ^ (hit & (out.z2[j] ^ table[at + 30 + j]))
    }
  }
  f25519Swap(out.ypx, out.ymx, sign & toI64(1))
  for (let j: i32 = 0; j < 10; j++) {
    s.a[j] = f25519Sub64(toI64(0), out.t2d[j])
    out.t2d[j] = out.t2d[j] ^ (sign & (out.t2d[j] ^ s.a[j]))
  }
}

/**
 * `out = k * p` for a 32-byte little-endian `k` below 2^255, in constant time:
 * from the top digit down, four doublings (none before the first add, a
 * public position) and the addition of the selected entry. The table holds
 * multiples of `p`, which is public in every use here (the base point, or a
 * public key), and is not wiped; the digits are, and the caller wipes `s`.
 */
const ed25519ScalarMult = (out: Ed25519Point, k: u8[], p: Ed25519Point, s: Ed25519Scratch): void => {
  const digits: i64[] = ed25519Digits(k)
  const table: i64[] = ed25519Table(p, s)
  ed25519SetIdentity(out)
  for (let i: i32 = 63; i >= 0; i--) {
    if (i < 63) {
      ed25519Double(out, out, s)
      ed25519Double(out, out, s)
      ed25519Double(out, out, s)
      ed25519Double(out, out, s)
    }
    ed25519Select(s.entry, table, digits[i], s)
    ed25519Add(out, out, s.entry, s)
  }
  wipe(digits)
}

/** B, the base point, with T = x y and Z = 1. */
const ed25519Base = (): Ed25519Point => {
  const b = new Ed25519Point()
  f25519Copy(b.x, ed25519BaseX())
  f25519Copy(b.y, ed25519BaseY())
  f25519Mul(b.t, b.x, b.y)
  return b
}

/** `out = k * B`. */
const ed25519BaseMult = (out: Ed25519Point, k: u8[], s: Ed25519Scratch): void => {
  ed25519ScalarMult(out, k, ed25519Base(), s)
}

/**
 * The 32-byte encoding of `p` (§5.1.2): y, with the low bit of x in the top
 * bit of the last byte. The affine coordinates are left in `s.b` and `s.c`,
 * which the caller wipes with the rest of the scratch, and x's encoding is
 * wiped here.
 */
const ed25519Encode = (p: Ed25519Point, s: Ed25519Scratch): u8[] => {
  f25519Invert(s.a, p.z)
  f25519Mul(s.b, p.x, s.a)
  f25519Mul(s.c, p.y, s.a)
  const out: u8[] = f25519Encode(s.c)
  const x: u8[] = f25519Encode(s.b)
  if (toI32(out.length) < 32 || toI32(x.length) < 32) {
    return out
  }
  out[31] = out[31] | ((x[0] & toU8(1)) << toU8(7))
  wipe(x)
  return out
}

/** Whether the first `n` bytes of `a` and `b` are the same; variable time, for public values. */
const ed25519SameBytes = (a: u8[], b: u8[], n: i32): boolean => {
  if (toI32(a.length) < n || toI32(b.length) < n) {
    return false
  }
  for (let i: i32 = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

/** Whether the field elements `f` and `g` are equal, by their canonical encodings; variable time. */
const ed25519FieldEqual = (f: i64[], g: i64[]): boolean =>
  ed25519SameBytes(f25519Encode(f), f25519Encode(g), ED25519_HALF)

/** `out = z^((p - 5) / 8) = z^(2^252 - 3)`: `f25519Pow250`, two squarings and a multiplication by `z`. */
const ed25519Pow22523 = (out: i64[], z: i64[]): void => {
  const z11: i64[] = f25519Zero()
  const acc: i64[] = f25519Zero()
  f25519Pow250(acc, z11, z)
  f25519SquareTimes(acc, acc, 2)
  f25519Mul(out, acc, z)
}

/** `f = -f`, carried. */
const ed25519Negate = (f: i64[]): void => {
  f25519Sub(f, f25519Zero(), f)
  f25519Carry(f)
}

/**
 * The point that the 32 bytes `bytes` encode (§5.1.3), or `null` for none:
 * a y that is not below p, a y with no x on the curve, or x = 0 with the sign
 * bit set. Variable time — it decodes public keys only.
 *
 * x^2 = u / v with u = y^2 - 1 and v = d y^2 + 1, and the candidate root is
 * x = u v^3 (u v^7)^((p - 5) / 8). If v x^2 is u it is a root; if it is -u,
 * x sqrt(-1) is; otherwise there is none. x then takes the sign bit's parity.
 */
const ed25519Decode = (bytes: u8[], s: Ed25519Scratch): Ed25519Point | null => {
  if (toI32(bytes.length) !== 32) {
    return null
  }
  const y: i64[] = f25519Decode(bytes)
  // f25519Decode takes y modulo p; re-encoding refuses every y of p or more.
  const canonical: u8[] = f25519Encode(y)
  canonical[31] = canonical[31] | (bytes[31] & toU8(0x80))
  if (!ed25519SameBytes(canonical, bytes, ED25519_HALF)) {
    return null
  }
  const sign: u8 = bytes[31] >> toU8(7)
  const one: i64[] = f25519Small(toI64(1))

  f25519Square(s.a, y)
  f25519Sub(s.b, s.a, one)
  f25519Carry(s.b) // u
  f25519Mul(s.c, s.a, ed25519D())
  f25519Add(s.c, s.c, one)
  f25519Carry(s.c) // v
  f25519Square(s.d, s.c)
  f25519Mul(s.d, s.d, s.c) // v^3
  f25519Square(s.e, s.d)
  f25519Mul(s.e, s.e, s.c) // v^7
  f25519Mul(s.e, s.e, s.b) // u v^7
  ed25519Pow22523(s.e, s.e)
  f25519Mul(s.f, s.d, s.b) // u v^3
  const x: i64[] = f25519Zero()
  f25519Mul(x, s.f, s.e)

  f25519Square(s.g, x)
  f25519Mul(s.g, s.g, s.c) // v x^2
  f25519Copy(s.h, s.b)
  ed25519Negate(s.h) // -u
  if (!ed25519FieldEqual(s.g, s.b)) {
    if (!ed25519FieldEqual(s.g, s.h)) {
      return null
    }
    f25519Mul(x, x, ed25519SqrtM1())
  }

  const xBytes: u8[] = f25519Encode(x)
  if ((xBytes[0] & toU8(1)) !== sign) {
    if (ed25519SameBytes(xBytes, new Array<u8>(32), ED25519_HALF)) {
      return null
    }
    ed25519Negate(x)
  }
  const p = new Ed25519Point()
  f25519Copy(p.x, x)
  f25519Copy(p.y, y)
  f25519Mul(p.t, x, y)
  return p
}

/**
 * `out = x mod L` for the 64-byte little-endian `x`, in constant time: from
 * bit 511 down, `acc = 2 acc + bit`, then `acc - L` replaces `acc` under a
 * mask when it did not borrow. `acc` stays below L, so `2 acc + 1` is below
 * 2^254 and the eight 32-bit limbs never carry out. The limbs are `u64`,
 * whose subtraction wraps, so a borrow is the top bit of the difference.
 * `acc` and the difference are wiped.
 */
const ed25519Reduce = (out: u8[], x: u8[]): void => {
  if (toI32(out.length) < 32 || toI32(x.length) < 64) {
    return
  }
  const l: u64[] = ed25519Order()
  const acc: u64[] = new Array<u64>(8)
  const diff: u64[] = new Array<u64>(8)
  if (toI32(l.length) < 8) {
    return
  }
  const low: u64 = 0xffffffff
  for (let i: i32 = 511; i >= 0; i--) {
    const byte: i32 = i >> 3
    let carry: u64 = toU64(x[byte] >> toU8(i & 7)) & toU64(1)
    for (let j: i32 = 0; j < 8; j++) {
      const v: u64 = (acc[j] << toU64(1)) | carry
      acc[j] = v & low
      carry = v >> toU64(32)
    }
    let borrow: u64 = 0
    for (let j: i32 = 0; j < 8; j++) {
      const v: u64 = acc[j] - l[j] - borrow
      diff[j] = v & low
      borrow = v >> toU64(63)
    }
    const keep: u64 = borrow - toU64(1)
    const stay: u64 = toU64(0) - borrow
    for (let j: i32 = 0; j < 8; j++) {
      acc[j] = (diff[j] & keep) | (acc[j] & stay)
    }
  }
  for (let j: i32 = 0; j < 8; j++) {
    for (let b: i32 = 0; b < 4; b++) {
      out[4 * j + b] = toU8((acc[j] >> toU64(8 * b)) & toU64(0xff))
    }
  }
  wipe(acc)
  wipe(diff)
}

/** The 32 little-endian bytes of `a` as sixteen 16-bit limbs. */
const ed25519Limbs16 = (a: u8[]): u64[] => {
  const out: u64[] = new Array<u64>(16)
  if (toI32(a.length) < 32) {
    return out
  }
  for (let i: i32 = 0; i < 16; i++) {
    out[i] = toU64(a[2 * i]) | (toU64(a[2 * i + 1]) << toU64(8))
  }
  return out
}

/**
 * `out = (r + k a) mod L` (§5.1.6 step 5), each a 32-byte little-endian
 * scalar, in constant time: the schoolbook product of sixteen 16-bit limbs,
 * whose column sums stay below 2^37, plus `r`, carried into 64 bytes and
 * reduced by `ed25519Reduce`. Every intermediate is wiped.
 */
const ed25519MulAdd = (out: u8[], k: u8[], a: u8[], r: u8[]): void => {
  const k16: u64[] = ed25519Limbs16(k)
  const a16: u64[] = ed25519Limbs16(a)
  const r16: u64[] = ed25519Limbs16(r)
  const wide: u64[] = new Array<u64>(32)
  const bytes: u8[] = new Array<u8>(64)
  if (toI32(k16.length) < 16 || toI32(a16.length) < 16 || toI32(r16.length) < 16) {
    return
  }
  for (let i: i32 = 0; i < 16; i++) {
    wide[i] = r16[i]
  }
  for (let i: i32 = 0; i < 16; i++) {
    for (let j: i32 = 0; j < 16; j++) {
      wide[i + j] = wide[i + j] + k16[i] * a16[j]
    }
  }
  let carry: u64 = 0
  for (let i: i32 = 0; i < 32; i++) {
    const v: u64 = wide[i] + carry
    bytes[2 * i] = toU8(v & toU64(0xff))
    bytes[2 * i + 1] = toU8((v >> toU64(8)) & toU64(0xff))
    carry = v >> toU64(16)
  }
  ed25519Reduce(out, bytes)
  wipe(k16)
  wipe(a16)
  wipe(r16)
  wipe(wide)
  wipe(bytes)
}

/** Whether the 32-byte little-endian `s` is below L (§5.1.7 step 1); variable time, for a public S. */
const ed25519ScalarCanonical = (s: u8[]): boolean => {
  const l: u64[] = ed25519Order()
  if (toI32(s.length) < 32 || toI32(l.length) < 8) {
    return false
  }
  for (let j: i32 = 7; j >= 0; j--) {
    const v: u64 =
      toU64(s[4 * j]) |
      (toU64(s[4 * j + 1]) << toU64(8)) |
      (toU64(s[4 * j + 2]) << toU64(16)) |
      (toU64(s[4 * j + 3]) << toU64(24))
    if (v !== l[j]) {
      return v < l[j]
    }
  }
  return false
}

/**
 * The seed's SHA-512 (§5.1.5 steps 1 and 2), its first half clamped into the
 * secret scalar `a` — bits 0, 1, 2 and 255 cleared, bit 254 set — and its
 * second half the prefix. The hasher is wiped; the caller wipes the answer.
 */
const ed25519Expand = (seed: u8[]): u8[] => {
  const hasher = new Sha512()
  hasher.update(seed, ED25519_FROM, ED25519_SEED_SIZE)
  const h: u8[] = hasher.digest()
  ed25519WipeHasher(hasher)
  if (toI32(h.length) < SHA512_SIZE) {
    return h
  }
  h[0] = h[0] & toU8(248)
  h[31] = (h[31] & toU8(127)) | toU8(64)
  return h
}

/** k = SHA-512(R || A || M) mod L (§5.1.6 step 4, §5.1.7 step 2); public. */
const ed25519Challenge = (r: u8[], pub: u8[], msg: u8[]): u8[] => {
  const hasher = new Sha512()
  hasher.update(r, ED25519_FROM, ED25519_HALF)
  hasher.update(pub, ED25519_FROM, ED25519_HALF)
  hasher.update(msg, ED25519_FROM, toI32(msg.length))
  const k: u8[] = new Array<u8>(32)
  ed25519Reduce(k, hasher.digest())
  return k
}

/**
 * The public key of `seed` (RFC 8032 §5.1.5): the encoding of `a * B`, as 32
 * plain bytes. Answers `null` unless `seed` is `ED25519_SEED_SIZE` bytes.
 */
export const ed25519PublicKey = (seed: Secret<u8[]>): u8[] | null => expose(seed, ed25519PublicKeyExposed)

/** `ed25519PublicKey` on the plain seed, for `expose` to run: the hash, the point and the scratch are wiped. */
const ed25519PublicKeyExposed = (seed: u8[]): u8[] | null => {
  if (toI32(seed.length) !== 32) {
    return null
  }
  const h: u8[] = ed25519Expand(seed)
  const s = new Ed25519Scratch()
  const point = new Ed25519Point()
  ed25519BaseMult(point, h, s)
  const pub: u8[] = ed25519Encode(point, s)
  wipe(h)
  ed25519WipePoint(point)
  ed25519WipeScratch(s)
  return pub
}

/**
 * The Ed25519 signature of `msg` under `seed` (RFC 8032 §5.1.6), `R || S`,
 * 64 bytes. Signing is deterministic: the same seed and message always give
 * the same signature. Answers `null` unless `seed` is `ED25519_SEED_SIZE`
 * bytes. The public key is derived from the seed again on every call. A
 * message longer than 2^31 - 1 bytes panics, as in `sha512`: its length does
 * not survive `toI32`, and the signature would be of a prefix.
 */
export const ed25519Sign = (seed: Secret<u8[]>, msg: u8[]): u8[] | null => {
  if (msg.length > 2147483647) {
    panic("ed25519Sign: a message longer than 2^31 - 1 bytes")
  }
  return exposeWith(seed, msg, ed25519SignExposed)
}

/**
 * `ed25519Sign` on the plain seed, for `exposeWith` to run. The seed's hash
 * (the scalar and the prefix), the nonce's hash, the nonce, the point, the
 * scratch and both hashers are wiped; R, A and S are the public output.
 */
const ed25519SignExposed = (seed: u8[], msg: u8[]): u8[] | null => {
  if (toI32(seed.length) !== 32) {
    return null
  }
  const h: u8[] = ed25519Expand(seed)
  const s = new Ed25519Scratch()
  const point = new Ed25519Point()
  ed25519BaseMult(point, h, s)
  const pub: u8[] = ed25519Encode(point, s)

  const nonceHasher = new Sha512()
  nonceHasher.update(h, ED25519_HALF, ED25519_HALF)
  nonceHasher.update(msg, ED25519_FROM, toI32(msg.length))
  const nonceWide: u8[] = nonceHasher.digest()
  ed25519WipeHasher(nonceHasher)
  const nonce: u8[] = new Array<u8>(32)
  ed25519Reduce(nonce, nonceWide)
  wipe(nonceWide)

  ed25519BaseMult(point, nonce, s)
  const r: u8[] = ed25519Encode(point, s)
  const k: u8[] = ed25519Challenge(r, pub, msg)
  const sBytes: u8[] = new Array<u8>(32)
  ed25519MulAdd(sBytes, k, h, nonce)

  wipe(h)
  wipe(nonce)
  ed25519WipePoint(point)
  ed25519WipeScratch(s)

  const sig: u8[] = new Array<u8>(64)
  if (toI32(r.length) < 32 || toI32(sBytes.length) < 32) {
    return null
  }
  for (let i: i32 = 0; i < 32; i++) {
    sig[i] = r[i]
    sig[i + 32] = sBytes[i]
  }
  return sig
}

/**
 * Whether `sig` is a valid Ed25519 signature of `msg` under the public key
 * `pub` (RFC 8032 §5.1.7): [S]B = R + [k]A with k = SHA-512(R || A || M)
 * mod L, checked as the encoding of [S]B + [k](-A) against R's bytes.
 * Answers `false` for a key or signature of the wrong length, an S of L or
 * more, and a key that does not decode. A message longer than 2^31 - 1
 * bytes panics, as in `ed25519Sign`: a check of a prefix would accept the
 * signature for any longer message that shares it. Every value here is
 * public, so the answer may be reached by branches.
 */
export const ed25519Verify = (pub: u8[], msg: u8[], sig: u8[]): boolean => {
  if (msg.length > 2147483647) {
    panic("ed25519Verify: a message longer than 2^31 - 1 bytes")
  }
  if (toI32(pub.length) !== 32 || toI32(sig.length) !== 64) {
    return false
  }
  const r: u8[] = new Array<u8>(32)
  const sBytes: u8[] = new Array<u8>(32)
  for (let i: i32 = 0; i < 32; i++) {
    r[i] = sig[i]
    sBytes[i] = sig[i + 32]
  }
  if (!ed25519ScalarCanonical(sBytes)) {
    return false
  }
  const s = new Ed25519Scratch()
  const a: Ed25519Point | null = ed25519Decode(pub, s)
  if (a === null) {
    return false
  }
  const k: u8[] = ed25519Challenge(r, pub, msg)
  ed25519Negate(a.x)
  ed25519Negate(a.t)
  const sum = new Ed25519Point()
  ed25519BaseMult(sum, sBytes, s)
  const other = new Ed25519Point()
  ed25519ScalarMult(other, k, a, s)
  ed25519ToCached(s.entry, other, s)
  ed25519Add(sum, sum, s.entry, s)
  return ed25519SameBytes(ed25519Encode(sum, s), r, ED25519_HALF)
}
