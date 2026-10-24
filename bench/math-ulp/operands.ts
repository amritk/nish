// The operands behind `std/math.ts`'s accuracy figures, and the shipped
// `Math.tan`, `Math.atan2` and `Math.hypot` of each. `bench/math-ulp/ulp.py`
// reads what this prints and measures every answer against mpmath; the protocol
// is in bench/README.md ("Math accuracy"). Not part of the suite or of CI.
//
// One line per call, every double as its signed 64-bit pattern:
//
//   T <x> <tan x>
//   A <y> <x> <atan2(y, x)>
//   H <x> <y> <hypot(x, y)>
//
// The draws are a fixed xorshift sequence, so every run prints the same
// 2,800,536 lines: the specials paired every way, then for each function
// log-uniform operands over every exponent and draws aimed at its reduction
// branches -- `tan` beside multiples of pi/2 and past 2^20 * pi/2, `atan2` with
// close and far-apart exponents, `hypot` where the squares overflow or
// underflow.
class Rng {
  s: u64
  constructor(seed: u64) {
    this.s = seed
  }
}

const next = (g: Rng): u64 => {
  let st: u64 = g.s
  st = st ^ (st << toU64(13))
  st = st ^ (st >> toU64(7))
  st = st ^ (st << toU64(17))
  g.s = st
  return st
}

const pow2 = (e: i32): f64 => bitsToF64(toI64(e + 1023) << toI64(52))

const hiWord = (x: f64): i32 => toI32(f64ToBits(x) >> toI64(32))

// A double with a uniformly drawn biased exponent in [lo, hi] and a random sign.
const logUniform = (g: Rng, lo: i32, hi: i32): f64 => {
  const r: u64 = next(g)
  const span: u64 = toU64(hi - lo + 1)
  const e: i32 = lo + toI32((r >> toU64(52)) % span)
  const m: u64 = next(g) & ((toU64(1) << toU64(52)) - toU64(1))
  const v: f64 = bitsToF64(toI64((toU64(e) << toU64(52)) | m))
  return (r & toU64(1)) === toU64(0) ? v : -v
}

const unit = (g: Rng): f64 => toF64(toI64(next(g) >> toU64(11))) * pow2(-53)

const nudge = (x: f64, d: i32): f64 => bitsToF64(f64ToBits(x) + toI64(d))

const b = (x: f64): string => `${f64ToBits(x)}`

const tanLine = (x: f64): void => {
  console.log(`T ${b(x)} ${b(Math.tan(x))}`)
}

const atanLine = (y: f64, x: f64): void => {
  console.log(`A ${b(y)} ${b(x)} ${b(Math.atan2(y, x))}`)
}

const hypotLine = (x: f64, y: f64): void => {
  console.log(`H ${b(x)} ${b(y)} ${b(Math.hypot(x, y))}`)
}

const special = (i: i32): f64 => {
  const one: f64 = 1.0
  switch (i) {
    case 0:
      return 0.0
    case 1:
      return -0.0
    case 2:
      return one / 0.0
    case 3:
      return -one / 0.0
    case 4:
      return one / 0.0 - one / 0.0
    case 5:
      return pow2(-1022) * pow2(-52)
    case 6:
      return -pow2(-1022) * pow2(-52)
    case 7:
      return 1.0
    case 8:
      return -1.0
    case 9:
      return 1.7976931348623157e308
    case 10:
      return -1.7976931348623157e308
    case 11:
      return pow2(-1022)
    case 12:
      return 3.0
    case 13:
      return -3.0
    case 14:
      return 1e-300
    default:
      return -1e300
  }
}

export const main = (): void => {
  const g = new Rng(toU64(0x1e3779b9))
  const n: i32 = 200000
  for (let i: i32 = 0; i < 16; i++) {
    tanLine(special(i))
    for (let j: i32 = 0; j < 16; j++) {
      atanLine(special(i), special(j))
      hypotLine(special(i), special(j))
    }
  }
  // tan: the double nearest a multiple of pi/2 (Kahan's), then each branch.
  const hard: f64 = 6381956970095103.0 * pow2(797)
  for (let d: i32 = -4; d <= 4; d++) {
    tanLine(nudge(hard, d))
  }
  for (let i: i32 = 0; i < n; i++) {
    tanLine(logUniform(g, 960, 2046))
    tanLine(logUniform(g, 1043, 1100))
    tanLine((unit(g) * 2.0 - 1.0) * 1647099.0)
    tanLine(toF64(toI32(next(g) >> toU64(40)) - 8388608) / 65536.0)
  }
  for (let k: i32 = 1; k < 100000; k++) {
    const c: f64 = toF64(k) * 1.5707963267948966
    tanLine(nudge(c, toI32(next(g) % toU64(7)) - 3))
  }
  for (let i: i32 = 0; i < 100000; i++) {
    const k: f64 = Math.floor(unit(g) * 1e12)
    tanLine(nudge(k * 1.5707963267948966, toI32(next(g) % toU64(7)) - 3))
  }
  // atan2
  for (let i: i32 = 0; i < n; i++) {
    atanLine(logUniform(g, 0, 2046), logUniform(g, 0, 2046))
    const x: f64 = logUniform(g, 1, 2046)
    const e: i32 = (hiWord(x) >> 20) & 0x7ff
    atanLine(logUniform(g, Math.max(1, e - 3), Math.min(2046, e + 3)), x)
    const r: f64 = unit(g) * 3.0
    atanLine(x * (r - 1.5), x)
    atanLine(logUniform(g, 1, 2046), logUniform(g, 1, 2046) * 1e-40)
  }
  // hypot
  for (let i: i32 = 0; i < n; i++) {
    hypotLine(logUniform(g, 0, 2046), logUniform(g, 0, 2046))
    const x: f64 = logUniform(g, 1, 2046)
    const e: i32 = (hiWord(x) >> 20) & 0x7ff
    hypotLine(x, logUniform(g, Math.max(0, e - 3), Math.min(2046, e + 3)))
    hypotLine(x, logUniform(g, Math.max(0, e - 30), Math.min(2046, e + 30)))
    hypotLine(logUniform(g, 1980, 2046), logUniform(g, 1980, 2046))
    hypotLine(logUniform(g, 0, 70), logUniform(g, 0, 70))
  }
}
