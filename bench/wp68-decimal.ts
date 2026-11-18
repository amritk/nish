// WP68 S1 (docs/wp68-shared-libraries.md §4): the decimal writers std/ carries,
// and the template literal src/ writes numbers with, timed side by side, to
// pick the one a shared copy starts from, against a candidate that writes two
// digits a step from a table. A million values that are not
// negative, of every length from one digit to ten, are written one after
// another into one output, and the program prints a checksum of that output,
// which must agree. Every round changes one value at a position that moves
// with the round, so no round's input is another's. `http1B` is `http1A` byte
// for byte, so the distance between those two is the run's noise band. Only
// the writing is timed; the checksum is read after the clock stops. The
// minimum of each side over the rounds is printed:
//
//   build/seed/bin/nish bench/wp68-decimal.ts --link build/wp68-decimal --profile speed
//   taskset -c 2 build/wp68-decimal
import { monotonicNanos } from "nish:process"
import { least, report } from "./wp68-report"

const ROUNDS: i32 = 9
const COUNT: i32 = 1048576
const MOVE: i32 = 5237
/** Ten digits a value at most. */
const ROOM: i32 = COUNT * 10

/** `http1DecimalDigits`, std/net/http1-codec.ts. */
const http1Digits = (n: i32): i32 => {
  if (n < 10) {
    return 1
  }
  if (n < 100) {
    return 2
  }
  if (n < 1000) {
    return 3
  }
  let digits: i32 = 4
  let v: i32 = n / 10000
  while (v > 0) {
    v = v / 10
    digits += 1
  }
  return digits
}

/** `http1PutDecimal`, std/net/http1-codec.ts, verbatim but for its name: counted, then one digit a step from the last. */
const http1A = (out: u8[], at: i32, n: i32): i32 => {
  const digits: i32 = http1Digits(n)
  let v: i32 = n
  for (let k: i32 = at + digits - 1; k >= at && k >= 0 && k < toI32(out.length); k -= 1) {
    const digit: i32 = v % 10
    out[k] = toU8(48 + digit)
    v = v / 10
  }
  return at + digits
}

/** Its twin, for the noise band. */
const http1B = (out: u8[], at: i32, n: i32): i32 => {
  const digits: i32 = http1Digits(n)
  let v: i32 = n
  for (let k: i32 = at + digits - 1; k >= at && k >= 0 && k < toI32(out.length); k -= 1) {
    const digit: i32 = v % 10
    out[k] = toU8(48 + digit)
    v = v / 10
  }
  return at + digits
}

/** `pgDecimalLength`, std/net/postgres.ts: counted on the negative side, two digits a step. */
const pgLength = (value: i64): i32 => {
  let n: i32 = value < 0 ? 2 : 1
  let v: i64 = value < 0 ? value : -value
  while (v <= -100) {
    v = v / 100
    n += 2
  }
  return v <= -10 ? n + 1 : n
}

/** `pgPutDecimal`, std/net/postgres.ts, verbatim but for its name and its panic returning -1: two digits a step from a `u64`. */
const pgPut = (out: u8[], at: i32, value: i64, n: i32): i32 => {
  if (!(at >= 0 && at < 2147483620 && n >= 1 && n <= 20 && at + n <= toI32(out.length))) {
    return -1
  }
  const first: i32 = value < 0 ? at + 1 : at
  let m: u64 = value < 0 ? toU64(0) - toU64(value) : toU64(value)
  let j: i32 = at + n - 2
  while (m >= 100 && j >= first && j >= 0 && j < 2147483640 && j + 2 <= toI32(out.length)) {
    const pair: u32 = toU32(m % 100)
    const tens: u32 = pair / 10
    out[j] = toU8(48 + tens)
    out[j + 1] = toU8(48 + pair - tens * 10)
    m = m / 100
    j -= 2
  }
  const pair: u32 = toU32(m)
  if (pair >= 10 && j >= first && j >= 0 && j < 2147483640 && j + 2 <= toI32(out.length)) {
    const tens: u32 = pair / 10
    out[j] = toU8(48 + tens)
    out[j + 1] = toU8(48 + pair - tens * 10)
  } else {
    const last: i32 = j + 1
    if (last >= first && last >= 0 && last < toI32(out.length)) {
      out[last] = toU8(48 + pair)
    }
  }
  if (value < 0 && at < toI32(out.length)) {
    out[at] = toU8(45)
  }
  return at + n
}

/** `jsonWriterPutDigits`, std/json.ts, with no suffix and the cursor passed and returned: counted against powers of ten on `-|v|`. */
const jsonPut = (buf: u8[], at: i32, v: i32): i32 => {
  const negative: i32 = v < 0 ? v : -v
  let digits: i32 = 1
  let bound: i32 = -10
  while (digits < 10 && negative <= bound) {
    digits += 1
    if (digits < 10) {
      bound = bound * 10
    }
  }
  const sign: i32 = v < 0 ? 1 : 0
  let rest: i32 = v
  const width: i32 = sign + digits
  if (at < 0 || at > toI32(buf.length) - width) {
    return -1
  }
  if (sign === 1) {
    buf[at] = toU8(45)
  }
  for (let k: i32 = at + sign + digits - 1; k >= at + sign && k >= 0 && k < toI32(buf.length); k -= 1) {
    const digit: i32 = rest % 10
    buf[k] = toU8(48 + (digit < 0 ? -digit : digit))
    rest = (rest - digit) / 10
  }
  return at + width
}

