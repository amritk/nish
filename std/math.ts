/**
 * `std/math` — `Math.atan2`, `Math.tan` and `Math.hypot` on `f64`, and on a
 * freestanding wasm build `Math.sin`, `Math.cos`, `Math.exp`, `Math.log`,
 * `Math.pow` and the `%` of two `f64`s, in Nish rather than libm, so a program
 * answers the same on every target and the optimiser sees the whole function.
 *
 *     export const main = (): i32 => {
 *       const slope: f64 = Math.tan(0.5);
 *       const angle: f64 = Math.atan2(1.0, -1.0); // 3 * pi / 4
 *       const side: f64 = Math.hypot(3.0, 4.0); // 5
 *       return side === 5.0 ? 0 : 1;
 *     };
 *
 * **A program does not import this module.** A call to `Math.atan2`,
 * `Math.tan` or `Math.hypot` is what loads it (the checker's `importMath`), and
 * the compiler copies each function here that the call reaches into the
 * calling module as an `internal` function, so this file writes no `.ll` of
 * its own. On `--profile wasm` and `--profile wasm-host`, where no libm is
 * linked, a call to the other five and an `f64` `%` load it too; everywhere
 * else they stay LLVM's intrinsics and `frem`. Under Node and `tsc` the calls
 * are the platform's `Math`, so nothing here runs there.
 *
 * **Exactness.** Each is within one ulp of the correctly rounded result, and
 * exactly JavaScript's value for every NaN, signed zero and infinity — every
 * `atan2` infinity pairing, and `hypot`'s Infinity when either operand is
 * infinite, even beside a NaN. Measured against mpmath over 2.8
 * million random and edge-case operands: `tan` 0.83 ulp, `atan2` 0.84 ulp,
 * `hypot` 0.93 ulp (`tests/cases/math_std_edges` pins the special values).
 * `fmodF64` is exact, as `%` is.
 *
 * **`sin`, `cos` and `tan`** are fdlibm's kernels behind its Cody-Waite
 * reduction for |x| below 2^20·π/2, with the quadrant read from the rounding
 * constant. Larger arguments reduce by an integer Payne-Hanek: 192 bits of
 * 2/π against the 53-bit mantissa, which is exact near every multiple of π/2
 * a double can name. **`atan2`** is fdlibm's, with the quotient `y/x`
 * carried as a double-double, so the argument reduction loses nothing, and
 * π − atan taken in double-double. **`hypot`** is fdlibm's core on operands
 * in [1e-150, 1e150], where neither square can overflow, and a power-of-two
 * rescale into that range otherwise. **`exp`**, **`log`** and **`pow`** are
 * fdlibm's, `pow` with JavaScript's answers where C's differ (`x ** NaN` and
 * `(±1) ** ±Infinity` are NaN). **`fmod`** is e_fmod.c's shift-and-subtract
 * on one 64-bit integer rather than two 32-bit words.
 */

/*
 * Ported from fdlibm (https://www.netlib.org/fdlibm/), as FreeBSD msun carries
 * it, lib/msun/src/k_tan.c, k_sin.c, k_cos.c, s_tan.c, s_sin.c, s_cos.c,
 * e_rem_pio2.c, k_rem_pio2.c, e_atan2.c, s_atan.c, e_hypot.c, e_exp.c, e_log.c,
 * e_pow.c and e_fmod.c. Copyright (C) 1993 and (C) 2004 by Sun Microsystems,
 * Inc. Used under the fdlibm licence; see std/LICENSE-fdlibm.
 *
 * fdlibm's notices, as those files carry them:
 *
 * ====================================================
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *
 * Developed at SunPro, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this
 * software is freely granted, provided that this notice
 * is preserved.
 * ====================================================
 *
 * ====================================================
 * Copyright (C) 2004 by Sun Microsystems, Inc. All rights reserved.
 *
 * Permission to use, copy, modify, and distribute this
 * software is freely granted, provided that this notice
 * is preserved.
 * ====================================================
 */

// Word access, as fdlibm's GET_HIGH_WORD and GET_LOW_WORD.
const hiWord = (x: f64): i32 => toI32(f64ToBits(x) >> toI64(32))
const loWord = (x: f64): u32 => toU32(toU64(f64ToBits(x)))
const pow2 = (n: i32): f64 => bitsToF64(toI64(n + 1023) << toI64(52))

// biome-ignore lint/suspicious/noSelfCompare: NaN is the only value that is not itself; Nish has no Number.isNaN
const isNan = (v: f64): boolean => v !== v

const clearLo = (x: f64): f64 => bitsToF64(f64ToBits(x) & (toI64(-1) << toI64(32)))

