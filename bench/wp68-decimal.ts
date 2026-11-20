// WP68 S1 (docs/wp68-shared-libraries.md §4): the decimal writers std/ carries,
// and the template literal src/ writes numbers with, timed side by side, to
// pick the one a shared copy starts from, against a candidate that writes two
// digits a step from a table. A million values are written one after another
// into one output, and the program prints a checksum of that output, which
// must agree. Every round changes one value at a position that moves with the
// round, so no round's input is another's. Only the writing is timed; the
// checksum is read after the clock stops. The minimum of each side over the
// rounds is printed:
//
//   build/seed/bin/nish bench/wp68-decimal.ts --link build/wp68-decimal --profile speed
//   taskset -c 2 build/wp68-decimal
//
// Three inputs are timed, each with its own twin band and checksums:
//
// - "non-negative": `i32` values of every length from one digit to ten, what
//   the `http1` writers take. Every copy that writes such a value is a side,
//   whatever its type; `http1B` is `http1A` byte for byte, the noise band.
//   `compress` is `http1A`'s write with `httpDecimalDigits`
//   (std/net/http-compress.ts) as the count, the one thing that copy does.
//   The lengths are drawn, so a side's branch on the length mispredicts.
// - "status": the same sides over values of three digits only, 100 to 599,
//   the length a response's status code always has.
// - "signed": `i64` values of every length from one digit to nineteen, half of
//   them negative, with zero and the `i64` minimum: what `pgPutDecimal` and
//   `jsonWriterPutDigits64` take. `pgB` is `pgA` byte for byte, the noise
//   band. The `http1` copies and `jsonWriterPutDigits` take no such value, so
//   they are not sides here.
import { monotonicNanos } from "nish:process"
import { least, report } from "./wp68-report"

const ROUNDS: i32 = 9
const COUNT: i32 = 1048576
const MOVE: i32 = 5237
/** Twenty bytes a value at most: a sign and nineteen digits. */
const ROOM: i32 = COUNT * 20

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