/** The two digits of every value below 100, `"00"` to `"99"`, as bytes. */
const PAIRS: string =
  "00010203040506070809101112131415161718192021222324252627282930313233343536373839404142434445464748495051525354555657585960616263646566676869707172737475767778798081828384858687888990919293949596979899"

/** The candidate: `http1A`'s count, then two digits a step in `i32` from `PAIRS`. */
const pairs = (out: u8[], at: i32, n: i32): i32 => {
  const digits: i32 = http1Digits(n)
  let v: i32 = n
  let k: i32 = at + digits - 2
  while (v >= 100 && k >= at && k >= 0 && k + 1 < toI32(out.length)) {
    const pair: i32 = (v % 100) * 2
    out[k] = toU8(PAIRS.charCodeAt(pair))
    out[k + 1] = toU8(PAIRS.charCodeAt(pair + 1))
    v = v / 100
    k -= 2
  }
  if (v >= 10 && k >= at && k >= 0 && k + 1 < toI32(out.length)) {
    out[k] = toU8(PAIRS.charCodeAt(v * 2))
    out[k + 1] = toU8(PAIRS.charCodeAt(v * 2 + 1))
  } else if (k + 1 >= at && k + 1 >= 0 && k + 1 < toI32(out.length)) {
    out[k + 1] = toU8(48 + v)
  }
  return at + digits
}

/** The bytes `out[0 .. end)` folded, each weighted by its place in an eight-byte cycle. */
const fold = (out: u8[], end: i32): i64 => {
  let s: i64 = toI64(end)
  for (let i: i32 = 0; i < end && i < toI32(out.length); i += 1) {
    s += toI64(out[i]) * toI64((i & 7) + 1)
  }
  return s
}

/** The same fold over a `string`. */
const foldText = (text: string): i64 => {
  let s: i64 = toI64(text.length)
  for (let i: i32 = 0; i < toI32(text.length); i += 1) {
    s += toI64(text.charCodeAt(i)) * toI64((i & 7) + 1)
  }
  return s
}

/** A value of one to ten digits: `x` shifted right by 1 to 31 places, kept below 2^31. */
const drawn = (x: u32): i32 => toI32((x >> (toU32(1) + ((x >> 3) % 31))) & 2147483647)

/** Writes every value with byte side `side`; the end, or -1 when a writer refused. */
const writeAll = (out: u8[], values: i32[], side: i32): i32 => {
  let at: i32 = 0
  for (const v of values) {
    if (at < 0) {
      return -1
    }
    if (side === 0) {
      at = http1A(out, at, v)
    } else if (side === 1) {
      at = http1B(out, at, v)
    } else if (side === 2) {
      const wide: i64 = toI64(v)
      at = pgPut(out, at, wide, pgLength(wide))
    } else if (side === 3) {
      at = jsonPut(out, at, v)
    } else {
      at = pairs(out, at, v)
    }
  }
  return at
}

export const main = (): i32 => {
  const values: i32[] = []
  let x: u32 = 2463534242
  for (let i = 0; i < COUNT; i++) {
    x ^= x << 13
    x ^= x >> 17
    x ^= x << 5
    values.push(drawn(x))
  }
  const out = new Array<u8>(ROOM)
  const names: string[] = ["http1A", "http1B", "pg", "json", "pairs", "template"]
  const best: i64[] = [-1, -1, -1, -1, -1, -1]
  const sums: i64[] = [0, 0, 0, 0, 0, 0]
  for (let round = 0; round < ROUNDS; round++) {
    const at: i32 = (round * MOVE) % COUNT
    if (at < 0 || at >= values.length) {
      return 1
    }
    values[at] = round * 1000003
    // Each round starts at a different side, so no side always runs first.
    for (let k = 0; k < 6; k++) {
      const side: i32 = (round + k) % 6
      if (side < 0 || side >= best.length || side >= sums.length) {
        return 1
      }
      let s: i64 = 0
      const t0 = monotonicNanos()
      if (side < 5) {
        const end: i32 = writeAll(out, values, side)
        best[side] = least(best[side], monotonicNanos() - t0)
        s = fold(out, end)
      } else {
        const parts: string[] = []
        for (const v of values) {
          parts.push(`${v}`)
        }
        const joined = parts.join("")
        best[side] = least(best[side], monotonicNanos() - t0)
        s = foldText(joined)
      }
      sums[side] = (sums[side] * 31 + s) % 1000000007
    }
  }
  return report(names, best, sums)
}