// fdlibm's ipio2: 2/pi in 24-bit words, most significant first.
const ipio2 = (i: i32): i32 => {
  switch (i) {
    case 0:
      return 0xa2f983
    case 1:
      return 0x6e4e44
    case 2:
      return 0x1529fc
    case 3:
      return 0x2757d1
    case 4:
      return 0xf534dd
    case 5:
      return 0xc0db62
    case 6:
      return 0x95993c
    case 7:
      return 0x439041
    case 8:
      return 0xfe5163
    case 9:
      return 0xabdebb
    case 10:
      return 0xc561b7
    case 11:
      return 0x246e3a
    case 12:
      return 0x424dd2
    case 13:
      return 0xe00649
    case 14:
      return 0x2eea09
    case 15:
      return 0xd1921c
    case 16:
      return 0xfe1deb
    case 17:
      return 0x1cb129
    case 18:
      return 0xa73ee8
    case 19:
      return 0x8235f5
    case 20:
      return 0x2ebb44
    case 21:
      return 0x84e99c
    case 22:
      return 0x7026b4
    case 23:
      return 0x5f7e41
    case 24:
      return 0x3991d6
    case 25:
      return 0x398353
    case 26:
      return 0x39f49c
    case 27:
      return 0x845f8b
    case 28:
      return 0xbdf928
    case 29:
      return 0x3b1ff8
    case 30:
      return 0x97ffde
    case 31:
      return 0x05980f
    case 32:
      return 0xef2f11
    case 33:
      return 0x8b5a0a
    case 34:
      return 0x6d1f6d
    case 35:
      return 0x367ecf
    case 36:
      return 0x27cb09
    case 37:
      return 0xb74f46
    case 38:
      return 0x3f669e
    case 39:
      return 0x5fea2d
    case 40:
      return 0x7527ba
    case 41:
      return 0xc7ebe5
    case 42:
      return 0xf17b3d
    case 43:
      return 0x0739f7
    case 44:
      return 0x8a5292
    case 45:
      return 0xea6bfb
    case 46:
      return 0x5fb11f
    case 47:
      return 0x8d5d08
    case 48:
      return 0x560330
    case 49:
      return 0x46fc7b
    case 50:
      return 0x6babf0
    case 51:
      return 0xcfbc20
    case 52:
      return 0x9af436
    case 53:
      return 0x1da9e3
    case 54:
      return 0x91615e
    case 55:
      return 0xe61b08
    case 56:
      return 0x659985
    case 57:
      return 0x5f14a0
    case 58:
      return 0x68408d
    case 59:
      return 0xffd880
    case 60:
      return 0x4d7327
    case 61:
      return 0x310606
    case 62:
      return 0x1556ca
    case 63:
      return 0x73a8c9
    case 64:
      return 0x60e27b
    case 65:
      return 0xc08c6b
    default:
      return 0
  }
}

// Integer Payne-Hanek: 64 bits of 2/pi starting at fraction bit p (b_1 first).
const pio2Word = (p: i32): u64 => {
  if (p < 1) {
    return pio2Word(1) >> toU64(1 - p)
  }
  const j: i32 = (p - 1) / 24
  const off: i32 = p - 1 - j * 24
  const c0: u64 = toU64(ipio2(j))
  const c1: u64 = toU64(ipio2(j + 1))
  const c2: u64 = toU64(ipio2(j + 2))
  const c3: u64 = toU64(ipio2(j + 3))
  const top: u64 = (c0 << toU64(40)) | (c1 << toU64(16)) | (c2 >> toU64(8))
  const low: u64 = ((c2 & toU64(255)) << toU64(24)) | c3
  return (top << toU64(off)) | (low >> toU64(32 - off))
}
// The high 64 bits of a * b.
const mulHi = (a: u64, b: u64): u64 => {
  const m32: u64 = (toU64(1) << toU64(32)) - toU64(1)
  const a0: u64 = a & m32
  const a1: u64 = a >> toU64(32)
  const b0: u64 = b & m32
  const b1: u64 = b >> toU64(32)
  const p00: u64 = a0 * b0
  const p01: u64 = a0 * b1
  const p10: u64 = a1 * b0
  const mid: u64 = (p00 >> toU64(32)) + (p01 & m32) + (p10 & m32)
  return a1 * b1 + (p01 >> toU64(32)) + (p10 >> toU64(32)) + (mid >> toU64(32))
}
const clz64 = (v: u64): i32 => {
  const h: u32 = toU32(v >> toU64(32))
  return h !== toU32(0) ? Math.clz32(h) : Math.clz32(toU32(v)) + 32
}
// The trigonometric function `mode` names (0 tan, 1 sin, 2 cos) of x,
// for |x| >= 2^20 * pi/2 (finite): x * 2/pi mod 4 from a 192-bit window.
const trigLarge = (x: f64, ix: i32, hx: i32, mode: i32): f64 => {
  const e: i32 = (ix >> 20) - 1023
  const m: u64 = (toU64(f64ToBits(x)) & ((toU64(1) << toU64(52)) - toU64(1))) | (toU64(1) << toU64(52))
  const p: i32 = e - 53
  const w0: u64 = pio2Word(p)
  const w1: u64 = pio2Word(p + 64)
  const w2: u64 = pio2Word(p + 128)
  const lo2: u64 = m * w2
  const hi2: u64 = mulHi(m, w2)
  const lo1: u64 = m * w1
  const hi1: u64 = mulHi(m, w1)
  const p0: u64 = lo2
  const p1: u64 = hi2 + lo1
  const c: u64 = p1 < lo1 ? toU64(1) : toU64(0)
  const p2: u64 = hi1 + m * w0 + c
  // Integer part mod 4 is the top two bits; the fraction is the rest, as a
  // signed 192-bit number q2:q1:q0 in [-1/2, 1/2).
  let n: i32 = toI32(p2 >> toU64(62))
  let q2: u64 = (p2 << toU64(2)) | (p1 >> toU64(62))
  let q1: u64 = (p1 << toU64(2)) | (p0 >> toU64(62))
  let q0: u64 = p0 << toU64(2)
  let neg: boolean = false
  if (q2 >> toU64(63) !== toU64(0)) {
    n += 1
    neg = true
    q0 = ~q0 + toU64(1)
    const k0: u64 = q0 === toU64(0) ? toU64(1) : toU64(0)
    q1 = ~q1 + k0
    const k1: u64 = k0 !== toU64(0) && q1 === toU64(0) ? toU64(1) : toU64(0)
    q2 = ~q2 + k1
  }
  let sh: i32 = 0
  if (q2 === toU64(0)) {
    q2 = q1
    q1 = q0
    q0 = toU64(0)
    sh = 64
  }
  // lz is below 64: the fraction of an argument a double can name is never within 2^-128 of a
  // multiple of pi/2, so after the one word shift above q2 is nonzero (a shift by 64 would be poison).
  const lz: i32 = clz64(q2)
  if (lz > 0) {
    q2 = (q2 << toU64(lz)) | (q1 >> toU64(64 - lz))
    q1 = (q1 << toU64(lz)) | (q0 >> toU64(64 - lz))
  }
  // f = (q2 * 2^-64 + q1 * 2^-128) * 2^-(sh + lz)
  const a: f64 = toF64(q2 >> toU64(11)) * pow2(-53 - sh - lz)
  const b: f64 = toF64(((q2 & toU64(2047)) << toU64(53)) | (q1 >> toU64(11))) * pow2(-117 - sh - lz)
  // r = (a + b) * pi/2 as y0 + y1.
  const p1h: f64 = 1.570796326794896558
  const p1l: f64 = 6.12323399573676603587e-17
  const t: f64 = a * p1h
  const split: f64 = 134217729.0
  const ac: f64 = a * split
  const ah: f64 = ac - (ac - a)
  const al: f64 = a - ah
  const pc: f64 = p1h * split
  const ph: f64 = pc - (pc - p1h)
  const pl: f64 = p1h - ph
  const err: f64 = ah * ph - t + ah * pl + al * ph + al * pl
  const tail: f64 = err + (a * p1l + b * p1h)
  let y0: f64 = t + tail
  let y1: f64 = tail - (y0 - t)
  if (neg !== hx < 0) {
    y0 = -y0
    y1 = -y1
  }
  // x * 2/pi is -(n + f) for a negative x, so its quadrant is -n.
  return trigKernel(y0, y1, hx < 0 ? -n : n, mode)
}

