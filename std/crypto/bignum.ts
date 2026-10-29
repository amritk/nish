/**
 * `nish/crypto/bignum` — the modular arithmetic that `nish/crypto/rsa` and
 * `nish/crypto/p384` share: numbers of any fixed size, Montgomery
 * multiplication modulo an odd modulus, and powers by a public exponent.
 *
 *     import { BnModulus, bnFromBytes, bnModulus, bnMontPow, bnToBytes } from "nish/crypto/bignum";
 *
 *     const m: BnModulus | null = bnModulus(bnFromBytes(modulusBytes, 0, len, limbs));
 *     const x: u32[] = bnFromBytes(valueBytes, 0, len, limbs);  // below m
 *     bnToMont(x, x, m);                                        // x R mod m
 *     bnMontPow(x, x, bnFromBytes(exponentBytes, 0, 4, 1), m);  // x^e R mod m
 *     bnFromMont(x, x, m);                                      // x^e mod m
 *     const out: u8[] = bnToBytes(x, len);
 *
 * A number is a `u32[]` of limbs, limb 0 the least significant, and every
 * number handed to one call has the modulus's limb count. Bytes come in and
 * go out big-endian, as RSA and SEC 1 write them.
 *
 * **Variable time, on purpose.** Every function here may branch on, and
 * index by, the values it is given: the multiply skips nothing, but the
 * reductions subtract only when they must and the power skips the multiply
 * at a zero exponent bit. That is sound only for public data — an RSA
 * modulus, signature and exponent; an ECDSA public key, signature and digest
 * — which is all that signature *verification* holds. Never hand this module
 * a private key, a nonce or anything derived from one; `nish/crypto/p256`'s
 * fiat-crypto arithmetic is what signing uses.
 *
 * The algorithms are written for this module from their descriptions: the
 * Montgomery product is the CIOS method of Ç. K. Koç, T. Acar and B. S.
 * Kaliski, "Analyzing and comparing Montgomery multiplication algorithms"
 * (IEEE Micro, 1996), and the inverse of the modulus's low limb is Newton's
 * iteration modulo 2^32 (Dussé and Kaliski, EUROCRYPT 1990). Nothing is
 * ported.
 */

/**
 * An odd modulus with what Montgomery multiplication by it needs: its limbs
 * `m`, their count `limbs`, `m0inv` = -m^-1 mod 2^32, `one` = R mod m and
 * `rr` = R^2 mod m, where R = 2^(32 × limbs).
 */
export class BnModulus {
  m: u32[]
  limbs: i32
  m0inv: u32
  one: u32[]
  rr: u32[]

  constructor(m: u32[], m0inv: u32, one: u32[], rr: u32[]) {
    this.m = m
    this.limbs = toI32(m.length)
    this.m0inv = m0inv
    this.one = one
    this.rr = rr
  }
}

/**
 * The `limbs`-limb number the big-endian bytes `bytes[at .. at + length)`
 * hold. Bytes above what `limbs` limbs can hold are dropped, and bytes outside
 * `bytes` read as zero; every caller has checked the window first.
 */
export const bnFromBytes = (bytes: u8[], at: i32, length: i32, limbs: i32): u32[] => {
  const out: u32[] = new Array<u32>(limbs)
  const size: i32 = toI32(bytes.length)
  for (let i: i32 = 0; i < length && i < limbs * 4; i++) {
    const j: i32 = at + length - 1 - i
    const limb: i32 = i >> 2
    if (j >= 0 && j < size && limb < toI32(out.length)) {
      out[limb] = out[limb] | (toU32(bytes[j]) << toU32((i & 3) * 8))
    }
  }
  return out
}

/** `a` as `length` big-endian bytes; limbs above them are dropped. */
export const bnToBytes = (a: u32[], length: i32): u8[] => {
  const out: u8[] = new Array<u8>(length)
  const limbs: i32 = toI32(a.length)
  for (let i: i32 = 0; i < length; i++) {
    const limb: i32 = i >> 2
    if (limb < limbs) {
      out[length - 1 - i] = toU8(a[limb] >> toU32((i & 3) * 8))
    }
  }
  return out
}

/** -1, 0 or 1 as `a` is below, equal to or above `b`; both have the same limb count. */
export const bnCompare = (a: u32[], b: u32[]): i32 => {
  const limbs: i32 = toI32(a.length)
  if (toI32(b.length) !== limbs) {
    return toI32(a.length) < toI32(b.length) ? -1 : 1
  }
  for (let i: i32 = limbs - 1; i >= 0 && i < toI32(b.length); i--) {
    if (a[i] !== b[i]) {
      return a[i] < b[i] ? -1 : 1
    }
  }
  return 0
}

/** Whether every limb of `a` is zero. */
export const bnIsZero = (a: u32[]): boolean => {
  for (let i: i32 = 0; i < toI32(a.length); i++) {
    if (a[i] !== 0) {
      return false
    }
  }
  return true
}

