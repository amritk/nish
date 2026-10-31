// `String(x)` for an f64: the runtime's shortest-digits formatter
// (`nish_f64_format`, runtime/runtime.c), timed per number.
//
//   build/nish bench/f64-format.ts -o build/bench/f64-format/ --link build/bench/f64-format/app
//   build/bench/f64-format/app
//
// The inputs are a seeded mix, built before the clock starts, in three equal
// thirds: random bit patterns (every exponent, seventeen digits nearly always),
// short decimals (a few digits at a moderate exponent, the shape most printed
// numbers have) and integers below 2^53. Each is formatted and its length
// folded into a checksum, which the program prints; it is the same from run to
// run and from formatter to formatter, so two builds that disagree on it did
// not print the same strings. The figure is nanoseconds per number over all
// rounds, the arena allocation for the string included, since that is what
// `String(x)` costs a program.
import { monotonicNanos } from "nish:process"

const COUNT: i32 = 262144
const ROUNDS: i32 = 20

/** xorshift64: the next state. */
const step = (s: i64): i64 => {
  let x: i64 = s
  x = x ^ (x << 13)
  x = x ^ (x >>> 7)
  x = x ^ (x << 17)
  return x
}

/** The length of `String(x)`: the string dies with the call, so the arena does not grow. */
const lengthOf = (x: f64): i32 => toI32(`${x}`.length)

export const main = (): i32 => {
  const values: f64[] = []
  let s: i64 = toI64(0x2545f491) * toI64(0x4f6cdd1d) + toI64(1)
  let i: i32 = 0
  while (i < COUNT) {
    s = step(s)
    const kind: i32 = i % 3
    if (kind === 0) {
      // Random bits, NaN and the infinities included, as they come.
      values.push(bitsToF64(s))
    } else if (kind === 1) {
      // A short decimal: up to six digits over a power of ten from 1e-8 to 1e8.
      const digits: f64 = toF64(toI32(s & toI64(0xfffff)) % 1000000)
      const scale: i32 = (toI32((s >>> 32) & toI64(0xff)) % 17) - 8
      let p: f64 = 1.0
      let k: i32 = 0
      while (k < (scale < 0 ? -scale : scale)) {
        p = p * 10.0
        k += 1
      }
      values.push(scale < 0 ? digits / p : digits * p)
    } else {
      // An integer below 2^53.
      values.push(toF64(s >>> toI64(11)))
    }
    i += 1
  }

  let checksum: i64 = toI64(0)
  const start = monotonicNanos()
  let round: i32 = 0
  while (round < ROUNDS) {
    let j: i32 = 0
    while (j >= 0 && j < values.length) {
      checksum += toI64(lengthOf(values[j]))
      j += 1
    }
    round += 1
  }
  const nanos = monotonicNanos() - start
  const perNumber: f64 = toF64(nanos) / (toF64(COUNT) * toF64(ROUNDS))
  console.log(`checksum: ${checksum}`)
  console.log(`ns per number: ${perNumber}`)
  return 0
}