// fdlibm's __kernel_tan: tan(x0 + y0) for |x0 + y0| <= pi/4, or -1/tan when `odd`.
const kernelTan = (x0: f64, y0: f64, odd: boolean): f64 => {
  let x: f64 = x0
  let y: f64 = y0
  const big: boolean = Math.abs(x) >= 0.6743354797363281
  if (big) {
    if (x0 < 0.0) {
      x = -x
      y = -y
    }
    x = 7.85398163397448278999e-1 - x + (3.06161699786838301793e-17 - y)
    y = 0.0
  }
  const z: f64 = x * x
  const w: f64 = z * z
  const w2: f64 = w * w
  const w4: f64 = w2 * w2
  const r0: f64 =
    2.18694882948595424599e-2 * w +
    1.33333333333201242699e-1 +
    w2 * (5.88041240820264096874e-4 * w + 3.59207910759131235356e-3) +
    w4 * (-1.85586374855275456654e-5 * w + 7.817944429395570923e-5)
  const v0: f64 =
    z *
    (8.86323982359930005737e-3 * w +
      5.39682539762260521377e-2 +
      w2 * (2.46463134818469906812e-4 * w + 1.45620945432529025516e-3) +
      w4 * (2.59073051863633712884e-5 * w + 7.14072491382608190305e-5))
  const s: f64 = z * x
  let r: f64 = y + z * (s * (r0 + v0) + y)
  r = r + 3.33333333333334091986e-1 * s
  const wx: f64 = x + r
  if (big) {
    const v: f64 = odd ? -1.0 : 1.0
    const res: f64 = v - (x - ((wx * wx) / (wx + v) - r)) * 2.0
    return x0 < 0.0 ? -res : res
  }
  if (!odd) {
    return wx
  }
  const zz: f64 = clearLo(wx)
  const vv: f64 = r - (zz - x)
  const a: f64 = -1.0 / wx
  const t: f64 = clearLo(a)
  return t + a * (t * zz + 1.0 + t * vv)
}
// fdlibm's __kernel_sin: sin(x + y) for |x + y| <= pi/4, y the tail of a reduced argument.
const kernelSin = (x: f64, y: f64): f64 => {
  const z: f64 = x * x
  const w: f64 = z * z
  const r: f64 =
    z * (z * 2.75573137070700676789e-6 - 1.98412698298579493134e-4) +
    8.33333333332248946124e-3 +
    z * w * (z * 1.58969099521155010221e-10 - 2.50507602534068634195e-8)
  const v: f64 = z * x
  return x - (z * (y * 0.5 - v * r) - y - v * -1.66666666666666324348e-1)
}

// fdlibm's __kernel_cos, as FreeBSD's k_cos.c has it: cos(x + y) for |x + y| <= pi/4.
const kernelCos = (x: f64, y: f64): f64 => {
  const z: f64 = x * x
  const w: f64 = z * z
  const r: f64 =
    z * (z * (z * 2.48015872894767294178e-5 - 1.38888888888741095749e-3) + 4.16666666666666019037e-2) +
    w * w * (z * (z * -1.13596475577881948265e-11 + 2.08757232129817482790e-9) - 2.75573143513906633035e-7)
  const hz: f64 = z * 0.5
  const one: f64 = 1.0
  const v: f64 = one - hz
  return v + (one - v - hz + (z * r - x * y))
}

// The function `mode` names of an argument reduced to quadrant n and y0 + y1 in [-pi/4, pi/4],
// as s_tan.c, s_sin.c and s_cos.c switch on n & 3.
const trigKernel = (y0: f64, y1: f64, n: i32, mode: i32): f64 => {
  const q: i32 = n & 3
  if (mode === 0) {
    return kernelTan(y0, y1, (q & 1) !== 0)
  }
  // cos(x) is sin(x + pi/2): one quadrant on.
  const k: i32 = mode === 2 ? (q + 1) & 3 : q
  if (k === 0) {
    return kernelSin(y0, y1)
  }
  if (k === 1) {
    return kernelCos(y0, y1)
  }
  if (k === 2) {
    return -kernelSin(y0, y1)
  }
  return -kernelCos(y0, y1)
}

