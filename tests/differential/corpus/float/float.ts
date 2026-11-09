// WP50 W7's float corpus (docs/wp50-wasm-host.md §9): every arithmetic
// operator and every float `Math` builtin over the operands where targets part
// ways -- signed zeros, subnormals, the normal extremes, the infinities, NaN,
// the integers around 2^53, multiples of pi/4 out to 1e300 -- each answer
// printed as its bits in hex. Built with `--deterministic`, its output is the
// same bytes natively on x86-64 and aarch64, as wasm32 under Node and as the
// `--emit-ts` reading under Node; tests/run.js's `float-corpus` section holds
// each to `expected.txt` beside this file. The file is not a `main.ts`, so the
// differential and soundness runners, whose reference is the JS rewrite
// without the flag, do not pick it up.

const DIGITS: string = "0123456789abcdef"

// `bits`'s 32 bits as 8 hex digits.
const hex32 = (bits: i32): string => {
  const out: string[] = []
  let shift: i32 = 28
  while (shift >= 0) {
    const nibble = (bits >> shift) & 15
    out.push(DIGITS.substring(nibble, nibble + 1))
    shift -= 4
  }
  return out.join("")
}

// `bits`'s 64 bits as 16 hex digits, the sign bit first.
const hex64 = (bits: i64): string => hex32(toI32(bits >> 32)) + hex32(toI32((bits << 32) >> 32))

const h = (x: f64): string => hex64(f64ToBits(x))
const hf = (x: f32): string => hex32(f32ToBits(x))

const inputs = (): f64[] => {
  const q: f64 = Math.PI / 4
  const one: f64 = 1.0
  const zero: f64 = 0.0
  const inf: f64 = one / zero
  const nan: f64 = inf - inf
  return [
    0.0, -0.0, 5e-324, -5e-324, 2.225073858507201e-308, 2.2250738585072014e-308, -2.2250738585072014e-308,
    1.7976931348623157e308, -1.7976931348623157e308, inf, -inf, nan,
    9007199254740991.0, 9007199254740992.0, 9007199254740994.0, -9007199254740993.0,
    1.0, -1.0, 0.5, 2.0, -3.0, 0.1, 1e-10, 709.78, -745.13, 1e22,
    q, 2.0 * q, 3.0 * q, 4.0 * q, -5.0 * q, 6.0 * q, 7.0 * q, 1e6 * q,
    1e15, 1e100, 1e200, 1e300, -1e300,
  ]
}

// The binary operators run every pair of these, a sixteen-operand subset, so
// the expected file stays a size a reviewer can read.
const pairs = (xs: f64[]): f64[] => {
  const picked: f64[] = []
  for (const i of [0, 1, 2, 5, 7, 9, 10, 11, 13, 16, 18, 20, 21, 27, 33, 37]) {
    if (i < xs.length) {
      picked.push(xs[i])
    }
  }
  return picked
}

const unary = (name: string, xs: f64[], f: (x: f64) => f64): void => {
  const line: string[] = [name]
  for (const x of xs) {
    line.push(h(f(x)))
  }
  console.log(line.join(" "))
}

const binary = (name: string, xs: f64[], f: (x: f64, y: f64) => f64): void => {
  for (const x of xs) {
    const line: string[] = [`${name} ${h(x)}:`]
    for (const y of xs) {
      line.push(h(f(x, y)))
    }
    console.log(line.join(" "))
  }
}

const binary32 = (name: string, xs: f64[], f: (x: f32, y: f32) => f32): void => {
  for (const x of xs) {
    const line: string[] = [`${name} ${hf(toF32(x))}:`]
    for (const y of xs) {
      line.push(hf(f(toF32(x), toF32(y))))
    }
    console.log(line.join(" "))
  }
}

export const main = (): i32 => {
  const xs = inputs()
  const ys = pairs(xs)
  unary("in", xs, (x: f64): f64 => x)
  unary("neg", xs, (x: f64): f64 => -x)
  unary("sqrt", xs, (x: f64): f64 => Math.sqrt(x))
  unary("floor", xs, (x: f64): f64 => Math.floor(x))
  unary("ceil", xs, (x: f64): f64 => Math.ceil(x))
  unary("trunc", xs, (x: f64): f64 => Math.trunc(x))
  unary("round", xs, (x: f64): f64 => Math.round(x))
  unary("abs", xs, (x: f64): f64 => Math.abs(x))
  unary("sign", xs, (x: f64): f64 => Math.sign(x))
  unary("sin", xs, (x: f64): f64 => Math.sin(x))
  unary("cos", xs, (x: f64): f64 => Math.cos(x))
  unary("tan", xs, (x: f64): f64 => Math.tan(x))
  unary("exp", xs, (x: f64): f64 => Math.exp(x))
  unary("log", xs, (x: f64): f64 => Math.log(x))
  unary("f32", xs, (x: f64): f64 => toF64(toF32(x)))
  binary("add", ys, (x: f64, y: f64): f64 => x + y)
  binary("sub", ys, (x: f64, y: f64): f64 => x - y)
  binary("mul", ys, (x: f64, y: f64): f64 => x * y)
  binary("div", ys, (x: f64, y: f64): f64 => x / y)
  binary("rem", ys, (x: f64, y: f64): f64 => x % y)
  binary("muladd", ys, (x: f64, y: f64): f64 => x * y + 0.1)
  binary("pow", ys, (x: f64, y: f64): f64 => Math.pow(x, y))
  binary("atan2", ys, (x: f64, y: f64): f64 => Math.atan2(x, y))
  binary("hypot", ys, (x: f64, y: f64): f64 => Math.hypot(x, y))
  binary("min", ys, (x: f64, y: f64): f64 => Math.min(x, y))
  binary("max", ys, (x: f64, y: f64): f64 => Math.max(x, y))
  binary32("add32", ys, (x: f32, y: f32): f32 => x + y)
  binary32("sub32", ys, (x: f32, y: f32): f32 => x - y)
  binary32("mul32", ys, (x: f32, y: f32): f32 => x * y)
  binary32("div32", ys, (x: f32, y: f32): f32 => x / y)
  binary32("rem32", ys, (x: f32, y: f32): f32 => x % y)
  return 0
}