/** `out = a`, limb by limb. */
export const bnCopy = (out: u32[], a: u32[]): void => {
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(a.length); i++) {
    out[i] = a[i]
  }
}

/** `a = a - b` modulo R, in place, for `a` at least `b`. */
const bnSubInPlace = (a: u32[], b: u32[]): void => {
  let borrow: u64 = 0
  for (let i: i32 = 0; i < toI32(a.length) && i < toI32(b.length); i++) {
    const d: u64 = toU64(a[i]) - toU64(b[i]) - borrow
    a[i] = toU32(d)
    borrow = (d >> 32) & 1
  }
}

/** `a = 2a mod m` in place, for `a` below `m`: the step `bnModulus` builds R and R^2 by. */
const bnDoubleMod = (a: u32[], m: u32[]): void => {
  let carry: u32 = 0
  for (let i: i32 = 0; i < toI32(a.length); i++) {
    const top: u32 = a[i] >> 31
    a[i] = (a[i] << 1) | carry
    carry = top
  }
  if (carry !== 0 || bnCompare(a, m) >= 0) {
    bnSubInPlace(a, m)
  }
}

/**
 * The Montgomery constants of the odd modulus `m`, or `null` when `m` is even
 * or below 3, where there are none (or nothing to reduce). R mod m and R^2 mod
 * m are 1 doubled 32 × limbs and 64 × limbs times, which costs a few
 * milliseconds for an 8192-bit modulus and is paid once per key.
 */
export const bnModulus = (m: u32[]): BnModulus | null => {
  const limbs: i32 = toI32(m.length)
  if (limbs === 0 || (m[0] & 1) === 0) {
    return null
  }
  let small: boolean = m[0] < 3
  for (let i: i32 = 1; i < limbs; i++) {
    if (m[i] !== 0) {
      small = false
    }
  }
  if (small) {
    return null
  }
  // x = m0^-1 mod 2^32 by Newton: each step doubles the bits that are right,
  // and an odd m0 is its own inverse mod 8, so five steps reach 96 > 32.
  const m0: u32 = m[0]
  const two: u32 = 2
  const zero: u32 = 0
  let x: u32 = m0
  for (let i: i32 = 0; i < 5; i++) {
    x = x * (two - m0 * x)
  }
  const acc: u32[] = new Array<u32>(limbs)
  acc[0] = 1
  for (let i: i32 = 0; i < limbs * 32; i++) {
    bnDoubleMod(acc, m)
  }
  const one: u32[] = new Array<u32>(limbs)
  bnCopy(one, acc)
  for (let i: i32 = 0; i < limbs * 32; i++) {
    bnDoubleMod(acc, m)
  }
  return new BnModulus(m, zero - x, one, acc)
}

/**
 * `out = a b / R mod m` for `a` and `b` below `m`: the Montgomery product, by
 * CIOS — one row of `a` times a limb of `b` and one row of reduction per limb,
 * into `limbs + 2` limbs, then one subtraction of `m` if the sum reached it.
 * Each `u64` sum is at most (2^32 - 1)^2 + 2 (2^32 - 1) = 2^64 - 1, so none
 * wraps. `out` may be `a` or `b`.
 */
export const bnMontMul = (out: u32[], a: u32[], b: u32[], mod: BnModulus): void => {
  const k: i32 = mod.limbs
  const m: u32[] = mod.m
  if (toI32(a.length) < k || toI32(b.length) < k || toI32(out.length) < k || toI32(m.length) < k) {
    return
  }
  const t: u32[] = new Array<u32>(k + 2)
  if (k < 1 || toI32(t.length) < k + 2) {
    return
  }
  for (let i: i32 = 0; i < k; i++) {
    const bi: u64 = toU64(b[i])
    let c: u64 = 0
    for (let j: i32 = 0; j < k; j++) {
      const s: u64 = toU64(t[j]) + toU64(a[j]) * bi + c
      t[j] = toU32(s)
      c = s >> 32
    }
    const top: u64 = toU64(t[k]) + c
    t[k] = toU32(top)
    t[k + 1] = toU32(top >> 32)
    const q: u64 = toU64(t[0] * mod.m0inv)
    c = (toU64(t[0]) + q * toU64(m[0])) >> 32
    for (let j: i32 = 1; j < k; j++) {
      const s: u64 = toU64(t[j]) + q * toU64(m[j]) + c
      t[j - 1] = toU32(s)
      c = s >> 32
    }
    const high: u64 = toU64(t[k]) + c
    t[k - 1] = toU32(high)
    t[k] = t[k + 1] + toU32(high >> 32)
  }
  // The sum is below 2m: subtract m once when it reached it.
  let geq: boolean = t[k] !== 0
  if (!geq) {
    geq = true
    for (let i: i32 = k - 1; i >= 0; i--) {
      if (t[i] !== m[i]) {
        geq = t[i] > m[i]
        break
      }
    }
  }
  let borrow: u64 = 0
  for (let i: i32 = 0; i < k; i++) {
    if (geq) {
      const d: u64 = toU64(t[i]) - toU64(m[i]) - borrow
      out[i] = toU32(d)
      borrow = (d >> 32) & 1
    } else {
      out[i] = t[i]
    }
  }
}