// The function `mode` names of x, for pi/4 < |x| (`ax`), x finite or not: e_rem_pio2.c's
// Cody-Waite reduction below 2^20 * pi/2, with the quadrant read from the rounding constant,
// and `trigLarge` above it.
const trigReduced = (x: f64, ax: f64, mode: i32): f64 => {
  if (!(ax < 1647099.0)) {
    if (isNan(ax) || ax > 1.7976931348623157e308) {
      return x - x
    }
    const hx: i32 = hiWord(x)
    return trigLarge(x, hx & 0x7fffffff, hx, mode)
  }
  const rounded: f64 = x * 6.36619772367581382433e-1 + 6755399441055744.0
  const fn: f64 = rounded - 6755399441055744.0
  let r: f64 = x - fn * 1.57079632673412561417
  let w: f64 = fn * 6.07710050650619224932e-11
  let y0: f64 = r - w
  // e_rem_pio2.c's refinement steps, taken when |y0| is below 2^-15 and 2^-48 of |x| rather than
  // when the exponents differ by more than 16 and 49 as fdlibm tests them: a deliberate widening,
  // since the compare can take a refinement fdlibm skips but never skip one fdlibm takes.
  if (Math.abs(y0) < ax * 3.0517578125e-5) {
    let t: f64 = r
    w = fn * 6.0771005063039659766e-11
    r = t - w
    w = fn * 2.02226624879595063154e-21 - (t - r - w)
    y0 = r - w
    if (Math.abs(y0) < ax * 3.552713678800501e-15) {
      t = r
      w = fn * 2.0222662487111664558e-21
      r = t - w
      w = fn * 8.47842766036889956997e-32 - (t - r - w)
      y0 = r - w
    }
  }
  const y1: f64 = r - y0 - w
  // The rounded quotient is an integer in the low bits of `rounded`, two's complement.
  return trigKernel(y0, y1, toI32(f64ToBits(rounded) & toI64(3)), mode)
}

/**
 * `Math.tan(x)`: fdlibm's reduction and kernel, with `trigLarge` past
 * 2^20 * pi/2.
 *
 * @param x The angle, in radians.
 * @returns The tangent of `x`; NaN for a NaN or an infinite `x`, and `x`
 *   itself when `|x| < 2^-27`, a zero's sign kept.
 */
export const tanF64 = (x: f64): f64 => {
  const ax: f64 = Math.abs(x)
  if (ax < 0.7853984832763672) {
    if (ax < 7.450580596923828e-9) {
      return x
    }
    return kernelTan(x, 0.0, false)
  }
  return trigReduced(x, ax, 0)
}

/**
 * `Math.sin(x)`: fdlibm's `sin`, its reduction shared with `tan`.
 *
 * @param x The angle, in radians.
 * @returns The sine of `x`; NaN for a NaN or an infinite `x`, and `x`
 *   itself when `|x| < 2^-26`, a zero's sign kept.
 */
export const sinF64 = (x: f64): f64 => {
  const ax: f64 = Math.abs(x)
  if (ax < 0.7853984832763672) {
    if (ax < 1.4901161193847656e-8) {
      return x
    }
    return kernelSin(x, 0.0)
  }
  return trigReduced(x, ax, 1)
}

/**
 * `Math.cos(x)`: fdlibm's `cos`, its reduction shared with `tan`.
 *
 * @param x The angle, in radians.
 * @returns The cosine of `x`; NaN for a NaN or an infinite `x`, and 1
 *   when `|x| < 2^-27`.
 */
export const cosF64 = (x: f64): f64 => {
  const ax: f64 = Math.abs(x)
  if (ax < 0.7853984832763672) {
    if (ax < 7.450580596923828e-9) {
      return 1.0
    }
    return kernelCos(x, 0.0)
  }
  return trigReduced(x, ax, 2)
}

// fdlibm (FreeBSD msun) s_atan.c / e_atan2.c, ported.
const atanhi = (id: i32): f64 => {
  switch (id) {
    case 0:
      return 4.63647609000806093515e-1
    case 1:
      return 7.85398163397448278999e-1
    case 2:
      return 9.82793723247329054082e-1
    default:
      return 1.570796326794896558
  }
}
const atanlo = (id: i32): f64 => {
  switch (id) {
    case 0:
      return 2.26987774529616870924e-17
    case 1:
      return 3.06161699786838301793e-17
    case 2:
      return 1.39033110312309984516e-17
    default:
      return 6.12323399573676603587e-17
  }
}

/**
 * `Math.atan2(y, x)`: fdlibm's, with a compensated quotient and a
 * double-double pi - atan.
 *
 * @param y The point's vertical coordinate.
 * @param x The point's horizontal coordinate.
 * @returns The angle from the positive x axis to the point `(x, y)`, in
 *   radians in [-pi, pi], with JavaScript's value for every signed zero,
 *   infinity and NaN.
 */