/** `pgPut`'s twin, for the signed input's noise band. */
const pgPutTwin = (out: u8[], at: i32, value: i64, n: i32): i32 => {
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

/** `jsonWriterPutDigits64`, std/json.ts, with the cursor passed and returned: counted against powers of ten on `-|v|`. */
const json64 = (buf: u8[], at: i32, v: i64): i32 => {
  const ten: i64 = toI64(10)
  const negative: i64 = v < 0 ? v : -v
  let digits: i32 = 1
  let bound: i64 = -ten
  while (digits < 19 && negative <= bound) {
    digits += 1
    if (digits < 19) {
      bound = bound * ten
    }
  }
  const sign: i32 = v < 0 ? 1 : 0
  let rest: i64 = v
  const width: i32 = sign + digits
  if (at < 0 || at > toI32(buf.length) - width) {
    return -1
  }
  if (sign === 1) {
    buf[at] = toU8(45)
  }
  for (let k: i32 = at + width - 1; k >= at + sign && k >= 0 && k < toI32(buf.length); k -= 1) {
    const digit: i32 = toI32(rest % ten)
    buf[k] = toU8(48 + (digit < 0 ? -digit : digit))
    rest = rest / ten
  }
  return at + width
}

/** `http1ClientDigits`, std/net/http1-client-codec.ts. */
const clientDigits = (n: i64): i32 => {
  let digits: i32 = 1
  let v: i64 = n
  while (v >= toI64(10)) {
    v = v / toI64(10)
    digits += 1
  }
  return digits
}

/** `http1ClientPutDecimal`, std/net/http1-client-codec.ts, verbatim but for its name: `i64`, one digit a step. */
const client = (out: u8[], at: i32, n: i64): i32 => {
  const digits: i32 = clientDigits(n)
  let v: i64 = n
  for (let k: i32 = at + digits - 1; k >= at && k >= 0 && k < toI32(out.length); k -= 1) {
    out[k] = toU8(toI32(v % toI64(10)) + 48)
    v = v / toI64(10)
  }
  return at + digits
}

/** `httpDecimalDigits`, std/net/http-compress.ts: a count, one divide a digit. */
const compressDigits = (n: i32): i32 => {
  let digits: i32 = 1
  let rest: i32 = n
  while (rest >= 10) {
    rest = rest / 10
    digits += 1
  }
  return digits
}

/** `http1A`'s write with `compressDigits` as the count. */
const compress = (out: u8[], at: i32, n: i32): i32 => {
  const digits: i32 = compressDigits(n)
  let v: i32 = n
  for (let k: i32 = at + digits - 1; k >= at && k >= 0 && k < toI32(out.length); k -= 1) {
    const digit: i32 = v % 10
    out[k] = toU8(48 + digit)
    v = v / 10
  }
  return at + digits
}

/** The candidate for signed `i64`: `pgLength`'s count, then two digits a step in `u64` from `PAIRS`. */
const pairs64 = (out: u8[], at: i32, value: i64, n: i32): i32 => {
  if (!(at >= 0 && at < 2147483620 && n >= 1 && n <= 20 && at + n <= toI32(out.length))) {
    return -1
  }
  const first: i32 = value < 0 ? at + 1 : at
  let m: u64 = value < 0 ? toU64(0) - toU64(value) : toU64(value)
  let j: i32 = at + n - 2
  while (m >= 100 && j >= first && j >= 0 && j + 1 < toI32(out.length)) {
    const pair: i32 = toI32(m % 100) * 2
    out[j] = toU8(PAIRS.charCodeAt(pair))
    out[j + 1] = toU8(PAIRS.charCodeAt(pair + 1))
    m = m / 100
    j -= 2
  }
  const last: i32 = toI32(m)
  if (last >= 10 && j >= first && j >= 0 && j + 1 < toI32(out.length)) {
    out[j] = toU8(PAIRS.charCodeAt(last * 2))
    out[j + 1] = toU8(PAIRS.charCodeAt(last * 2 + 1))
  } else if (j + 1 >= first && j + 1 >= 0 && j + 1 < toI32(out.length)) {
    out[j + 1] = toU8(48 + last)
  }
  if (value < 0 && at < toI32(out.length)) {
    out[at] = toU8(45)
  }
  return at + n
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

/** A signed value of one to nineteen digits: 64 bits of `x` and `y` shifted right by 1 to 63 places, negated when `y` is odd. */
const drawnWide = (x: u32, y: u32): i64 => {
  const bits: u64 = (toU64(x) << toU64(32)) | toU64(y)
  const v: i64 = toI64(bits >> toU64(toU32(1) + ((y >> 3) % 63)))
  return (y & 1) === 1 ? -v : v
}

/**
 * Writes every value with byte side `side`; the end, or -1 when a writer
 * refused. The side is chosen once, outside the loop over the values.
 */
const writeAll = (out: u8[], values: i32[], side: i32): i32 => {
  let at: i32 = 0
  if (side === 0) {
    for (const v of values) {
      at = http1A(out, at, v)
    }
  } else if (side === 1) {
    for (const v of values) {
      at = http1B(out, at, v)
    }
  } else if (side === 2) {
    for (const v of values) {
      const wide: i64 = toI64(v)
      at = pgPut(out, at, wide, pgLength(wide))
      if (at < 0) {
        return -1
      }
    }
  } else if (side === 3) {
    for (const v of values) {
      at = jsonPut(out, at, v)
      if (at < 0) {
        return -1
      }
    }
  } else if (side === 4) {
    for (const v of values) {
      at = client(out, at, toI64(v))
    }
  } else if (side === 5) {
    for (const v of values) {
      at = compress(out, at, v)
    }
  } else {
    for (const v of values) {
      at = pairs(out, at, v)
    }
  }
  return at
}

/** As `writeAll`, for the signed `i64` values. */
const writeWide = (out: u8[], values: i64[], side: i32): i32 => {
  let at: i32 = 0
  if (side === 0) {
    for (const v of values) {
      at = pgPut(out, at, v, pgLength(v))
      if (at < 0) {
        return -1
      }
    }
  } else if (side === 1) {
    for (const v of values) {
      at = pgPutTwin(out, at, v, pgLength(v))
      if (at < 0) {
        return -1
      }
    }
  } else if (side === 2) {
    for (const v of values) {
      at = json64(out, at, v)
      if (at < 0) {
        return -1
      }
    }
  } else {
    for (const v of values) {
      at = pairs64(out, at, v, pgLength(v))
      if (at < 0) {
        return -1
      }
    }
  }
  return at
}

/**
 * A non-negative `i32` input: every side, the template literal last. With
 * `status`, every value is three digits, 100 to 599, as a response's status
 * line writes it, and a round's changed value stays three digits; otherwise
 * the lengths are drawn from one digit to ten.
 */
const measureNarrow = (out: u8[], status: boolean): i32 => {
  console.log(
    status
      ? "status: i32 values of three digits, 100 to 599"
      : "non-negative: i32 values of one to ten digits"
  )
  const values: i32[] = []
  let x: u32 = 2463534242
  for (let i = 0; i < COUNT; i++) {
    x ^= x << 13
    x ^= x >> 17
    x ^= x << 5
    values.push(status ? 100 + toI32(x % 500) : drawn(x))
  }
  const names: string[] = ["http1A", "http1B", "pg", "json", "client", "compress", "pairs", "template"]
  const best: i64[] = [-1, -1, -1, -1, -1, -1, -1, -1]
  const sums: i64[] = [0, 0, 0, 0, 0, 0, 0, 0]
  for (let round = 0; round < ROUNDS; round++) {
    const at: i32 = (round * MOVE) % COUNT
    if (at < 0 || at >= values.length) {
      return 1
    }
    values[at] = status ? 100 + ((round * 37) % 500) : round * 1000003
    // Each round starts at a different side, so no side always runs first.
    for (let k = 0; k < 8; k++) {
      const side: i32 = (round + k) % 8
      if (side < 0 || side >= best.length || side >= sums.length) {
        return 1
      }
      let s: i64 = 0
      const t0 = monotonicNanos()
      if (side < 7) {
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

/** The signed `i64` input, with zero and the `i64` minimum in it. */
const measureWide = (out: u8[]): i32 => {
  console.log("signed: i64 values of one to nineteen digits, half negative, with 0 and the i64 minimum")
  const values: i64[] = []
  let x: u32 = 2463534242
  for (let i = 0; i < COUNT; i++) {
    x ^= x << 13
    x ^= x >> 17
    x ^= x << 5
    const hi: u32 = x
    x ^= x << 13
    x ^= x >> 17
    x ^= x << 5
    values.push(drawnWide(hi, x))
  }
  if (values.length < 2) {
    return 1
  }
  // -2^63, built from 2^62 since the literal is past 2^53.
  const half: i64 = toI64(1) << toI64(62)
  values[0] = -half - half
  values[1] = toI64(0)
  const names: string[] = ["pgA", "pgB", "json64", "pairs64"]
  const best: i64[] = [-1, -1, -1, -1]
  const sums: i64[] = [0, 0, 0, 0]
  for (let round = 0; round < ROUNDS; round++) {
    const at: i32 = 2 + ((round * MOVE) % (COUNT - 2))
    if (at < 0 || at >= values.length) {
      return 1
    }
    values[at] = toI64(round * 1000003) * toI64(round % 2 === 0 ? 1000000007 : -1000000007)
    for (let k = 0; k < 4; k++) {
      const side: i32 = (round + k) % 4
      if (side < 0 || side >= best.length || side >= sums.length) {
        return 1
      }
      const t0 = monotonicNanos()
      const end: i32 = writeWide(out, values, side)
      best[side] = least(best[side], monotonicNanos() - t0)
      const s: i64 = fold(out, end)
      sums[side] = (sums[side] * 31 + s) % 1000000007
    }
  }
  return report(names, best, sums)
}

export const main = (): i32 => {
  const out = new Array<u8>(ROOM)
  const narrow = measureNarrow(out, false)
  const status = measureNarrow(out, true)
  const wide = measureWide(out)
  return narrow + status + wide
}