/** `out = a R mod m`: `a`, below `m`, into the Montgomery domain. */
export const bnToMont = (out: u32[], a: u32[], mod: BnModulus): void => bnMontMul(out, a, mod.rr, mod)

/** `out = a / R mod m`: `a` out of the Montgomery domain. */
export const bnFromMont = (out: u32[], a: u32[], mod: BnModulus): void => {
  const plainOne: u32[] = new Array<u32>(mod.limbs)
  plainOne[0] = 1
  bnMontMul(out, a, plainOne, mod)
}

/** `out = a + b mod m` for `a` and `b` below `m`, in either domain. `out` may be `a` or `b`. */
export const bnModAdd = (out: u32[], a: u32[], b: u32[], mod: BnModulus): void => {
  const k: i32 = mod.limbs
  if (toI32(a.length) < k || toI32(b.length) < k || toI32(out.length) < k) {
    return
  }
  let carry: u64 = 0
  for (let i: i32 = 0; i < k; i++) {
    const s: u64 = toU64(a[i]) + toU64(b[i]) + carry
    out[i] = toU32(s)
    carry = s >> 32
  }
  if (carry !== 0 || bnCompare(out, mod.m) >= 0) {
    bnSubInPlace(out, mod.m)
  }
}

/** `out = a - b mod m` for `a` and `b` below `m`, in either domain. `out` may be `a` or `b`. */
export const bnModSub = (out: u32[], a: u32[], b: u32[], mod: BnModulus): void => {
  const k: i32 = mod.limbs
  if (toI32(a.length) < k || toI32(b.length) < k || toI32(out.length) < k) {
    return
  }
  let borrow: u64 = 0
  for (let i: i32 = 0; i < k; i++) {
    const d: u64 = toU64(a[i]) - toU64(b[i]) - borrow
    out[i] = toU32(d)
    borrow = (d >> 32) & 1
  }
  if (borrow !== 0) {
    // Below zero: adding m back wraps the top carry away.
    let carry: u64 = 0
    for (let i: i32 = 0; i < k; i++) {
      const s: u64 = toU64(out[i]) + toU64(mod.m[i]) + carry
      out[i] = toU32(s)
      carry = s >> 32
    }
  }
}

/**
 * `out = a mod m` for an `a` below 2m, with `a` having the modulus's limb
 * count: one subtraction when `a` reached `m`. That is how an x-coordinate
 * below p is taken mod n when p < 2n.
 */
export const bnReduceOnce = (out: u32[], a: u32[], mod: BnModulus): void => {
  bnCopy(out, a)
  if (bnCompare(out, mod.m) >= 0) {
    bnSubInPlace(out, mod.m)
  }
}

/**
 * `out = a^e` in the Montgomery domain: `a` is `x R mod m` and the answer is
 * `x^e R mod m`. `e` is plain limbs of any count, read from its top set bit
 * down by square-and-multiply, which branches on every bit of `e` — so `e`
 * must be public: an RSA public exponent, or p - 2 and n - 2 for Fermat's
 * inverse. An `e` of zero answers 1 (R mod m).
 */
export const bnMontPow = (out: u32[], a: u32[], e: u32[], mod: BnModulus): void => {
  const acc: u32[] = new Array<u32>(mod.limbs)
  const base: u32[] = new Array<u32>(mod.limbs)
  bnCopy(acc, mod.one)
  bnCopy(base, a)
  let started: boolean = false
  for (let i: i32 = toI32(e.length) * 32 - 1; i >= 0; i--) {
    if (started) {
      bnMontMul(acc, acc, acc, mod)
    }
    const limb: i32 = i >> 5
    if (limb < toI32(e.length) && ((e[limb] >> toU32(i & 31)) & 1) === 1) {
      if (started) {
        bnMontMul(acc, acc, base, mod)
      } else {
        bnCopy(acc, base)
        started = true
      }
    }
  }
  bnCopy(out, acc)
}

/**
 * `out = 1 / a` in the Montgomery domain for a prime modulus, as `a^(m - 2)`
 * (Fermat); zero for a zero `a`. The exponent is the public modulus less two.
 */
export const bnMontInvertPrime = (out: u32[], a: u32[], mod: BnModulus): void => {
  const e: u32[] = new Array<u32>(mod.limbs)
  bnCopy(e, mod.m)
  const two: u32[] = new Array<u32>(mod.limbs)
  two[0] = 2
  bnSubInPlace(e, two)
  bnMontPow(out, a, e, mod)
}