export const atan2F64 = (y: f64, x: f64): f64 => {
  const piO4: f64 = 7.85398163397448279e-1
  const piO2: f64 = 1.570796326794896558
  const pi: f64 = 3.141592653589793116
  const piLo: f64 = 1.2246467991473531772e-16
  if (isNan(x) || isNan(y)) {
    return x + y
  }
  const hx: i32 = hiWord(x)
  const lx: u32 = loWord(x)
  const ix: i32 = hx & 0x7fffffff
  const hy: i32 = hiWord(y)
  const ly: u32 = loWord(y)
  const iy: i32 = hy & 0x7fffffff
  const m: i32 = ((hy >> 31) & 1) | ((hx >> 30) & 2)
  if (iy === 0 && ly === 0) {
    if (m < 2) {
      return y
    }
    return m === 2 ? pi : -pi
  }
  if (ix === 0 && lx === 0) {
    return hy < 0 ? -piO2 : piO2
  }
  if (ix === 0x7ff00000) {
    if (iy === 0x7ff00000) {
      switch (m) {
        case 0:
          return piO4
        case 1:
          return -piO4
        case 2:
          return 3.0 * piO4
        default:
          return -3.0 * piO4
      }
    }
    switch (m) {
      case 0:
        return 0.0
      case 1:
        return -0.0
      case 2:
        return pi
      default:
        return -pi
    }
  }
  if (iy === 0x7ff00000) {
    return hy < 0 ? -piO2 : piO2
  }
  const k: i32 = (iy - ix) >> 20
  if (k > 60) {
    const r: f64 = piO2 + 0.5 * piLo
    return hy < 0 ? -r : r
  }
  if (k < -60) {
    if (hx < 0) {
      return hy < 0 ? -pi : pi
    }
    const q: f64 = y / x
    return q
  }
  let a: f64 = Math.abs(y)
  let b: f64 = Math.abs(x)
  if (ix < 0x23d00000 || ix > 0x5c100000) {
    const h: i32 = -((ix >> 20) - 1023)
    const h1: i32 = h >> 1
    const s: f64 = pow2(h1) * pow2(h - h1)
    a = a * s
    b = b * s
  }
  const q: f64 = a / b
  const qs: f64 = q * 134217729.0
  const qh: f64 = qs - (qs - q)
  const ql: f64 = q - qh
  const bs: f64 = b * 134217729.0
  const bh: f64 = bs - (bs - b)
  const bl: f64 = b - bh
  const p: f64 = q * b
  const pe: f64 = qh * bh - p + qh * bl + ql * bh + ql * bl
  const c: f64 = (a - p - pe) / (b + a * q)
  let hi: f64 = 0.0
  let lo: f64 = 0.0
  const iq: i32 = hiWord(q)
  if (iq >= 0x44100000) {
    hi = atanhi(3)
    lo = atanlo(3)
  } else if (iq < 0x3e400000) {
    lo = q
  } else {
    let t: f64 = q
    let tl: f64 = c
    if (iq >= 0x3fdc0000) {
      let id: i32 = 3
      if (iq < 0x3ff30000) {
        if (iq < 0x3fe60000) {
          id = 0
          t = (2.0 * q - 1.0) / (q + 2.0)
        } else {
          id = 1
          t = (q - 1.0) / (q + 1.0)
        }
      } else if (iq < 0x40038000) {
        id = 2
        t = (q - 1.5) / (q * 1.5 + 1.0)
      } else {
        t = -1.0 / q
      }
      hi = atanhi(id)
      tl = atanlo(id) + c
    }
    const z: f64 = t * t
    const w: f64 = z * z
    const s1: f64 =
      z *
      (((((1.62858201153657823623e-2 * w + 4.97687799461593236017e-2) * w + 6.66107313738753120669e-2) * w +
        9.09088713343650656196e-2) *
        w +
        1.42857142725034663711e-1) *
        w +
        3.33333333333329318027e-1)
    const s2: f64 =
      w *
      ((((-3.6531572744216915527e-2 * w - 5.83357013379057348645e-2) * w - 7.69187620504482999495e-2) * w -
        1.1111110405462355788e-1) *
        w -
        1.99999999998764832476e-1)
    lo = t - (t * (s1 + s2) - tl)
  }
  let r: f64 = 0.0
  if (hx >= 0) {
    r = hi + lo
  } else {
    const s: f64 = pi - hi
    r = s + (piLo - lo + (pi - s - hi))
  }
  return hy < 0 ? -r : r
}

// The fdlibm core for a in [1e-150, 1e150] and b <= a: neither square overflows, and a b small
// enough for its square to underflow is below a * 2^-54, where it cannot move the answer.
const hypotCoreF = (a: f64, b: f64): f64 => {
  const w: f64 = a - b
  if (w > b) {
    const t1: f64 = clearLo(a)
    const t2: f64 = a - t1
    return Math.sqrt(t1 * t1 - (b * -b - t2 * (a + t1)))
  }
  const a2: f64 = a + a
  const y1: f64 = clearLo(b)
  const y2: f64 = b - y1
  const t1: f64 = clearLo(a2)
  const t2: f64 = a2 - t1
  return Math.sqrt(t1 * y1 - (w * -w - (t1 * y2 + t2 * b)))
}

// Every case outside the core: an infinity wins over a NaN, a zero b gives a, and otherwise both
// operands are scaled by a power of two into the core's range and the answer back out of it.
const hypotRest = (ax: f64, ay: f64, a: f64, b: f64): f64 => {
  const one: f64 = 1.0
  const inf: f64 = one / 0.0
  if (ax === inf || ay === inf) {
    return inf
  }
  if (isNan(a) || isNan(b)) {
    return ax + ay
  }
  if (b === 0.0) {
    return a
  }
  if (a > 1.0) {
    const down: f64 = pow2(-600)
    return pow2(600) * hypotCoreF(a * down, b * down)
  }
  const up: f64 = pow2(600)
  return pow2(-600) * hypotCoreF(a * up, b * up)
}

/**
 * `Math.hypot(x, y)`: fdlibm's core, rescaled by a power of two outside
 * [1e-150, 1e150].
 *
 * @param x One side's length; only its magnitude matters.
 * @param y The other side's length; only its magnitude matters.
 * @returns The square root of `x * x + y * y`, computed without the squares
 *   overflowing or underflowing: Infinity when either is infinite, even beside
 *   a NaN, and NaN when either is otherwise NaN.
 */
export const hypotF64 = (x: f64, y: f64): f64 => {
  const ax: f64 = Math.abs(x)
  const ay: f64 = Math.abs(y)
  const a: f64 = ax > ay ? ax : ay
  const b: f64 = ax > ay ? ay : ax
  if (a < 1.0e150 && a > 1.0e-150) {
    // JavaScript's `hypot(x, 0)` is `|x|` exactly. The core gives it too -- its sum is a^2 to
    // within 2^-18 ulp before rounding, and the root of a double that near a^2 rounds to a -- so
    // the compare only skips the core's work.
    return b === 0.0 ? a : hypotCoreF(a, b)
  }
  return hypotRest(ax, ay, a, b)
}

// fdlibm's SET_HIGH_WORD and SET_LOW_WORD.
const withHi = (x: f64, hi: i32): f64 =>
  bitsToF64((toI64(hi) << toI64(32)) | (f64ToBits(x) & ((toI64(1) << toI64(32)) - toI64(1))))
