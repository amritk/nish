// WP50 W7's float corpus (docs/wp50-wasm-host.md §9): every arithmetic
// operator and every float `Math` builtin over the operands where targets part
// ways -- signed zeros, subnormals, the normal extremes, the infinities, NaN,
// the integers around 2^53, multiples of pi/4 out to 1e300 -- in f64 and in
// f32, each binary one over every pair; NaNs built from bits with a sign and a
// payload; and `parseFloat`, `Number` and `parseInt` over the strings where
// strtod, musl and JavaScript could part ways. Each answer is printed as its
// bits in hex. Built with `--deterministic`, its output is the
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

const unary32 = (name: string, xs: f64[], f: (x: f32) => f32): void => {
  const line: string[] = [name]
  for (const x of xs) {
    line.push(hf(f(toF32(x))))
  }
  console.log(line.join(" "))
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

// The f64 whose bits are the four 16-bit groups, high first.
const fromBits = (a: i32, b: i32, c: i32, d: i32): f64 =>
  bitsToF64((toI64(a) << toI64(48)) | (toI64(b) << toI64(32)) | (toI64(c) << toI64(16)) | toI64(d))

// NaNs with a sign and a payload. Under the flag every read of one, straight or
// after an operation that may keep or drop its payload, is the one quiet NaN.
// There is no `bitsToF32`, so the f32 ones are the f64 ones narrowed, which
// keeps the payload's high bits on hardware that keeps any.
const nans = (): void => {
  const doubles: f64[] = [
    fromBits(0xfff8, 0, 0, 0),
    fromBits(0x7ff0, 0, 0, 1),
    fromBits(0xfff8, 0, 0, 0x1234),
    fromBits(0x7fff, 0xffff, 0xffff, 0xffff),
    fromBits(0xfff4, 0x5678, 0, 0),
  ]
  const one: f64 = 1.0
  const one32: f32 = toF32(one)
  for (const x of doubles) {
    const y: f32 = toF32(x)
    const reads: string[] = [h(x), h(-x), h(x + one), h(x * one), h(Math.abs(x)), h(Math.sqrt(x))]
    reads.push(h(Math.min(x, one)))
    reads.push(h(x % one))
    reads.push(hf(y))
    reads.push(hf(-y))
    reads.push(hf(y + one32))
    reads.push(hf(Math.abs(y)))
    reads.push(hf(y % one32))
    reads.push(h(toF64(y)))
    console.log(`nan ${reads.join(" ")}`)
  }
}

// The strings `parseFloat`, `Number` and `parseInt` read, numbered in the
// output: decimal ties, subnormals and overflow, which every libc and V8 round
// alike; `0x` integers past 2^53, which musl's strtod misrounded; hex floats,
// which strtod reads and JavaScript does not; the other radix prefixes,
// whitespace, `Infinity` and the i32 edges of `parseInt`.
const parseInputs = (): string[] => [
  "0.1", "2.2250738585072011e-308", "2.2250738585072014e-308", "2.225073858507201136057409796709131975934819546351645648e-308",
  "9007199254740993", "9007199254740995", "9007199254740993.0000000001", "4.9406564584124654e-324",
  "2.4703282292062327e-324", "2.4703282292062328e-324", "1e400", "-1e400", "1e-400", "-1e-400",
  "-0", "0", "-0.0", "+.5", "5.", ".", "", "  ", "1_000", "1e", "1e+", "0.1e-5",
  "123456789012345678901234567890", "1.7976931348623157e308", "1.7976931348623158e308", "1.7976931348623159e308",
  "1.00000000000000011102230246251565404236316680908203125", "1.00000000000000011102230246251565404236316680908203126",
  "0.1000000000000000055511151231257827021181583404541015625", "8.98846567431158e307", "4.35e-320",
  "0x10", "0X1f", "0x", "0xg", "-0x10", "+0x10", "0x20000000000001", "0x20000000000003", "0x1fffffffffffff1",
  "0xffffffffffffffffffffffffffffffffff", "0x1p3", "0x1.8", "0x1P-2", "-0x1p3", "0x.8", "0b101", "0o17", "017", "08",
  "1e5x", "12px", "Infinity", "-Infinity", "+Infinity", "infinity", "inf", "NaN", "nan", "Infinityx",
  " 12 ", "\t12\n", "\v\f\r12", "\u00a012", "12\u00a0", "1e308", "1e309", "1e-323", "1e-324", "3e-324",
  "42", "-42", " 42abc", "2147483647", "2147483648", "-2147483648", "-2147483649", "99999999999999999999",
  "-99999999999999999999", "9223372036854775807", "9223372036854775808", "1e3", "3.9", "-3.9", "abc", "+7", "--7", "+-7",
  "00000000000000000000000000000000000001", "0.000000000000000000000000000000000000000000001e45",
]

export const main = (): i32 => {
  const xs = inputs()
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
  unary32("in32", xs, (x: f32): f32 => x)
  unary32("neg32", xs, (x: f32): f32 => -x)
  unary32("abs32", xs, (x: f32): f32 => Math.abs(x))
  unary32("sqrt32", xs, (x: f32): f32 => toF32(Math.sqrt(toF64(x))))
  unary32("sign32", xs, (x: f32): f32 => toF32(Math.sign(toF64(x))))
  binary("add", xs, (x: f64, y: f64): f64 => x + y)
  binary("sub", xs, (x: f64, y: f64): f64 => x - y)
  binary("mul", xs, (x: f64, y: f64): f64 => x * y)
  binary("div", xs, (x: f64, y: f64): f64 => x / y)
  binary("rem", xs, (x: f64, y: f64): f64 => x % y)
  binary("muladd", xs, (x: f64, y: f64): f64 => x * y + 0.1)
  binary("pow", xs, (x: f64, y: f64): f64 => Math.pow(x, y))
  binary("atan2", xs, (x: f64, y: f64): f64 => Math.atan2(x, y))
  binary("hypot", xs, (x: f64, y: f64): f64 => Math.hypot(x, y))
  binary("min", xs, (x: f64, y: f64): f64 => Math.min(x, y))
  binary("max", xs, (x: f64, y: f64): f64 => Math.max(x, y))
  binary32("add32", xs, (x: f32, y: f32): f32 => x + y)
  binary32("sub32", xs, (x: f32, y: f32): f32 => x - y)
  binary32("mul32", xs, (x: f32, y: f32): f32 => x * y)
  binary32("div32", xs, (x: f32, y: f32): f32 => x / y)
  binary32("rem32", xs, (x: f32, y: f32): f32 => x % y)
  binary32("min32", xs, (x: f32, y: f32): f32 => Math.min(x, y))
  binary32("max32", xs, (x: f32, y: f32): f32 => Math.max(x, y))
  nans()
  let i: i32 = 0
  for (const s of parseInputs()) {
    console.log(`parse ${i} ${h(parseFloat(s))} ${h(Number(s))} ${parseInt(s)}`)
    i += 1
  }
  return 0
}
