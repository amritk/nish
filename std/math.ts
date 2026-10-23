/**
 * `std/math` — `Math.atan2`, `Math.tan` and `Math.hypot` on `f64`, in Nish
 * rather than libm, so a program answers the same on every target, wasm
 * included, and the optimiser sees the whole function.
 *
 * A program does not import this module. A call to one of the three is what
 * loads it (the checker's `importMath`), and the compiler copies each function
 * here that the call reaches into the calling module as an `internal`
 * function, so this file writes no `.ll` of its own. Under Node and `tsc` the
 * calls are the platform's `Math`, so nothing here runs there.
 *
 * **Exactness.** Each answers JavaScript's value for every NaN, signed zero
 * and infinity — every `atan2` infinity pairing, and `hypot`'s Infinity when
 * either operand is infinite, even beside a NaN — and is within one ulp of
 * the correctly rounded result elsewhere. Measured against mpmath over 2.8
 * million random and edge-case operands: `tan` 0.83 ulp, `atan2` 0.84 ulp,
 * `hypot` 0.93 ulp (`tests/cases/math_std_edges` pins the special values).
 *
 * **`tan`** is fdlibm's `__kernel_tan` behind its Cody-Waite reduction for
 * |x| below 2^20·π/2, with the quadrant's parity read from the rounding
 * constant. Larger arguments reduce by an integer Payne-Hanek: 192 bits of
 * 2/π against the 53-bit mantissa, which is exact near every multiple of π/2
 * a double can name. **`atan2`** is fdlibm's, with the quotient `y/x`
 * carried as a double-double, so the argument reduction loses nothing, and
 * π − atan taken in double-double. **`hypot`** is fdlibm's core on operands
 * in [1e-150, 1e150], where neither square can overflow, and a power-of-two
 * rescale into that range otherwise.
 */

/*
 * Ported from fdlibm (https://www.netlib.org/fdlibm/), as FreeBSD msun carries
 * it, lib/msun/src/k_tan.c, s_tan.c, e_atan2.c, s_atan.c, e_hypot.c and
 * k_rem_pio2.c. Copyright (C) 1993 by Sun Microsystems, Inc. Used under the
 * fdlibm licence; see std/LICENSE-fdlibm.
 *
 * fdlibm's notice, as those files carry it:
 *
 * ====================================================
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *
 * Developed at SunPro, a Sun Microsystems, Inc. business.
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
// tan(x) for |x| >= 2^20 * pi/2 (finite): x * 2/pi mod 4 from a 192-bit window.
const tanLarge = (x: f64, ix: i32, hx: i32): f64 => {
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
  return kernelTan(y0, y1, (n & 1) !== 0)
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
/** `Math.tan(x)`: fdlibm's reduction and kernel, with `tanLarge` past 2^20 * pi/2. */
export const tan = (x: f64): f64 => {
  const ax: f64 = Math.abs(x)
  if (ax < 0.7853984832763672) {
    if (ax < 7.450580596923828e-9) {
      return x
    }
    return kernelTan(x, 0.0, false)
  }
  if (!(ax < 1647099.0)) {
    if (isNan(ax) || ax > 1.7976931348623157e308) {
      return x - x
    }
    const hx: i32 = hiWord(x)
    return tanLarge(x, hx & 0x7fffffff, hx)
  }
  const rounded: f64 = x * 6.36619772367581382433e-1 + 6755399441055744.0
  const fn: f64 = rounded - 6755399441055744.0
  let r: f64 = x - fn * 1.57079632673412561417
  let w: f64 = fn * 6.07710050650619224932e-11
  let y0: f64 = r - w
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
  return kernelTan(y0, y1, (f64ToBits(rounded) & toI64(1)) !== toI64(0))
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

/** `Math.atan2(y, x)`: fdlibm's, with a compensated quotient and a double-double pi - atan. */
export const atan2 = (y: f64, x: f64): f64 => {
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

/** `Math.hypot(x, y)`: fdlibm's core, rescaled by a power of two outside [1e-150, 1e150]. */
export const hypot = (x: f64, y: f64): f64 => {
  const ax: f64 = Math.abs(x)
  const ay: f64 = Math.abs(y)
  const a: f64 = ax > ay ? ax : ay
  const b: f64 = ax > ay ? ay : ax
  if (a < 1.0e150 && a > 1.0e-150) {
    return hypotCoreF(a, b)
  }
  return hypotRest(ax, ay, a, b)
}