const withLo = (x: f64, lo: u32): f64 => bitsToF64((f64ToBits(x) & (toI64(-1) << toI64(32))) | toI64(lo))

// The rational approximation e_exp.c and e_pow.c share: P1 + t * (P2 + ... + t * P5).
const expPoly = (t: f64): f64 =>
  t * (t * (t * (t * 4.13813679705723846039e-8 - 1.65339022054652515390e-6) + 6.61375632143793436117e-5) - 2.77777777770155933842e-3) +
  1.66666666666666019037e-1

// fdlibm's huge * huge and tiny * tiny, an overflow and an underflow with the sign of `s`.
const overflow = (s: f64): f64 => s * 1.0e300 * 1.0e300
const underflow = (s: f64): f64 => s * 1.0e-300 * 1.0e-300

/**
 * `Math.exp(x)`: fdlibm's `__ieee754_exp`, a reduction by ln 2 and a
 * rational approximation on [-ln2/2, ln2/2].
 *
 * @param x The exponent.
 * @returns e raised to `x`; Infinity past 709.78, +0 below -745.13, NaN for
 *   a NaN, and 0 for -Infinity.
 */
export const expF64 = (x: f64): f64 => {
  const hxs: i32 = hiWord(x)
  const negative: boolean = hxs < 0
  const hx: i32 = hxs & 0x7fffffff
  if (hx >= 0x40862e42) {
    if (hx >= 0x7ff00000) {
      if (isNan(x)) {
        return x + x
      }
      return negative ? 0.0 : x
    }
    if (x > 7.09782712893383973096e2) {
      return overflow(1.0)
    }
    if (x < -7.45133219101941108420e2) {
      return 0.0
    }
  }
  let k: i32 = 0
  let hi: f64 = 0.0
  let lo: f64 = 0.0
  let r: f64 = x
  if (hx > 0x3fd62e42) {
    if (hx < 0x3ff0a2b2) {
      hi = negative ? x + 6.93147180369123816490e-1 : x - 6.93147180369123816490e-1
      lo = negative ? -1.90821492927058770002e-10 : 1.90821492927058770002e-10
      k = negative ? -1 : 1
    } else {
      const half: f64 = negative ? -0.5 : 0.5
      k = toI32(x * 1.44269504088896338700 + half)
      const t: f64 = toF64(k)
      hi = x - t * 6.93147180369123816490e-1
      lo = t * 1.90821492927058770002e-10
    }
    r = hi - lo
  } else if (hx < 0x3e300000) {
    return x + 1.0
  }
  const t: f64 = r * r
  const c: f64 = r - t * expPoly(t)
  const one: f64 = 1.0
  if (k === 0) {
    return one - ((r * c) / (c - 2.0) - r)
  }
  const y: f64 = one - (lo - (r * c) / (2.0 - c) - hi)
  if (k >= -1021) {
    if (k === 1024) {
      return y * 2.0 * 8.98846567431158e307
    }
    return y * pow2(k)
  }
  return y * pow2(k + 1000) * 9.332636185032189e-302
}

/**
 * `Math.log(x)`: fdlibm's `__ieee754_log`, `x` split as 2^k * (1 + f) and
 * log(1 + f) taken from a polynomial in f / (2 + f).
 *
 * @param x The operand.
 * @returns The natural logarithm of `x`; -Infinity for a zero of either
 *   sign, NaN below zero or for a NaN, and Infinity for Infinity.
 */
export const logF64 = (x: f64): f64 => {
  let v: f64 = x
  let hx: i32 = hiWord(v)
  let k: i32 = 0
  if (hx < 0x00100000) {
    if (((hx & 0x7fffffff) | toI32(loWord(v))) === 0) {
      return -overflow(1.0)
    }
    if (hx < 0) {
      return (v - v) / (v - v)
    }
    k = -54
    v = v * 1.80143985094819840000e16
    hx = hiWord(v)
  }
  if (hx >= 0x7ff00000) {
    return v + v
  }
  k += (hx >> 20) - 1023
  hx = hx & 0x000fffff
  const i: i32 = (hx + 0x95f64) & 0x100000
  v = withHi(v, hx | (i ^ 0x3ff00000))
  k += i >> 20
  const f: f64 = v - 1.0
  const dk: f64 = toF64(k)
  if ((0x000fffff & (2 + hx)) < 3) {
    if (f === 0.0) {
      return dk * 6.93147180369123816490e-1 + dk * 1.90821492927058770002e-10
    }
    const rr: f64 = f * f * (f * -0.33333333333333333 + 0.5)
    if (k === 0) {
      return f - rr
    }
    return dk * 6.93147180369123816490e-1 - (rr - dk * 1.90821492927058770002e-10 - f)
  }
  const s: f64 = f / (2.0 + f)
  const z: f64 = s * s
  const w: f64 = z * z
  const t1: f64 = w * (w * (w * 1.531383769920937332e-1 + 2.222219843214978396e-1) + 3.999999999940941908e-1)
  const t2: f64 =
    z * (w * (w * (w * 1.479819860511658591e-1 + 1.818357216161805012e-1) + 2.857142874366239149e-1) + 6.666666666666735130e-1)
  const r: f64 = t2 + t1
  if (((hx - 0x6147a) | (0x6b851 - hx)) > 0) {
    const hfsq: f64 = f * f * 0.5
    if (k === 0) {
      return f - (hfsq - s * (hfsq + r))
    }
    return dk * 6.93147180369123816490e-1 - (hfsq - (s * (hfsq + r) + dk * 1.90821492927058770002e-10) - f)
  }
  if (k === 0) {
    return f - s * (f - r)
  }
  return dk * 6.93147180369123816490e-1 - (s * (f - r) - dk * 1.90821492927058770002e-10 - f)
}

// 2^n * z for a z near 1 whose product is subnormal, as fdlibm's scalbn, rounded once.
const scaleDown = (z: f64, n: i32): f64 => z * pow2(-1000) * pow2(n + 1000)

// pow's |y| > 2^31 case when x is not within 2^-20 of 1: an overflow or an underflow.
const powHugeY = (ix: i32, hy: i32, iy: i32, s: f64): f64 => {
  if (iy > 0x43f00000) {
    if (ix <= 0x3fefffff) {
      return hy < 0 ? overflow(1.0) : 0.0
    }
    return hy > 0 ? overflow(1.0) : 0.0
  }
  if (ix < 0x3fefffff) {
    return hy < 0 ? overflow(s) : underflow(s)
  }
  return hy > 0 ? overflow(s) : underflow(s)
}

// 2^(ph + pl) * s, the tail of e_pow.c once log2(x) * y is split as ph + pl.
const powExp2 = (ph0: f64, pl: f64, s: f64): f64 => {
  let ph: f64 = ph0
  const z0: f64 = pl + ph
  const j: i32 = hiWord(z0)
  const i: i32 = toI32(loWord(z0))
  if (j >= 0x40900000) {
    if (((j - 0x40900000) | i) !== 0 || pl + 8.0085662595372944372e-17 > z0 - ph) {
      return overflow(s)
    }
  } else if ((j & 0x7fffffff) >= 0x4090cc00) {
    // 0xc090cc00, the high word of -1075, as an i32.
    if (j !== -1064252416 || i !== 0 || pl <= z0 - ph) {
      return underflow(s)
    }
  }
  const ij: i32 = j & 0x7fffffff
  let k: i32 = (ij >> 20) - 0x3ff
  let n: i32 = 0
  if (ij > 0x3fe00000) {
    n = j + (0x00100000 >> (k + 1))
    k = ((n & 0x7fffffff) >> 20) - 0x3ff
    const t: f64 = withHi(0.0, n & ~(0x000fffff >> k))
    n = ((n & 0x000fffff) | 0x00100000) >> (20 - k)
    if (j < 0) {
      n = -n
    }
    ph = ph - t
  }
  const t: f64 = withLo(pl + ph, toU32(0))
  const u: f64 = t * 6.93147182464599609375e-1
  const v: f64 = (pl - (t - ph)) * 6.93147180559945286227e-1 + t * -1.90465429995776804525e-9
  let z: f64 = u + v
  const w: f64 = v - (z - u)
  const t1: f64 = z - z * z * expPoly(z * z)
  const r: f64 = (z * t1) / (t1 - 2.0) - (w + z * w)
  const one: f64 = 1.0
  z = one - (r - z)
  const hz: i32 = hiWord(z) + (n << 20)
  if (hz >> 20 <= 0) {
    return s * scaleDown(z, n)
  }
  return s * withHi(z, hz)
}

/**
 * `Math.pow(x, y)`: fdlibm's `__ieee754_pow`, log2(x) in extra precision times
 * `y`, then 2 raised to that, with JavaScript's answers where fdlibm's differ.
 *
 * @param x The base.
 * @param y The exponent.
 * @returns `x` raised to `y`; 1 when `y` is a zero, NaN when `y` is NaN or
 *   when `x` is ±1 and `y` infinite (where C's pow gives 1), and NaN for a
 *   negative finite `x` and a non-integer `y`.
 */
export const powF64 = (x: f64, y: f64): f64 => {
  const hx: i32 = hiWord(x)
  const lx: u32 = loWord(x)
  const hy: i32 = hiWord(y)
  const ly: u32 = loWord(y)
  const ix: i32 = hx & 0x7fffffff
  const iy: i32 = hy & 0x7fffffff
  if ((iy | toI32(ly)) === 0) {
    return 1.0
  }
  if (isNan(x) || isNan(y)) {
    return x + y
  }
  // JavaScript: (±1) ** ±Infinity is NaN.
  if (iy === 0x7ff00000 && ly === toU32(0) && ix === 0x3ff00000 && lx === toU32(0)) {
    return y - y
  }
  if (hx === 0x3ff00000 && lx === toU32(0)) {
    return 1.0
  }
  // Whether y is an integer, for a negative x: 0 no, 1 odd, 2 even.
  let yisint: i32 = 0
  if (hx < 0) {
    if (iy >= 0x43400000) {
      yisint = 2
    } else if (iy >= 0x3ff00000) {
      const k: i32 = (iy >> 20) - 0x3ff
      if (k > 20) {
        const j: u32 = ly >> toU32(52 - k)
        if (j << toU32(52 - k) === ly) {
          yisint = 2 - toI32(j & toU32(1))
        }
      } else if (ly === toU32(0)) {
        const j: i32 = iy >> (20 - k)
        if (j << (20 - k) === iy) {
          yisint = 2 - (j & 1)
        }
      }
    }
  }
  if (ly === toU32(0)) {
    if (iy === 0x7ff00000) {
      if (ix >= 0x3ff00000) {
        return hy >= 0 ? y : 0.0
      }
      return hy < 0 ? -y : 0.0
    }
    if (iy === 0x3ff00000) {
      return hy < 0 ? 1.0 / x : x
    }
    if (hy === 0x40000000) {
      return x * x
    }
    if (hy === 0x3fe00000 && hx >= 0) {
      return Math.sqrt(x)
    }
  }
  let ax: f64 = Math.abs(x)
  if (lx === toU32(0) && (ix === 0x7ff00000 || ix === 0 || ix === 0x3ff00000)) {
    let z: f64 = hy < 0 ? 1.0 / ax : ax
    if (hx < 0) {
      if (((ix - 0x3ff00000) | yisint) === 0) {
        z = (z - z) / (z - z)
      } else if (yisint === 1) {
        z = -z
      }
    }
    return z
  }
  if (hx < 0 && yisint === 0) {
    return (x - x) / (x - x)
  }
  const s: f64 = hx < 0 && yisint === 1 ? -1.0 : 1.0
  let t1: f64 = 0.0
  let t2: f64 = 0.0
  if (iy > 0x41e00000) {
    if (iy > 0x43f00000 || ix < 0x3fefffff || ix > 0x3ff00000) {
      return powHugeY(ix, hy, iy, s)
    }
    const t: f64 = ax - 1.0
    const w: f64 = t * t * (t * (t * 0.25 - 0.3333333333333333333333) + 0.5)
    const u: f64 = t * 1.44269502162933349609
    const v: f64 = t * 1.92596299112661746887e-8 - w * 1.44269504088896338700
    t1 = withLo(u + v, toU32(0))
    t2 = v - (t1 - u)
  } else {
    let n: i32 = 0
    let jx: i32 = ix
    if (jx < 0x00100000) {
      ax = ax * 9007199254740992.0
      n = -53
      jx = hiWord(ax)
    }
    n += (jx >> 20) - 0x3ff
    const j: i32 = jx & 0x000fffff
    jx = j | 0x3ff00000
    let k: i32 = 0
    if (j <= 0x3988e) {
      k = 0
    } else if (j < 0xbb67a) {
      k = 1
    } else {
      n += 1
      jx -= 0x00100000
    }
    ax = withHi(ax, jx)
    const bp: f64 = k === 0 ? 1.0 : 1.5
    const dph: f64 = k === 0 ? 0.0 : 5.84962487220764160156e-1
    const dpl: f64 = k === 0 ? 0.0 : 1.35003920212974897128e-8
    const u: f64 = ax - bp
    const one: f64 = 1.0
    const v: f64 = one / (ax + bp)
    const ss: f64 = u * v
    const sh: f64 = withLo(ss, toU32(0))
    let th: f64 = withHi(0.0, ((jx >> 1) | 0x20000000) + 0x00080000 + (k << 18))
    let tl: f64 = ax - (th - bp)
    const sl: f64 = v * (u - sh * th - sh * tl)
    let s2: f64 = ss * ss
    const l3: f64 = s2 * (s2 * (s2 * 2.06975017800338417784e-1 + 2.30660745775561754067e-1) + 2.72728123808534006489e-1)
    let r: f64 = s2 * s2 * (s2 * (s2 * (l3 + 3.33333329818377432918e-1) + 4.28571428578550184252e-1) + 5.99999999999994648725e-1)
    r += sl * (sh + ss)
    s2 = sh * sh
    th = withLo(s2 + 3.0 + r, toU32(0))
    tl = r - (th - 3.0 - s2)
    const pu: f64 = sh * th
    const pv: f64 = sl * th + tl * ss
    const ph: f64 = withLo(pu + pv, toU32(0))
    const pl: f64 = pv - (ph - pu)
    const zh: f64 = ph * 9.61796700954437255859e-1
    const zl: f64 = ph * -7.02846165095275826516e-9 + pl * 9.61796693925975554329e-1 + dpl
    const t: f64 = toF64(n)
    t1 = withLo(zh + zl + dph + t, toU32(0))
    t2 = zl - (t1 - t - dph - zh)
  }
  const y1: f64 = withLo(y, toU32(0))
  return powExp2(y1 * t1, (y - y1) * t1 + y * t2, s)
}

/**
 * The remainder `x % y` on `f64`, as JavaScript and C's `fmod` define it:
 * e_fmod.c's shift-and-subtract, exact, over one 64-bit word rather than two
 * 32-bit ones.
 *
 * @param x The dividend.
 * @param y The divisor.
 * @returns `x - n * y` for the integer n that truncates `x / y`, exactly,
 *   with `x`'s sign; NaN when `x` is infinite, `y` is a zero or either is
 *   NaN, and `x` itself when `y` is infinite and `x` finite.
 */
export const fmodF64 = (x: f64, y: f64): f64 => {
  let ux: u64 = toU64(f64ToBits(x))
  let uy: u64 = toU64(f64ToBits(y))
  let ex: i32 = toI32((ux >> toU64(52)) & toU64(0x7ff))
  let ey: i32 = toI32((uy >> toU64(52)) & toU64(0x7ff))
  const sign: u64 = ux & (toU64(1) << toU64(63))
  if (uy << toU64(1) === toU64(0) || isNan(y) || ex === 0x7ff) {
    return (x * y) / (x * y)
  }
  if (ux << toU64(1) <= uy << toU64(1)) {
    return ux << toU64(1) === uy << toU64(1) ? 0.0 * x : x
  }
  const mant: u64 = (toU64(1) << toU64(52)) - toU64(1)
  const implicit: u64 = toU64(1) << toU64(52)
  // Each significand to an integer with its leading one at bit 52, the exponent lowered
  // past zero for a subnormal.
  if (ex === 0) {
    let i: u64 = ux << toU64(12)
    while (i >> toU64(63) === toU64(0)) {
      ex -= 1
      i = i << toU64(1)
    }
    ux = ux << toU64(1 - ex)
  } else {
    ux = (ux & mant) | implicit
  }
  if (ey === 0) {
    let i: u64 = uy << toU64(12)
    while (i >> toU64(63) === toU64(0)) {
      ey -= 1
      i = i << toU64(1)
    }
    uy = uy << toU64(1 - ey)
  } else {
    uy = (uy & mant) | implicit
  }
  while (ex > ey) {
    if (ux >= uy) {
      if (ux === uy) {
        return 0.0 * x
      }
      ux = ux - uy
    }
    ux = ux << toU64(1)
    ex -= 1
  }
  if (ux >= uy) {
    if (ux === uy) {
      return 0.0 * x
    }
    ux = ux - uy
  }
  while (ux >> toU64(52) === toU64(0)) {
    ux = ux << toU64(1)
    ex -= 1
  }
  if (ex > 0) {
    ux = (ux - implicit) | (toU64(ex) << toU64(52))
  } else {
    ux = ux >> toU64(1 - ex)
  }
  return bitsToF64(toI64(ux | sign))
}
