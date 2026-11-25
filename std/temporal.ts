/**
 * `nish/temporal` — dates, times, instants and durations in the ISO 8601
 * calendar, under the names and the rules of TC39's `Temporal`
 * (`docs/wp64-temporal.md`).
 *
 *     import { PlainDate, Duration, plainDateFrom } from "nish/temporal";
 *
 *     export const main = (): i32 => {
 *       const due: PlainDate = plainDateFrom("2024-01-31");
 *       const next: PlainDate = due.add(new Duration(0, 1));   // 2024-02-29
 *       console.log(next.toString());
 *       console.log(due.until(next).toString());              // P29D
 *       return 0;
 *     };
 *
 * **Five types, each immutable.** `PlainDate`, `PlainTime` and `PlainDateTime`
 * are wall-clock values with no time zone; `Instant` is an exact point on the
 * UTC timeline; `Duration` is ten signed fields, `years` to `nanoseconds`.
 * Every method answers a new value. A field reads as Temporal's getter of the
 * same name does (`d.year`, `d.dayOfWeek`, `t.nanosecond`), and the string
 * forms are Temporal's byte for byte.
 *
 * **What is Temporal's and what is this module's.** A class here is the
 * Temporal class of the same name, and `plainDateFrom(s)` is
 * `Temporal.PlainDate.from(s)`, `plainDateCompare(a, b)` is
 * `Temporal.PlainDate.compare(a, b)`, and so on for each type: Nish has no
 * `static` members, so the class's statics are free functions named after it.
 * The arithmetic follows the specification's: `add` constrains a day past the
 * end of the month (`2024-01-31` plus a month is `2024-02-29`), `until` and
 * `since` answer the largest unit Temporal's default does (days for a date or a
 * date-time, hours for a time, seconds for an instant), and a string Temporal
 * refuses with a `RangeError` panics here with a message that starts
 * `RangeError:`. The `...OrNull` functions are this module's own: the same
 * parse, answering `null` instead.
 *
 * **What is not here yet** (`docs/wp64-temporal.md` §6): `ZonedDateTime` and
 * every time zone but UTC, `PlainYearMonth`, `PlainMonthDay`, the option
 * bags (`{ largestUnit: "year" }`, `with({ day: 1 })`, `round`, `total`),
 * calendars other than `iso8601`, `toLocaleString`, and `epochNanoseconds`,
 * which is a `bigint` in JavaScript. An `Instant` is any nanosecond in
 * Temporal's range of ±10^8 days from 1970, held as `i64` seconds and `i32`
 * nanoseconds; a `Duration`'s fields are `i64`, which is narrower than
 * Temporal's for microseconds and nanoseconds alone.
 *
 * **Private helpers carry the module's name** because they share the
 * importing program's flat symbol namespace (`docs/wp26-stdlib.md` §3e).
 */

import {
  addWrapping,
  asU8x16,
  mulWrapping,
  shr,
  shuffle,
  splatU16x8,
  store,
  subWrapping,
  u8x16,
  u16x8,
} from "nish:simd"

/** Nanoseconds in a second. */
const TEMPORAL_NS_PER_SECOND: i64 = 1000000000

/** Seconds in a day; a day is 24 hours in every type here, none of which has a zone. */
const TEMPORAL_SECONDS_PER_DAY: i64 = 86400

/** Nanoseconds in a day. */
const TEMPORAL_NS_PER_DAY: i64 = 86400000000000

/** The epoch day of +275760-09-13, the last date Temporal can represent. */
const TEMPORAL_MAX_EPOCH_DAY: i64 = 100000000

/** The epoch day of -271821-04-19, the first date Temporal can represent. */
const TEMPORAL_MIN_EPOCH_DAY: i64 = -100000001

/** The largest magnitude of a duration's normalized seconds: 2^53 - 1. */
const TEMPORAL_MAX_DURATION_SECONDS: i64 = 9007199254740991

/** The bound on `years`, `months` and `weeks`: 2^32, exclusive. */
const TEMPORAL_MAX_CALENDAR_FIELD: i64 = 4294967296

/** The units, smallest first, so that "larger" is `>`. */
const TEMPORAL_UNIT_NANOSECOND: i32 = 0
const TEMPORAL_UNIT_MICROSECOND: i32 = 1
const TEMPORAL_UNIT_MILLISECOND: i32 = 2
const TEMPORAL_UNIT_SECOND: i32 = 3
const TEMPORAL_UNIT_MINUTE: i32 = 4
const TEMPORAL_UNIT_HOUR: i32 = 5
const TEMPORAL_UNIT_DAY: i32 = 6
const TEMPORAL_UNIT_WEEK: i32 = 7
const TEMPORAL_UNIT_MONTH: i32 = 8
const TEMPORAL_UNIT_YEAR: i32 = 9

// ---------------------------------------------------------------------------
// Integer helpers. Every division here is written `toI64(a / b)` so that it
// truncates under Node exactly as the native `sdiv` does, and every value that
// is divided stays below 2^53 so that Node's doubles hold it exactly.
// ---------------------------------------------------------------------------

/** Panic with Temporal's `RangeError`, naming `what`. */
const temporalRangeError = (what: string): void => {
  panic(`RangeError: ${what}`)
}

// The checked sums. Each wraps in `u64`, where a sum cannot panic, and then
// tests the signs: `a + b` overflowed exactly when `a` and `b` share a sign the
// result lacks, and `a - b` exactly when `a` and `b` differ in sign and the
// result's sign is not `a`'s. Past the i64 range JavaScript's Temporal throws a
// `RangeError` long before, so these raise one too.

/** `a + b`, raising a `RangeError` where it leaves the i64 range. */
const temporalAdd = (a: i64, b: i64): i64 => {
  const r: i64 = toI64(toU64(a) + toU64(b))
  if (((a ^ r) & (b ^ r)) < 0) {
    temporalRangeError("the arithmetic leaves the integer range")
  }
  return r
}

/** `a - b`, raising a `RangeError` where it leaves the i64 range. */
const temporalSub = (a: i64, b: i64): i64 => {
  const r: i64 = toI64(toU64(a) - toU64(b))
  if (((a ^ b) & (a ^ r)) < 0) {
    temporalRangeError("the arithmetic leaves the integer range")
  }
  return r
}

/** `x` negated when `negative`, raising a `RangeError` where that leaves the i64 range. */
const temporalSigned = (x: i64, negative: boolean): i64 => (negative ? temporalSub(0, x) : x)

/** `a * k` for a factor `k` of at least 1, raising a `RangeError` where it leaves the i64 range. */
const temporalMul = (a: i64, k: i64): i64 => {
  const r: i64 = toI64(toU64(a) * toU64(k))
  if (k < 1 || r / k !== a) {
    temporalRangeError("the arithmetic leaves the integer range")
  }
  return r
}

// The divisions. Every divisor here is a constant from 2 to a day's
// nanoseconds, so the test that opens each is never true; it is what lets the
// compiler prove the quotient and the remainder cannot overflow.

/** The largest divisor any caller passes: the nanoseconds in a day. */
const TEMPORAL_MAX_DIVISOR: i64 = 86400000000000

/** `a / b` rounded toward negative infinity, for `2 <= b <= TEMPORAL_MAX_DIVISOR`. */
const temporalFloorDiv = (a: i64, b: i64): i64 => {
  if (b < 2 || b > TEMPORAL_MAX_DIVISOR) {
    temporalRangeError("a divisor outside 2 to a day's nanoseconds")
    return 0
  }
  const q: i64 = a / b
  return a % b < 0 ? temporalSub(q, 1) : q
}

/** `a` modulo `b` in `[0, b)`, for `2 <= b <= TEMPORAL_MAX_DIVISOR`. */
const temporalFloorMod = (a: i64, b: i64): i64 => {
  if (b < 2 || b > TEMPORAL_MAX_DIVISOR) {
    temporalRangeError("a divisor outside 2 to a day's nanoseconds")
    return 0
  }
  const r: i64 = a % b
  return r < 0 ? r + b : r
}

/** `a / b` rounded toward zero, for `2 <= b <= TEMPORAL_MAX_DIVISOR`. */
const temporalTruncDiv = (a: i64, b: i64): i64 => {
  if (b < 2 || b > TEMPORAL_MAX_DIVISOR) {
    temporalRangeError("a divisor outside 2 to a day's nanoseconds")
    return 0
  }
  return a / b
}

/** -1, 0 or 1 as `a` is negative, zero or positive. */
const temporalSign = (a: i64): i32 => {
  if (a < 0) {
    return -1
  }
  return a > 0 ? 1 : 0
}

// The writers. Every `toString` fills one byte buffer and makes one string of
// it, rather than joining a template's parts: each `${n}` and each join is an
// allocation and a copy, and they were a fifth of the time `toString` took.
// Each writer puts its text at `at` and answers the index just past it.

/** The most bytes any `toString` here writes: a `Duration` of ten 19-digit fields. */
const TEMPORAL_TEXT_MAX: i32 = 256

/** Write the ASCII byte `c` at `at`. */
const temporalPutByte = (out: u8[], at: i32, c: i32): i32 => {
  if (at < 0 || at >= toI32(out.length)) {
    return at
  }
  out[at] = toU8(c)
  return at + 1
}

/** Write `n`, which is not negative, in decimal; the digits that fall outside `out` are not written. */
const temporalPutNumber = (out: u8[], at: i32, n: i64): i32 => {
  let count: i32 = 1
  let rest: i64 = n
  // An i64 has at most nineteen digits.
  while (rest >= 10 && count < 19) {
    rest = rest / 10
    count = count + 1
  }
  // Two `i32`s summed in `i64` cannot overflow.
  const end: i64 = toI64(at) + toI64(count)
  let v: i64 = n
  for (let k: i32 = toI32(toI64(at) + toI64(count) - 1); k >= at && k >= 0 && k < toI32(out.length); k--) {
    out[k] = toU8(48) + toU8(v % 10)
    v = v / 10
  }
  return toI32(end)
}

// The fixed-width writers: a date or a time is always the same digits, so
// they are written two at a time, with one bounds test that covers both, and
// no count of digits first. `n / 10` of an `i32` is a multiply and a shift,
// and each digit is a `u8` sum, which wraps rather than checks.

/** Write `n`, 0 to 99, as two digits. */
const temporalPut2 = (out: u8[], at: i32, n: i32): i32 => {
  if (at < 0 || at > toI32(out.length) - 2) {
    return at
  }
  const u: u32 = toU32(n)
  const tens: u32 = u / 10
  out[at] = toU8(48 + tens)
  out[at + 1] = toU8(48 + u - tens * 10)
  return at + 2
}

/** Write `n`, 0 to 9999, as four digits. */
const temporalPut4 = (out: u8[], at: i32, n: i32): i32 => {
  const u: u32 = toU32(n)
  const high: u32 = u / 100
  return temporalPut2(out, temporalPut2(out, at, toI32(high)), toI32(u - high * 100))
}

/** Write a year as Temporal does: four digits for 0 to 9999, otherwise a sign and six digits. */
const temporalPutYear = (out: u8[], at: i32, year: i32): i32 => {
  if (year >= 0 && year <= 9999) {
    return temporalPut4(out, at, year)
  }
  // The negation wraps in `u32`, so it holds even for the least `i32`.
  const magnitude: u32 = year < 0 ? toU32(0) - toU32(year) : toU32(year)
  const signed: i32 = temporalPutByte(out, at, year < 0 ? 45 : 43)
  return temporalPut4(out, temporalPut2(out, signed, toI32(magnitude / 10000)), toI32(magnitude % 10000))
}

/**
 * Write `YYYY-MM-DD` for a year from 0 to 9999 in one vector store: the four
 * two-digit groups are lanes of a `u16x8`, each lane's tens are
 * `(v * 103) >> 10` (exact below 100), one shuffle interleaves the tens and
 * ones bytes with a zero byte where each `-` goes, and adding a template of
 * `0` and `-` makes the text. `out` must have 16 bytes from `at`; the store's
 * test is never false for a caller here.
 */
const temporalPutDate4 = (out: u8[], at: i32, year: i32, month: i32, day: i32): i32 => {
  const v: u16x8 = u16x8(
    toU16(year / 100),
    toU16(year % 100),
    toU16(month),
    toU16(day),
    toU16(0),
    toU16(0),
    toU16(0),
    toU16(0)
  )
  const tens: u16x8 = shr(mulWrapping(v, splatU16x8(toU16(103))), 10)
  const ones: u16x8 = subWrapping(v, mulWrapping(tens, splatU16x8(toU16(10))))
  // Byte 2k of a little-endian u16x8 is lane k's low byte; 8 is lane 4, a zero.
  const digits: u8x16 = shuffle(
    asU8x16(tens),
    asU8x16(ones),
    0,
    16,
    2,
    18,
    8,
    4,
    20,
    8,
    6,
    22,
    8,
    8,
    8,
    8,
    8,
    8
  )
  const template: u8x16 = u8x16(
    toU8(48),
    toU8(48),
    toU8(48),
    toU8(48),
    toU8(45),
    toU8(48),
    toU8(48),
    toU8(45),
    toU8(48),
    toU8(48),
    toU8(0),
    toU8(0),
    toU8(0),
    toU8(0),
    toU8(0),
    toU8(0)
  )
  // The text is built before the test: a call between the test and the store
  // would leave the prover without the test's bound.
  const text: u8x16 = addWrapping(digits, template)
  if (at >= 0 && at <= toI32(out.length) - 16) {
    store(text, out, at)
    return at + 10
  }
  return at
}

/**
 * Write `YYYY-MM-DDTHH:MM:SS` for a year from 0 to 9999 in two vector stores,
 * as `temporalPutDate4` writes a date: seven two-digit groups in one `u16x8`,
 * the first sixteen bytes of text from one shuffle and the last three from a
 * second. `out` must have 32 bytes from `at`; the bytes past the nineteenth
 * are zeros for the caller to write over. The test that opens it is never
 * true for a caller here, whose buffer is `TEMPORAL_TEXT_MAX` bytes.
 */
const temporalPutDateTime4 = (
  out: u8[],
  at: i32,
  year: i32,
  month: i32,
  day: i32,
  hour: i32,
  minute: i32,
  second: i32
): i32 => {
  if (at < 0 || at > toI32(out.length) - 32) {
    return at
  }
  const v: u16x8 = u16x8(
    toU16(year / 100),
    toU16(year % 100),
    toU16(month),
    toU16(day),
    toU16(hour),
    toU16(minute),
    toU16(second),
    toU16(0)
  )
  const tens: u16x8 = shr(mulWrapping(v, splatU16x8(toU16(103))), 10)
  const ones: u16x8 = subWrapping(v, mulWrapping(tens, splatU16x8(toU16(10))))
  const t: u8x16 = asU8x16(tens)
  const o: u8x16 = asU8x16(ones)
  // Byte 14 is lane 7's tens, a zero, where each separator goes.
  const head: u8x16 = shuffle(t, o, 0, 16, 2, 18, 14, 4, 20, 14, 6, 22, 14, 8, 24, 14, 10, 26)
  const tail: u8x16 = shuffle(t, o, 14, 12, 28, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14)
  const headText: u8x16 = u8x16(
    toU8(48),
    toU8(48),
    toU8(48),
    toU8(48),
    toU8(45),
    toU8(48),
    toU8(48),
    toU8(45),
    toU8(48),
    toU8(48),
    toU8(84),
    toU8(48),
    toU8(48),
    toU8(58),
    toU8(48),
    toU8(48)
  )
  const tailText: u8x16 = u8x16(
    toU8(58),
    toU8(48),
    toU8(48),
    toU8(0),
    toU8(0),
    toU8(0),
    toU8(0),
    toU8(0),
    toU8(0),
    toU8(0),
    toU8(0),
    toU8(0),
    toU8(0),
    toU8(0),
    toU8(0),
    toU8(0)
  )
  store(addWrapping(head, headText), out, at)
  store(addWrapping(tail, tailText), out, at + 16)
  return at + 19
}

/** Write `YYYY-MM-DD`. */
const temporalPutDate = (out: u8[], at: i32, year: i32, month: i32, day: i32): i32 => {
  let i: i32 = temporalPutYear(out, at, year)
  i = temporalPut2(out, temporalPutByte(out, i, 45), month)
  return temporalPut2(out, temporalPutByte(out, i, 45), day)
}

/**
 * Write `ns` nanoseconds of a second as Temporal's automatic precision does:
 * nothing for zero, otherwise a `.` and up to nine digits with the trailing
 * zeros dropped. All nine are written and the zeros then given back, which
 * is one pass rather than a division per zero first.
 */
const temporalPutFraction = (out: u8[], at: i32, ns: i32): i32 => {
  if (ns === 0) {
    return at
  }
  const rest: i32 = ns % 100000000
  let end: i32 = temporalPutByte(out, temporalPutByte(out, at, 46), 48 + ns / 100000000)
  end = temporalPut4(out, temporalPut4(out, end, rest / 10000), rest % 10000)
  // Give back the zeros after the first digit, `last` the byte before `end`.
  const first: i64 = toI64(at) + 1
  let last: i32 = toI32(toI64(end) - 1)
  while (toI64(last) > first && last >= 0 && last < toI32(out.length) && out[last] === 48) {
    last = last - 1
  }
  return toI32(toI64(last) + 1)
}

/** Write `HH:MM:SS` and the fraction of the second. */
const temporalPutTime = (out: u8[], at: i32, hour: i32, minute: i32, second: i32, sub: i32): i32 => {
  let i: i32 = temporalPut2(out, at, hour)
  i = temporalPut2(out, temporalPutByte(out, i, 58), minute)
  i = temporalPut2(out, temporalPutByte(out, i, 58), second)
  return temporalPutFraction(out, i, sub)
}

/** Write the time of day `ns` nanoseconds after midnight. */
const temporalPutNanoOfDay = (out: u8[], at: i32, ns: i64): i32 => {
  const secs: i32 = toI32(ns / TEMPORAL_NS_PER_SECOND)
  const minutes: i32 = toI32(secs / 60)
  return temporalPutTime(
    out,
    at,
    toI32(minutes / 60),
    minutes % 60,
    secs % 60,
    toI32(ns % TEMPORAL_NS_PER_SECOND)
  )
}

/** Write `n` and the designator `c`, as a duration field is written. */
const temporalPutField = (out: u8[], at: i32, n: i64, c: i32): i32 =>
  temporalPutByte(out, temporalPutNumber(out, at, n), c)

// ---------------------------------------------------------------------------
// The proleptic Gregorian calendar (Hinnant, "chrono-Compatible Low-Level Date
// Algorithms": days_from_civil and civil_from_days over 400-year eras).
// ---------------------------------------------------------------------------

/** Whether `year` is a leap year of the proleptic Gregorian calendar. */
const temporalIsLeapYear = (year: i64): boolean => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)

/** The days in `month` (1 to 12) of `year`. */
const temporalDaysInMonth = (year: i64, month: i32): i32 =>
  temporalMonthLength(month, month === 2 && temporalIsLeapYear(year))

/** The days in `month` (1 to 12) of a year that is a leap year when `leap`. */
const temporalMonthLength = (month: i32, leap: boolean): i32 => {
  if (month === 2) {
    return leap ? 29 : 28
  }
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30
  }
  return 31
}

/** The days of a common year before the first of each month. */
const TEMPORAL_DAYS_BEFORE_MONTH: readonly i32[] = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

/** The month as Temporal codes it, `M01` to `M12`, without building a string. */
const temporalMonthCode = (month: i32): string => {
  switch (month) {
    case 1:
      return "M01"
    case 2:
      return "M02"
    case 3:
      return "M03"
    case 4:
      return "M04"
    case 5:
      return "M05"
    case 6:
      return "M06"
    case 7:
      return "M07"
    case 8:
      return "M08"
    case 9:
      return "M09"
    case 10:
      return "M10"
    case 11:
      return "M11"
    default:
      return "M12"
  }
}

/**
 * The days from 1970-01-01 to the given date, negative before it. Every
 * caller has checked the date, so the test is never true for one here; it is
 * what bounds each term below. The years count from 1 March of the year
 * 400,000 years before 0, a whole number of 400-year eras, so every term is
 * nonnegative and the divisions need no floor.
 */
const temporalEpochDay = (year: i32, month: i32, day: i32): i64 => {
  const shifted: i64 = toI64(year) + 399999
  if (shifted < 0 || shifted > 799999 || month < 1 || month > 12 || day < 1 || day > 31) {
    temporalRangeError("PlainDate: the fields are not a date")
    return 0
  }
  const m9: i64 = toI64(month) + 9
  const y: i64 = shifted + m9 / 12
  const yoe: i64 = y % 400
  const doy: i64 = (toI64(153) * (m9 % 12) + 2) / 5 + toI64(day) - 1
  // 146,816,468 is the 1,000 eras' 146,097,000 days plus the 719,468 from
  // 0000-03-01 to 1970-01-01.
  return (y / 400) * 146097 + yoe * 365 + yoe / 4 + doy - yoe / 100 - 146816468
}

/** The days from 1 January to the given date, plus one, in a year that is a leap year when `leap`. */
const temporalDayOfYear = (month: i32, day: i32, leap: boolean): i32 => {
  const before: i32 = month >= 1 && month <= 12 ? TEMPORAL_DAYS_BEFORE_MONTH[month - 1] : 0
  // A checked day is below 32, so the `u32` sum is exact.
  return toI32(toU32(before) + toU32(day) + (leap && month > 2 ? 1 : 0))
}

/**
 * The ISO weekday of an epoch day in Temporal's range: 1 for Monday to 7 for
 * Sunday. The day counts from 1,000 eras before 0000-03-01, a nonnegative `u64`
 * there, and 146,816,470 days is 3 more than a whole number of weeks, which
 * puts 1970-01-01, a Thursday, on 4.
 */
const temporalDayOfWeek = (epochDay: i64): i32 => toI32(((toU64(epochDay) + 146816470) % 7) + 1)

/** How many ISO weeks `year` has: 53 when it starts on a Thursday, or is a leap year starting on a Wednesday. */
const temporalWeeksInYear = (year: i32): i32 =>
  temporalWeekdayOfDecember31(toI64(year)) === 4 || temporalWeekdayOfDecember31(toI64(year) - 1) === 3
    ? 53
    : 52

/**
 * The weekday of 31 December of `y`, a year in Temporal's range, 0 for Sunday
 * to 6 for Saturday. The year counts from 400,000 years before 0, a
 * nonnegative `u64` there; the shift adds 497,000 days, a whole number of
 * weeks, so the weekday is unchanged.
 */
const temporalWeekdayOfDecember31 = (y: i64): i64 => {
  const ys: u64 = toU64(y) + 400000
  return toI64((ys + ys / 4 - ys / 100 + ys / 400) % 7)
}

/** Panic unless `year`, `month` and `day` name a real date. */
const temporalCheckDate = (what: string, year: i64, month: i64, day: i64): void => {
  if (year < -271821 || year > 275760) {
    temporalRangeError(`${what}: year ${year} is outside -271821 to 275760`)
  }
  if (month < 1 || month > 12) {
    temporalRangeError(`${what}: month ${month} is outside 1 to 12`)
  }
  const most: i32 = temporalDaysInMonth(year, toI32(month))
  if (day < 1 || day > toI64(most)) {
    temporalRangeError(`${what}: day ${day} is outside 1 to ${most}`)
  }
}

/** Panic unless the fields name a time of day. */
const temporalCheckTime = (
  what: string,
  hour: i64,
  minute: i64,
  second: i64,
  millisecond: i64,
  microsecond: i64,
  nanosecond: i64
): void => {
  if (hour < 0 || hour > 23) {
    temporalRangeError(`${what}: hour ${hour} is outside 0 to 23`)
  }
  if (minute < 0 || minute > 59) {
    temporalRangeError(`${what}: minute ${minute} is outside 0 to 59`)
  }
  if (second < 0 || second > 59) {
    temporalRangeError(`${what}: second ${second} is outside 0 to 59`)
  }
  if (millisecond < 0 || millisecond > 999) {
    temporalRangeError(`${what}: millisecond ${millisecond} is outside 0 to 999`)
  }
  if (microsecond < 0 || microsecond > 999) {
    temporalRangeError(`${what}: microsecond ${microsecond} is outside 0 to 999`)
  }
  if (nanosecond < 0 || nanosecond > 999) {
    temporalRangeError(`${what}: nanosecond ${nanosecond} is outside 0 to 999`)
  }
}

/**
 * The nanoseconds since midnight of a time of day. Every caller has checked
 * the fields, so the test is never true for one here; it is what bounds the
 * sum.
 */
const temporalNanoOfDay = (
  hour: i32,
  minute: i32,
  second: i32,
  millisecond: i32,
  microsecond: i32,
  nanosecond: i32
): i64 => {
  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59 ||
    millisecond < 0 ||
    millisecond > 999 ||
    microsecond < 0 ||
    microsecond > 999 ||
    nanosecond < 0 ||
    nanosecond > 999
  ) {
    temporalRangeError("PlainTime: a field is outside its range")
    return 0
  }
  return (
    (toI64(hour) * 3600 + toI64(minute) * 60 + toI64(second)) * TEMPORAL_NS_PER_SECOND +
    toI64(millisecond) * 1000000 +
    toI64(microsecond) * 1000 +
    toI64(nanosecond)
  )
}

/** A date on an epoch day, after checking the day is inside Temporal's range. */
const temporalDateOfEpochDay = (epochDay: i64): PlainDate => {
  if (epochDay < TEMPORAL_MIN_EPOCH_DAY || epochDay > TEMPORAL_MAX_EPOCH_DAY) {
    temporalRangeError("PlainDate: the date is outside Temporal's range")
  }
  const civil: i64 = temporalCivilOfEpochDay(epochDay)
  return new PlainDate(temporalCivilYear(civil), temporalCivilMonth(civil), temporalCivilDay(civil))
}

/**
 * The year, month and day of an epoch day, packed into one integer so that
 * nothing is allocated: `(year + 400000) * 512 + month * 32 + day`, which
 * stays below 2^31 over Temporal's whole range. `temporalCivilYear`,
 * `temporalCivilMonth` and `temporalCivilDay` take it apart. Every caller has
 * checked the day is in that range, so the test is never true for one here.
 * The days count from 0000-03-01 less 1,000 eras of 400 years, so every term
 * is a nonnegative `u64` below 2^28 and the arithmetic is exact.
 */
const temporalCivilOfEpochDay = (epochDay: i64): i64 => {
  const z: u64 = toU64(epochDay) + 146816468
  if (z < 46816467 || z > 246816468) {
    temporalRangeError("PlainDate: the date is outside Temporal's range")
    return 0
  }
  const doe: u64 = z % 146097
  const yoe: u64 = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
  const doy: u64 = doe - (yoe * 365 + yoe / 4 - yoe / 100)
  const mp: u64 = (doy * 5 + 2) / 153
  const day: u64 = doy + 1 - (mp * 153 + 2) / 5
  const month: u64 = mp < 10 ? mp + 3 : mp - 9
  const year: u64 = (z / 146097) * 400 + yoe + (month <= 2 ? 1 : 0)
  return toI64(year * 512 + month * 32 + day)
}

/** The year of a packed civil date: the packed year less 400,000, which `u32` holds and `i32` reads back exactly. */
const temporalCivilYear = (civil: i64): i32 => toI32(toU32(toI64(civil / 512)) - 400000)

/** The month of a packed civil date. */
const temporalCivilMonth = (civil: i64): i32 => toI32(toI64(civil / 32) % 16)

/** The day of a packed civil date. */
const temporalCivilDay = (civil: i64): i32 => toI32(civil % 32)

/** The time of day `ns` nanoseconds after midnight, `0 <= ns < 86,400 s`. */
const temporalTimeOfNanos = (ns: i64): PlainTime => {
  const sub: i64 = temporalFloorMod(ns, TEMPORAL_NS_PER_SECOND)
  const secs: i64 = temporalFloorDiv(ns, TEMPORAL_NS_PER_SECOND)
  return new PlainTime(
    toI32(temporalTruncDiv(secs, 3600)),
    toI32(temporalTruncDiv(secs, 60) % 60),
    toI32(secs % 60),
    toI32(temporalTruncDiv(sub, 1000000)),
    toI32(temporalTruncDiv(sub, 1000) % 1000),
    toI32(sub % 1000)
  )
}

// ---------------------------------------------------------------------------
// Time spans: a signed length of time as whole seconds and a nanosecond
// remainder in [0, 10^9), which holds Temporal's whole range without the 83
// bits one nanosecond count would need.
// ---------------------------------------------------------------------------

/** @internal A signed length of time, `seconds + nanos / 10^9`; not part of Temporal. */
class TemporalSpan {
  /** Whole seconds, rounded toward negative infinity. */
  readonly seconds: i64
  /** The nanoseconds past `seconds`, `0 <= nanos < 10^9`. */
  readonly nanos: i32

  /**
   * A span of `seconds` and `nanos`, normalized so that `nanos` is in range.
   *
   * @param seconds whole seconds
   * @param nanos nanoseconds to add, of any sign and size below 2^53
   */
  constructor(seconds: i64, nanos: i64) {
    this.seconds = temporalAdd(seconds, temporalFloorDiv(nanos, TEMPORAL_NS_PER_SECOND))
    this.nanos = toI32(temporalFloorMod(nanos, TEMPORAL_NS_PER_SECOND))
  }

  /**
   * This span plus `other`.
   *
   * @param other the span to add
   * @returns the sum
   */
  plus(other: TemporalSpan): TemporalSpan {
    return new TemporalSpan(temporalAdd(this.seconds, other.seconds), toI64(this.nanos) + toI64(other.nanos))
  }

  /**
   * This span negated.
   *
   * @returns the span of the same length in the other direction
   */
  negated(): TemporalSpan {
    return new TemporalSpan(temporalSub(0, this.seconds), -toI64(this.nanos))
  }

  /**
   * -1, 0 or 1 as the span is negative, zero or positive.
   *
   * @returns the sign
   */
  sign(): i32 {
    if (this.seconds < 0) {
      return -1
    }
    return this.seconds > 0 || this.nanos > 0 ? 1 : 0
  }

  /**
   * How many whole days the span holds, rounded toward zero.
   *
   * @returns the days, with the span's sign
   */
  truncDays(): i64 {
    if (this.sign() >= 0) {
      return temporalFloorDiv(this.seconds, TEMPORAL_SECONDS_PER_DAY)
    }
    const magnitude: TemporalSpan = this.negated()
    return temporalSub(0, temporalFloorDiv(magnitude.seconds, TEMPORAL_SECONDS_PER_DAY))
  }
}

/** The time fields of `d` as one span; its days too, each 24 hours, when `withDays`. */
const temporalSpanOfDuration = (d: Duration, withDays: boolean): TemporalSpan =>
  new TemporalSpan(temporalDurationSeconds(d, withDays), temporalDurationNanos(d))

/**
 * The whole seconds of `d`'s time fields, and of its days when `withDays`,
 * with each sub-second field's whole seconds; `temporalDurationNanos` is the
 * rest. Arithmetic on the fields, so that nothing is allocated: the sum stays
 * below 2^53 for every valid duration.
 */
const temporalDurationSeconds = (d: Duration, withDays: boolean): i64 => {
  let seconds: i64 = temporalAdd(
    temporalAdd(temporalMul(d.hours, 3600), temporalMul(d.minutes, 60)),
    d.seconds
  )
  if (withDays) {
    seconds = temporalAdd(seconds, temporalMul(d.days, TEMPORAL_SECONDS_PER_DAY))
  }
  if (d.milliseconds !== 0) {
    seconds = temporalAdd(seconds, temporalFloorDiv(d.milliseconds, 1000))
  }
  if (d.microseconds !== 0) {
    seconds = temporalAdd(seconds, temporalFloorDiv(d.microseconds, 1000000))
  }
  if (d.nanoseconds !== 0) {
    seconds = temporalAdd(seconds, temporalFloorDiv(d.nanoseconds, TEMPORAL_NS_PER_SECOND))
  }
  return seconds
}

/** The nanoseconds `temporalDurationSeconds` leaves out, each field's in `[0, 10^9)`, so below 3 × 10^9. */
const temporalDurationNanos = (d: Duration): i64 => {
  // Each remainder is below 10^9, so the `u64` sum is exact.
  let nanos: u64 = 0
  if (d.milliseconds !== 0) {
    nanos = toU64(temporalFloorMod(d.milliseconds, 1000)) * 1000000
  }
  if (d.microseconds !== 0) {
    nanos = nanos + toU64(temporalFloorMod(d.microseconds, 1000000)) * 1000
  }
  if (d.nanoseconds !== 0) {
    nanos = nanos + toU64(temporalFloorMod(d.nanoseconds, TEMPORAL_NS_PER_SECOND))
  }
  return toI64(nanos)
}

/** Whether every time field of `d`, hours to nanoseconds, is zero. */
const temporalNoTime = (d: Duration): boolean =>
  d.hours === 0 &&
  d.minutes === 0 &&
  d.seconds === 0 &&
  d.milliseconds === 0 &&
  d.microseconds === 0 &&
  d.nanoseconds === 0

/**
 * The epoch day `(year, month, day)` lands on after `years` and `months`,
 * with the day constrained to the new month, then `days` more; `epochDay` is
 * where it starts, used as it is when there are no years or months. Panics
 * with a `RangeError` outside Temporal's range.
 */
const temporalAddToDate = (
  year0: i32,
  month0: i32,
  day0: i32,
  epochDay: i64,
  years: i64,
  months: i64,
  days: i64
): i64 => {
  let start: i64 = epochDay
  if (years !== 0 || months !== 0) {
    const month1: i64 = temporalSub(temporalAdd(toI64(month0), months), 1)
    const year: i64 = temporalAdd(temporalAdd(toI64(year0), years), temporalFloorDiv(month1, 12))
    // The remainder is in [0, 12), so the `u64` sum is exact.
    const month: i64 = toI64(toU64(temporalFloorMod(month1, 12)) + 1)
    if (year < -271821 || year > 275760) {
      temporalRangeError("PlainDate: the date is outside Temporal's range")
      return 0
    }
    const most: i32 = temporalDaysInMonth(year, toI32(month))
    start = temporalEpochDay(toI32(year), toI32(month), day0 > most ? most : day0)
  }
  const result: i64 = temporalAdd(start, days)
  if (result < TEMPORAL_MIN_EPOCH_DAY || result > TEMPORAL_MAX_EPOCH_DAY) {
    temporalRangeError("PlainDate: the date is outside Temporal's range")
  }
  return result
}

/**
 * `span` as a duration whose largest field is `largest` (a day at most), as
 * Temporal's BalanceTimeDuration writes one: every field has the span's sign.
 */
const temporalBalance = (span: TemporalSpan, largest: i32): Duration => {
  const sign: i32 = span.sign()
  const m: TemporalSpan = sign < 0 ? span.negated() : span
  const s: i64 = m.seconds
  const n: i64 = toI64(m.nanos)
  let days: i64 = 0
  let hours: i64 = 0
  let minutes: i64 = 0
  let seconds: i64 = 0
  let ms: i64 = temporalTruncDiv(n, 1000000)
  let us: i64 = temporalTruncDiv(n, 1000) % 1000
  let ns: i64 = n % 1000
  if (largest >= TEMPORAL_UNIT_DAY) {
    days = temporalTruncDiv(s, TEMPORAL_SECONDS_PER_DAY)
    hours = temporalTruncDiv(s, 3600) % 24
    minutes = temporalTruncDiv(s, 60) % 60
    seconds = s % 60
  } else if (largest === TEMPORAL_UNIT_HOUR) {
    hours = temporalTruncDiv(s, 3600)
    minutes = temporalTruncDiv(s, 60) % 60
    seconds = s % 60
  } else if (largest === TEMPORAL_UNIT_MINUTE) {
    minutes = temporalTruncDiv(s, 60)
    seconds = s % 60
  } else if (largest === TEMPORAL_UNIT_SECOND) {
    seconds = s
  } else {
    // A sub-second largest unit: the whole count in that unit must fit an i64.
    let limit: i64 = 9007199
    if (largest === TEMPORAL_UNIT_MILLISECOND) {
      limit = 9007199254740
    } else if (largest === TEMPORAL_UNIT_MICROSECOND) {
      limit = 9007199254
    }
    if (s > limit) {
      temporalRangeError("Duration: the length does not fit this module's i64 fields in that unit")
    }
    if (largest === TEMPORAL_UNIT_MILLISECOND) {
      ms = temporalAdd(temporalMul(s, 1000), ms)
    } else if (largest === TEMPORAL_UNIT_MICROSECOND) {
      us = temporalAdd(temporalAdd(temporalMul(s, 1000000), temporalMul(ms, 1000)), us)
      ms = 0
    } else {
      ns = temporalAdd(
        temporalAdd(temporalAdd(temporalMul(s, 1000000000), temporalMul(ms, 1000000)), temporalMul(us, 1000)),
        ns
      )
      ms = 0
      us = 0
    }
  }
  const neg: boolean = sign < 0
  return new Duration(
    0,
    0,
    0,
    temporalSigned(days, neg),
    temporalSigned(hours, neg),
    temporalSigned(minutes, neg),
    temporalSigned(seconds, neg),
    temporalSigned(ms, neg),
    temporalSigned(us, neg),
    temporalSigned(ns, neg)
  )
}

// ---------------------------------------------------------------------------
// The string reader: RFC 9557 date-times (ISO 8601 with RFC 3339's offsets and
// bracketed annotations) and ISO 8601 durations, as Temporal's grammar reads
// them.
// ---------------------------------------------------------------------------

/** @internal One parse of a Temporal string; `ok` is false once anything is wrong. Not part of Temporal. */
class TemporalReader {
  /** The text being read. */
  readonly text: string
  /** The offset's nanoseconds east of UTC, when `hasOffset`. */
  offsetNanos: i64
  /** The index of the next character. */
  at: i32
  /** The date's fields, when `hasDate`. */
  year: i32
  month: i32
  day: i32
  /** The time's fields, when `hasTime`; midnight otherwise. */
  hour: i32
  minute: i32
  second: i32
  /** The nanoseconds past `second`. */
  fraction: i32
  /** Whether the text has parsed so far. */
  ok: boolean
  /** Whether a date was read. */
  hasDate: boolean
  /** Whether a time was read. */
  hasTime: boolean
  /** Whether a `Z` was read in the offset's place. */
  utc: boolean
  /** Whether a numeric offset was read. */
  hasOffset: boolean
  /** Whether a bracketed time zone annotation was read. */
  hasZone: boolean
  /** Whether the string's calendar, if it names one, is `iso8601`. */
  isoCalendar: boolean

  /**
   * A reader at the start of `text`.
   *
   * @param text the string to read
   */
  constructor(text: string) {
    this.text = text
    this.at = 0
    this.ok = true
    this.hasDate = false
    this.year = 0
    this.month = 1
    this.day = 1
    this.hasTime = false
    this.hour = 0
    this.minute = 0
    this.second = 0
    this.fraction = 0
    this.utc = false
    this.hasOffset = false
    this.offsetNanos = 0
    this.hasZone = false
    this.isoCalendar = true
  }

  /**
   * The character code at `at + ahead`, or -1 past the end.
   *
   * @param ahead how far past `at` to look, 0 or 1
   * @returns the code
   */
  peek(ahead: i32): i32 {
    const i: i32 = this.at
    if (i < 0 || i >= toI32(this.text.length)) {
      return -1
    }
    if (ahead === 0) {
      return toI32(this.text.charCodeAt(i))
    }
    if (ahead !== 1 || i >= toI32(this.text.length) - 1) {
      return -1 // the reader looks at most one character ahead
    }
    return toI32(this.text.charCodeAt(i + 1))
  }

  /** Move `at` one character on; at the end it stays there, and every caller has just seen a character. */
  step(): void {
    const i: i32 = this.at
    if (i >= 0 && i < toI32(this.text.length)) {
      this.at = i + 1
    }
  }

  /**
   * Whether the character `ahead` past `at` is a decimal digit.
   *
   * @param ahead how far past `at` to look, 0 or 1
   * @returns whether it is one
   */
  digitAt(ahead: i32): boolean {
    const c: i32 = this.peek(ahead)
    return c >= 48 && c <= 57
  }

  /**
   * Whether every character has been read.
   *
   * @returns whether the reader is at the end
   */
  done(): boolean {
    return this.at >= toI32(this.text.length)
  }

  /**
   * Consume `c` if it is next.
   *
   * @param c the character code
   * @returns whether it was there
   */
  eat(c: i32): boolean {
    if (this.peek(toI32(0)) === c) {
      this.step()
      return true
    }
    return false
  }

  /**
   * Read exactly `count` digits as a number, or mark the parse failed.
   *
   * @param count how many digits
   * @returns their value, or 0 on failure
   */
  digits(count: i32): i32 {
    // At most six digits, so the u32 sum never wraps.
    let value: u32 = 0
    for (let i: i32 = 0; i < count; i++) {
      const c: i32 = this.peek(toI32(0))
      if (c < 48 || c > 57) {
        this.ok = false
        return 0
      }
      value = value * 10 + toU32(c - 48)
      this.step()
    }
    return toI32(value)
  }

  /**
   * Read a `.` or `,` and one to nine digits as nanoseconds, if one is next.
   *
   * @returns the nanoseconds the fraction names, or 0 when there is none
   */
  fractionDigits(): i32 {
    const c: i32 = this.peek(toI32(0))
    if ((c !== 46 && c !== 44) || !this.digitAt(toI32(1))) {
      return 0
    }
    this.step()
    // At most nine digits, so the u32 sum never wraps.
    let value: u32 = 0
    let count: i32 = 0
    while (this.digitAt(toI32(0))) {
      if (count >= 9) {
        this.ok = false
        return 0
      }
      value = value * 10 + toU32(this.peek(toI32(0))) - 48
      count = count + 1
      this.step()
    }
    while (count < 9) {
      value = value * 10
      count = count + 1
    }
    return toI32(value)
  }

  /** Read a date: `YYYY-MM-DD`, `±YYYYYY-MM-DD`, or either without the dashes. */
  readDate(): void {
    const sign: i32 = this.peek(toI32(0))
    let year: i32 = 0
    if (sign === 43 || sign === 45) {
      this.step()
      year = this.digits(toI32(6))
      if (sign !== 43 && year === 0) {
        this.ok = false // -000000 is not a year
      }
      if (sign !== 43) {
        year = toI32(0 - toI64(year))
      }
    } else {
      year = this.digits(toI32(4))
    }
    const extended: boolean = this.eat(toI32(45))
    const month: i32 = this.digits(toI32(2))
    if (extended && !this.eat(toI32(45))) {
      this.ok = false
    }
    const day: i32 = this.digits(toI32(2))
    if (!this.ok) {
      return
    }
    if (month < 1 || month > 12 || day < 1 || day > temporalDaysInMonth(toI64(year), month)) {
      this.ok = false
      return
    }
    this.hasDate = true
    this.year = year
    this.month = month
    this.day = day
  }

  /** Read a time: `HH`, `HH:MM`, `HH:MM:SS[.f]`, or the same without colons. */
  readTime(): void {
    this.hour = this.digits(toI32(2))
    if (this.digitAt(toI32(0)) || this.peek(toI32(0)) === 58) {
      const extended: boolean = this.eat(toI32(58))
      this.minute = this.digits(toI32(2))
      if ((extended && this.peek(toI32(0)) === 58) || (!extended && this.digitAt(toI32(0)))) {
        if (extended) {
          this.step()
        }
        this.second = this.digits(toI32(2))
        this.fraction = this.fractionDigits()
      }
    }
    if (this.second === 60) {
      this.second = 59 // a leap second reads as the second before it
    }
    if (this.hour > 23 || this.minute > 59 || this.second > 59) {
      this.ok = false
    }
    this.hasTime = this.ok
  }

  /** Read `Z`, or a `±HH[:MM[:SS[.f]]]` offset, if one is next. */
  readOffset(): void {
    const c: i32 = this.peek(toI32(0))
    if (c === 90 || c === 122) {
      this.step()
      this.utc = true
      return
    }
    if (c !== 43 && c !== 45) {
      return
    }
    this.step()
    const hours: i32 = this.digits(toI32(2))
    let minutes: i32 = 0
    let seconds: i32 = 0
    let fraction: i32 = 0
    if (this.digitAt(toI32(0)) || this.peek(toI32(0)) === 58) {
      const extended: boolean = this.eat(toI32(58))
      minutes = this.digits(toI32(2))
      if ((extended && this.peek(toI32(0)) === 58) || (!extended && this.digitAt(toI32(0)))) {
        if (extended) {
          this.step()
        }
        seconds = this.digits(toI32(2))
        fraction = this.fractionDigits()
      }
    }
    if (hours > 23 || minutes > 59 || seconds > 59) {
      this.ok = false
      return
    }
    // Every field is a small count of digits here, so the u64 sum never wraps.
    const total: u64 =
      (toU64(hours) * 3600 + toU64(minutes) * 60 + toU64(seconds)) * 1000000000 + toU64(fraction)
    this.hasOffset = true
    this.offsetNanos = c === 43 ? toI64(total) : toI64(0 - total)
  }

  /**
   * Read the bracketed annotations: at most one time zone, first, then
   * `key=value` pairs, each spelled as the grammar spells them. Two calendars
   * where either is critical, and an unknown critical key, fail the parse; a
   * calendar other than `iso8601` only clears `isoCalendar`, for the types
   * that hold a calendar to refuse.
   */
  readAnnotations(): void {
    let calendars: i32 = 0
    let criticalCalendar: boolean = false
    let first: boolean = true
    while (this.ok && this.eat(toI32(91))) {
      const critical: boolean = this.eat(toI32(33))
      const start: i32 = this.at
      while (!this.done() && this.peek(toI32(0)) !== 93) {
        this.step()
      }
      if (this.done() || this.at === start) {
        this.ok = false
        return
      }
      // The annotation is `text[start, end)`, read in place: a substring per
      // pass would be kept until the caller's memory is released (NL9018).
      const end: i32 = this.at
      this.step()
      let eq: i32 = start
      while (eq < end && temporalCharAt(this.text, eq) !== 61) {
        eq = eq + 1
      }
      if (eq >= end) {
        // A time zone: only first, only once, and spelled as the grammar's
        // TimeZoneIdentifier. Whether the zone exists is not asked: no type
        // here holds one.
        if (!first || !temporalIsTimeZoneName(this.text, start, end)) {
          this.ok = false
          return
        }
        this.hasZone = true
      } else {
        const text: string = this.text
        if (!temporalIsAnnotationKey(text, start, eq) || !temporalIsAnnotationValue(text, eq + 1, end)) {
          this.ok = false
          return
        }
        if (temporalRangeIs(text, start, eq, "u-ca")) {
          if (calendars < 2) {
            calendars = calendars + 1 // only none, one or more than one matters
          }
          criticalCalendar = criticalCalendar || critical
          // The first calendar is the string's; only a type that holds a
          // calendar refuses one other than iso8601 (`isoCalendar`).
          if (calendars === 1) {
            this.isoCalendar = temporalRangeIs(text, eq + 1, end, "iso8601")
          }
        } else if (critical) {
          this.ok = false
          return
        }
      }
      first = false
    }
    if (calendars > 1 && criticalCalendar) {
      this.ok = false
    }
  }

  /**
   * Read a whole date-time string: a date, then optionally `T`, `t` or a space
   * and a time, an offset, and annotations, to the end of the text.
   */
  readDateTime(): void {
    this.readDate()
    if (!this.ok) {
      return
    }
    const c: i32 = this.peek(toI32(0))
    if ((c === 84 || c === 116 || c === 32) && this.digitAt(toI32(1))) {
      this.step()
      this.readTime()
      if (this.ok) {
        this.readOffset()
      }
    }
    if (this.ok) {
      this.readAnnotations()
    }
    if (!this.done()) {
      this.ok = false
    }
  }
}

// The annotation checks read `text[from, to)` in place, so that reading
// annotations allocates nothing.

/** Whether `text[from, to)` is an annotation key: a lowercase letter or `_`, then lowercase letters, digits, `_` or `-`. */
const temporalIsAnnotationKey = (text: string, from: i32, to: i32): boolean => {
  if (to <= from) {
    return false
  }
  for (let i: i32 = from; i < to; i++) {
    const c: i32 = temporalCharAt(text, i)
    const letter: boolean = (c >= 97 && c <= 122) || c === 95
    if (!letter && (i === from || !((c >= 48 && c <= 57) || c === 45))) {
      return false
    }
  }
  return true
}

/** Whether `c` is an ASCII letter or digit. */
const temporalIsAlphaNumeric = (c: i32): boolean =>
  (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)

/** Whether `text[from, to)` is an annotation value: runs of ASCII letters and digits joined by single `-`. */
const temporalIsAnnotationValue = (text: string, from: i32, to: i32): boolean => {
  let inRun: boolean = false
  for (let i: i32 = from; i < to; i++) {
    const c: i32 = temporalCharAt(text, i)
    if (temporalIsAlphaNumeric(c)) {
      inRun = true
    } else if (c === 45 && inRun) {
      inRun = false
    } else {
      return false
    }
  }
  return inRun
}

/**
 * Whether `text[from, to)` is a TimeZoneIdentifier by Temporal's grammar: an
 * offset, `±HH`, `±HHMM` or `±HH:MM`, or names joined by `/`, each starting
 * with a letter, `.` or `_` and going on in letters, digits, `.`, `_`, `-` or
 * `+`.
 */
const temporalIsTimeZoneName = (text: string, from: i32, to: i32): boolean => {
  if (from < 0 || from >= to) {
    return false
  }
  const n: i64 = toI64(to) - toI64(from)
  const first: i32 = temporalCharAt(text, from)
  if (first === 43 || first === 45) {
    const hours: i32 = temporalFastTwo(text, from + 1)
    if (hours < 0 || hours > 23) {
      return false
    }
    if (n === 3) {
      return true
    }
    // `±HHMM`, or `±HH:MM` with the colon; positions are summed in i64,
    // which `from + 4` cannot leave.
    const colon: boolean = n === 6 && temporalCharAt(text, toI32(toI64(from) + 3)) === 58
    if (n !== 5 && !colon) {
      return false
    }
    const minutes: i32 = temporalFastTwo(text, toI32(colon ? toI64(from) + 4 : toI64(from) + 3))
    return minutes >= 0 && minutes <= 59
  }
  let empty: boolean = true
  for (let i: i32 = from; i < to; i++) {
    const c: i32 = temporalCharAt(text, i)
    if (c === 47) {
      if (empty) {
        return false
      }
      empty = true
    } else {
      const leading: boolean = (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 46 || c === 95
      if (!leading && (empty || !(temporalIsAlphaNumeric(c) || c === 45 || c === 43))) {
        return false
      }
      empty = false
    }
  }
  return !empty // the last name may not be empty either
}

/** Whether `text[from, to)` is `want`, ignoring the case of ASCII letters; `want` is lowercase. */
const temporalRangeIs = (text: string, from: i32, to: i32, want: string): boolean => {
  if (toI64(to) - toI64(from) !== toI64(want.length)) {
    return false
  }
  for (let i: i32 = 0; i < toI32(want.length); i++) {
    let c: i32 = temporalCharAt(text, toI32(toI64(from) + toI64(i)))
    if (c >= 65 && c <= 90) {
      c = c + 32
    }
    if (c !== temporalCharAt(want, i)) {
      return false
    }
  }
  return true
}

// The fast paths. Nearly every string a program reads is in the one form
// `toString` writes: `YYYY-MM-DD`, then `THH:MM`, `:SS` and a fraction. These
// read exactly that form, straight from the string, with no reader to
// allocate and no range to check (a four-digit year is always inside it).
// Anything else, valid or not, answers -1 and goes to `TemporalReader`, so a
// fast path accepts only strings the reader would read the same way.

/** The character code at `at`, or -1 outside the text. */
const temporalCharAt = (text: string, at: i32): i32 =>
  at >= 0 && at < toI32(text.length) ? toI32(text.charCodeAt(at)) : -1

/** Whether `c` is `T`, `t` or a space, which may stand between a date and a time. */
const temporalIsTimeDesignator = (c: i32): boolean => c === 84 || c === 116 || c === 32

/** The two decimal digits at `at` as a number, or -1 when either is not a digit. */
const temporalFastTwo = (text: string, at: i32): i32 => {
  if (at < 0 || at >= toI32(text.length) - 1) {
    return -1
  }
  // A code below `0` wraps past 9 here, so one test refuses either side.
  const high: u32 = toU32(toI32(text.charCodeAt(at))) - 48
  const low: u32 = toU32(toI32(text.charCodeAt(at + 1))) - 48
  if (high > 9 || low > 9) {
    return -1
  }
  return toI32(high * 10 + low)
}

/**
 * The date `YYYY-MM-DD` at the start of `text`, packed as
 * `temporalCivilOfEpochDay` packs one, or -1 when the text does not start
 * with one in exactly that form or the date does not exist.
 */
const temporalFastDate = (text: string): i64 => {
  const century: i32 = temporalFastTwo(text, 0)
  const yy: i32 = temporalFastTwo(text, 2)
  const month: i32 = temporalFastTwo(text, 5)
  const day: i32 = temporalFastTwo(text, 8)
  if (century < 0 || yy < 0 || month < 1 || month > 12 || day < 1) {
    return -1
  }
  if (temporalCharAt(text, 4) !== 45 || temporalCharAt(text, 7) !== 45) {
    return -1
  }
  // Each field is two digits, so the unsigned sums never wrap.
  const year: u32 = toU32(century) * 100 + toU32(yy)
  if (day > temporalDaysInMonth(toI64(year), month)) {
    return -1
  }
  return toI64((toU64(year) + 400000) * 512 + toU64(month) * 32 + toU64(day))
}

/**
 * The time `HH:MM`, `HH:MM:SS` or `HH:MM:SS.f` that runs from index 11, just
 * past a date and its designator, to exactly `end`, as nanoseconds since
 * midnight, or -1 when it is not in that form. Second 60 reads as 59, as the reader reads it.
 */
const temporalFastTime = (text: string, end: i32): i64 => {
  const at: i32 = 11
  const hour: i32 = temporalFastTwo(text, at)
  const minute: i32 = temporalFastTwo(text, at + 3)
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || temporalCharAt(text, at + 2) !== 58) {
    return -1
  }
  let second: i32 = 0
  let fraction: u32 = 0
  let i: i32 = at + 5
  if (i < end) {
    second = temporalFastTwo(text, i + 1)
    if (temporalCharAt(text, i) !== 58 || second < 0 || second > 60) {
      return -1
    }
    if (second === 60) {
      second = 59
    }
    i = i + 3
    if (i < end) {
      const dot: i32 = temporalCharAt(text, i)
      const digits: i32 = end - i - 1
      if ((dot !== 46 && dot !== 44) || digits < 1 || digits > 9) {
        return -1
      }
      for (let k: i32 = i + 1; k < end; k++) {
        const d: u32 = toU32(temporalCharAt(text, k)) - 48
        if (d > 9) {
          return -1
        }
        fraction = fraction * 10 + d
      }
      for (let k: i32 = digits; k < 9; k++) {
        fraction = fraction * 10
      }
      i = end
    }
  }
  if (i !== end) {
    return -1
  }
  // Two-digit fields and a nine-digit fraction: the u64 sum never wraps.
  return toI64((toU64(hour) * 3600 + toU64(minute) * 60 + toU64(second)) * 1000000000 + toU64(fraction))
}

/**
 * Whether the date `r` read is inside Temporal's range: a date from
 * -271821-04-19 to +275760-09-13, and with `withTime`, a date-time after
 * -271821-04-19T00:00. The reader has already checked the fields.
 */
const temporalReadInRange = (r: TemporalReader, withTime: boolean): boolean => {
  const day: i64 = temporalEpochDay(r.year, r.month, r.day)
  if (day < TEMPORAL_MIN_EPOCH_DAY || day > TEMPORAL_MAX_EPOCH_DAY) {
    return false
  }
  const midnight: boolean = r.hour === 0 && r.minute === 0 && r.second === 0 && r.fraction === 0
  return !(withTime && day === TEMPORAL_MIN_EPOCH_DAY && midnight)
}

/** The reader after reading `text` as a date-time string. */
const temporalReadDateTime = (text: string): TemporalReader => {
  const r: TemporalReader = new TemporalReader(text)
  r.readDateTime()
  return r
}

// ---------------------------------------------------------------------------
// PlainDate
// ---------------------------------------------------------------------------

/**
 * A calendar date with no time and no time zone: `Temporal.PlainDate` in the
 * ISO 8601 calendar. Every field is Temporal's getter of the same name.
 */
export class PlainDate {
  /** The month as Temporal codes it: `M01` to `M12`. */
  readonly monthCode: string
  /** The calendar, always `iso8601`. */
  readonly calendarId: string
  /** @internal The days since 1970-01-01; not part of Temporal. */
  readonly epochDay: i64
  /** The year; negative before 1 BCE's year 0. */
  readonly year: i32
  /** The month, 1 to 12. */
  readonly month: i32
  /** The day of the month, from 1. */
  readonly day: i32
  /** The weekday, 1 for Monday to 7 for Sunday. */
  readonly dayOfWeek: i32
  /** The day of the year, 1 for 1 January. */
  readonly dayOfYear: i32
  /** The ISO week number, 1 to 53. */
  readonly weekOfYear: i32
  /** The year the ISO week belongs to, which differs from `year` near New Year. */
  readonly yearOfWeek: i32
  /** Days in a week: 7. */
  readonly daysInWeek: i32
  /** Days in this date's month. */
  readonly daysInMonth: i32
  /** Days in this date's year: 365 or 366. */
  readonly daysInYear: i32
  /** Months in a year: 12. */
  readonly monthsInYear: i32
  /** Whether this date's year is a leap year. */
  readonly inLeapYear: boolean

  /**
   * The date `isoYear-isoMonth-isoDay`, as `new Temporal.PlainDate(y, m, d)`.
   * Panics with a `RangeError` when the fields name no date, or one outside
   * Temporal's range of -271821-04-19 to +275760-09-13.
   *
   * @param isoYear the year
   * @param isoMonth the month, 1 to 12
   * @param isoDay the day of the month, from 1
   */
  constructor(isoYear: i32, isoMonth: i32, isoDay: i32) {
    temporalCheckDate("PlainDate", toI64(isoYear), toI64(isoMonth), toI64(isoDay))
    const epochDay: i64 = temporalEpochDay(isoYear, isoMonth, isoDay)
    if (epochDay < TEMPORAL_MIN_EPOCH_DAY || epochDay > TEMPORAL_MAX_EPOCH_DAY) {
      temporalRangeError("PlainDate: the date is outside Temporal's range")
    }
    const y: i64 = toI64(isoYear)
    const leap: boolean = temporalIsLeapYear(y)
    const doy: i32 = temporalDayOfYear(isoMonth, isoDay, leap)
    const dow: i32 = temporalDayOfWeek(epochDay)
    let week: i32 = toI32((toI64(doy) - toI64(dow) + 10) / 7)
    let weekYear: i32 = isoYear
    // Only the first and last days of a year can be in another year's week, so
    // the 52-or-53 question is asked only there. The checked year is far
    // inside `i32`, so the year either side of it is exact.
    if (week < 1) {
      weekYear = toI32(y - 1)
      week = temporalWeeksInYear(weekYear)
    } else if (week === 53 && temporalWeeksInYear(isoYear) === 52) {
      weekYear = toI32(y + 1)
      week = 1
    }
    this.year = isoYear
    this.month = isoMonth
    this.day = isoDay
    this.monthCode = temporalMonthCode(isoMonth)
    this.calendarId = "iso8601"
    this.dayOfWeek = dow
    this.dayOfYear = doy
    this.weekOfYear = week
    this.yearOfWeek = weekYear
    this.daysInWeek = 7
    this.daysInMonth = temporalMonthLength(isoMonth, leap)
    this.daysInYear = leap ? 366 : 365
    this.monthsInYear = 12
    this.inLeapYear = leap
    this.epochDay = epochDay
  }

  /**
   * The date as Temporal writes it: `2024-01-15`, or `+012345-01-15` for a
   * year past 9999 or before 0.
   *
   * @returns the ISO 8601 form
   */
  toString(): string {
    const out: u8[] = new Array<u8>(TEMPORAL_TEXT_MAX)
    if (this.year >= 0 && this.year <= 9999) {
      return String.fromBytes(out, 0, temporalPutDate4(out, 0, this.year, this.month, this.day))
    }
    const end: i32 = temporalPutDate(out, 0, this.year, this.month, this.day)
    return String.fromBytes(out, 0, end)
  }

  /**
   * The same string as `toString`, which is what `JSON.stringify` writes.
   *
   * @returns the ISO 8601 form
   */
  toJSON(): string {
    return this.toString()
  }

  /**
   * Whether `other` is the same date.
   *
   * @param other the date to compare with
   * @returns whether the two are equal
   */
  equals(other: PlainDate): boolean {
    return this.epochDay === other.epochDay
  }

  /**
   * This date moved by `duration`: its years and months first, with a day
   * past the end of the new month moved back to its last day (Temporal's
   * `overflow: "constrain"`), then its weeks and days, then whole days of its
   * time fields. Panics with a `RangeError` when the answer is outside
   * Temporal's range.
   *
   * @param duration how far to move
   * @returns the new date
   */
  add(duration: Duration): PlainDate {
    let days: i64 = duration.weeks * 7 + duration.days
    if (!temporalNoTime(duration)) {
      days = days + temporalSpanOfDuration(duration, false).truncDays()
    }
    const epochDay: i64 = temporalAddToDate(
      this.year,
      this.month,
      this.day,
      this.epochDay,
      duration.years,
      duration.months,
      days
    )
    return temporalDateOfEpochDay(epochDay)
  }

  /**
   * This date moved back by `duration`: `add` of its negation.
   *
   * @param duration how far to move back
   * @returns the new date
   */
  subtract(duration: Duration): PlainDate {
    return this.add(duration.negated())
  }

  /**
   * The days from this date to `other`, as a duration of days alone
   * (Temporal's default `largestUnit: "day"`); negative when `other` is
   * earlier.
   *
   * @param other the later date
   * @returns the difference
   */
  until(other: PlainDate): Duration {
    return new Duration(0, 0, 0, other.epochDay - this.epochDay)
  }

  /**
   * The days from `other` to this date: `other.until(this)`.
   *
   * @param other the earlier date
   * @returns the difference
   */
  since(other: PlainDate): Duration {
    return new Duration(0, 0, 0, this.epochDay - other.epochDay)
  }

  /**
   * This date at `time`.
   *
   * @param time the time of day
   * @returns the date-time
   */
  toPlainDateTime(time: PlainTime): PlainDateTime {
    return new PlainDateTime(
      this.year,
      this.month,
      this.day,
      time.hour,
      time.minute,
      time.second,
      time.millisecond,
      time.microsecond,
      time.nanosecond
    )
  }
}

/**
 * `Temporal.PlainDate.from(text)`: the date an RFC 9557 string names. A time,
 * an offset and annotations may follow the date and are ignored but for a
 * calendar, which must be `iso8601`; a `Z` is refused, as it is in Temporal.
 * Panics with a `RangeError` on anything else.
 *
 * @param text such as `2024-01-15`, `20240115` or `2024-01-15T12:00[u-ca=iso8601]`
 * @returns the date
 */
export const plainDateFrom = (text: string): PlainDate => {
  const date: PlainDate | null = plainDateFromOrNull(text)
  if (date === null) {
    temporalRangeError(`PlainDate: cannot parse "${text}"`)
    return new PlainDate(1970, 1, 1)
  }
  return date
}

/**
 * `plainDateFrom`, answering `null` instead of panicking on a string it
 * refuses. Not part of Temporal.
 *
 * @param text the string to parse
 * @returns the date, or `null`
 */
export const plainDateFromOrNull = (text: string): PlainDate | null => {
  if (text.length === 10) {
    const civil: i64 = temporalFastDate(text)
    if (civil >= 0) {
      return new PlainDate(temporalCivilYear(civil), temporalCivilMonth(civil), temporalCivilDay(civil))
    }
  }
  const r: TemporalReader = temporalReadDateTime(text)
  if (!r.ok || r.utc || !r.isoCalendar || !temporalReadInRange(r, false)) {
    return null
  }
  return new PlainDate(r.year, r.month, r.day)
}

/**
 * `Temporal.PlainDate.compare(a, b)`: -1, 0 or 1 as `a` is before, the same
 * as, or after `b`, which is the comparator `sort` takes.
 *
 * @param a the first date
 * @param b the second date
 * @returns the order of the two
 */
export const plainDateCompare = (a: PlainDate, b: PlainDate): i32 => temporalSign(a.epochDay - b.epochDay)

// ---------------------------------------------------------------------------
// PlainTime
// ---------------------------------------------------------------------------

/** A time of day with no date and no time zone: `Temporal.PlainTime`. */
export class PlainTime {
  /** The hour, 0 to 23. */
  readonly hour: i32
  /** The minute, 0 to 59. */
  readonly minute: i32
  /** The second, 0 to 59. */
  readonly second: i32
  /** The millisecond, 0 to 999. */
  readonly millisecond: i32
  /** The microsecond, 0 to 999. */
  readonly microsecond: i32
  /** The nanosecond, 0 to 999. */
  readonly nanosecond: i32
  /** @internal Nanoseconds since midnight; not part of Temporal. */
  readonly nanoOfDay: i64

  /**
   * The time `hour:minute:second.millisecond microsecond nanosecond`, as
   * `new Temporal.PlainTime(...)`; every field defaults to 0, so `new
   * PlainTime()` is midnight. Panics with a `RangeError` on a field out of
   * range.
   *
   * @param hour 0 to 23
   * @param minute 0 to 59
   * @param second 0 to 59
   * @param millisecond 0 to 999
   * @param microsecond 0 to 999
   * @param nanosecond 0 to 999
   */
  constructor(
    hour: i32 = 0,
    minute: i32 = 0,
    second: i32 = 0,
    millisecond: i32 = 0,
    microsecond: i32 = 0,
    nanosecond: i32 = 0
  ) {
    temporalCheckTime(
      "PlainTime",
      toI64(hour),
      toI64(minute),
      toI64(second),
      toI64(millisecond),
      toI64(microsecond),
      toI64(nanosecond)
    )
    this.hour = hour
    this.minute = minute
    this.second = second
    this.millisecond = millisecond
    this.microsecond = microsecond
    this.nanosecond = nanosecond
    this.nanoOfDay = temporalNanoOfDay(hour, minute, second, millisecond, microsecond, nanosecond)
  }

  /**
   * The time as Temporal writes it: `09:05:00`, with the fraction of the
   * second to as many digits as it needs (`09:05:00.25`).
   *
   * @returns the ISO 8601 form
   */
  toString(): string {
    const out: u8[] = new Array<u8>(TEMPORAL_TEXT_MAX)
    const sub: i32 = this.millisecond * 1000000 + this.microsecond * 1000 + this.nanosecond
    const end: i32 = temporalPutTime(out, 0, this.hour, this.minute, this.second, sub)
    return String.fromBytes(out, 0, end)
  }

  /**
   * The same string as `toString`.
   *
   * @returns the ISO 8601 form
   */
  toJSON(): string {
    return this.toString()
  }

  /**
   * Whether `other` is the same time.
   *
   * @param other the time to compare with
   * @returns whether the two are equal
   */
  equals(other: PlainTime): boolean {
    return this.nanoOfDay === other.nanoOfDay
  }

  /**
   * This time moved by the time fields of `duration`, wrapping past midnight;
   * the years, months, weeks and days are ignored, as Temporal ignores them.
   *
   * @param duration how far to move
   * @returns the new time
   */
  add(duration: Duration): PlainTime {
    const span: TemporalSpan = temporalSpanOfDuration(duration, false)
    const seconds: i64 = temporalFloorMod(span.seconds, TEMPORAL_SECONDS_PER_DAY)
    const ns: i64 = seconds * TEMPORAL_NS_PER_SECOND + toI64(span.nanos) + this.nanoOfDay
    return temporalTimeOfNanos(temporalFloorMod(ns, TEMPORAL_NS_PER_DAY))
  }

  /**
   * This time moved back by `duration`: `add` of its negation.
   *
   * @param duration how far to move back
   * @returns the new time
   */
  subtract(duration: Duration): PlainTime {
    return this.add(duration.negated())
  }

  /**
   * The time from this time to `other` on the same day, in hours and smaller
   * units (Temporal's default `largestUnit: "hour"`).
   *
   * @param other the later time
   * @returns the difference
   */
  until(other: PlainTime): Duration {
    return temporalBalance(new TemporalSpan(0, other.nanoOfDay - this.nanoOfDay), TEMPORAL_UNIT_HOUR)
  }

  /**
   * The time from `other` to this time: `other.until(this)`.
   *
   * @param other the earlier time
   * @returns the difference
   */
  since(other: PlainTime): Duration {
    return temporalBalance(new TemporalSpan(0, this.nanoOfDay - other.nanoOfDay), TEMPORAL_UNIT_HOUR)
  }
}

/**
 * `Temporal.PlainTime.from(text)`: the time an RFC 9557 string names, either
 * a time alone (`12:30`, `T1230`, `12:30:15.5`) or a date-time, whose date is
 * ignored. A string with no time, one with a `Z`, and a time alone without
 * its `T` that would also read as a year and month or a month and day
 * (`2021-12`, `1214`) are refused, as Temporal refuses them. Panics with a
 * `RangeError` on anything else.
 *
 * @param text the string to parse
 * @returns the time
 */
export const plainTimeFrom = (text: string): PlainTime => {
  const time: PlainTime | null = plainTimeFromOrNull(text)
  if (time === null) {
    temporalRangeError(`PlainTime: cannot parse "${text}"`)
    return new PlainTime()
  }
  return time
}

/**
 * `plainTimeFrom`, answering `null` instead of panicking on a string it
 * refuses. Not part of Temporal.
 *
 * @param text the string to parse
 * @returns the time, or `null`
 */
export const plainTimeFromOrNull = (text: string): PlainTime | null => {
  const full: TemporalReader = temporalReadDateTime(text)
  if (full.ok) {
    if (!full.hasTime || full.utc) {
      return null
    }
    return new PlainTime(
      full.hour,
      full.minute,
      full.second,
      toI32(full.fraction / 1000000),
      toI32(full.fraction / 1000) % 1000,
      full.fraction % 1000
    )
  }
  const r: TemporalReader = new TemporalReader(text)
  const designated: boolean = r.eat(toI32(84)) || r.eat(toI32(116))
  r.readTime()
  if (r.ok) {
    r.readOffset()
  }
  if (r.ok) {
    r.readAnnotations()
  }
  if (!r.ok || !r.done() || r.utc) {
    return null
  }
  if (!designated && temporalLooksLikeYearMonthOrMonthDay(text)) {
    return null
  }
  return new PlainTime(
    r.hour,
    r.minute,
    r.second,
    toI32(r.fraction / 1000000),
    toI32(r.fraction / 1000) % 1000,
    r.fraction % 1000
  )
}

/**
 * Whether `text`, before any annotation, reads as a year and month
 * (`2021-12`, `202112`) or a month and day (`12-14`, `1214`), which a time
 * without its `T` may not be. Only a month and day that exist count, in the
 * leap year 1972 that `PlainMonthDay` takes for reference: `0229` is one, so
 * it is refused as a time, and `0230` is not, so it reads as 02:30, as
 * Node's `Temporal` reads it.
 */
const temporalLooksLikeYearMonthOrMonthDay = (text: string): boolean => {
  const bracket: i32 = toI32(text.indexOf("["))
  const head: string = bracket < 0 ? text : text.substring(0, bracket)
  const n: i32 = toI32(head.length)
  for (let i: i32 = 0; i < n; i++) {
    const c: i32 = toI32(head.charCodeAt(i))
    if (!((c >= 48 && c <= 57) || c === 45)) {
      return false
    }
  }
  if (n === 7 && toI32(head.charCodeAt(4)) === 45) {
    const m: i32 = temporalTwoDigits(head, 5)
    return m >= 1 && m <= 12
  }
  if (n === 6 && toI32(head.indexOf("-")) < 0) {
    const m: i32 = temporalTwoDigits(head, 4)
    return m >= 1 && m <= 12
  }
  if ((n === 5 && toI32(head.charCodeAt(2)) === 45) || (n === 4 && toI32(head.indexOf("-")) < 0)) {
    const m: i32 = temporalTwoDigits(head, 0)
    const d: i32 = temporalTwoDigits(head, n === 5 ? 3 : 2)
    return m >= 1 && m <= 12 && d >= 1 && d <= temporalDaysInMonth(1972, m)
  }
  return false
}

/** The two decimal digits of `text` at `at` as a number. */
const temporalTwoDigits = (text: string, at: i32): i32 =>
  (toI32(text.charCodeAt(at)) - 48) * 10 + toI32(text.charCodeAt(at + 1)) - 48

/**
 * `Temporal.PlainTime.compare(a, b)`: -1, 0 or 1 as `a` is earlier than, the
 * same as, or later than `b`.
 *
 * @param a the first time
 * @param b the second time
 * @returns the order of the two
 */
export const plainTimeCompare = (a: PlainTime, b: PlainTime): i32 => temporalSign(a.nanoOfDay - b.nanoOfDay)

// ---------------------------------------------------------------------------
// PlainDateTime
// ---------------------------------------------------------------------------

/**
 * A date and a time of day with no time zone: `Temporal.PlainDateTime` in the
 * ISO 8601 calendar. It has every field of `PlainDate` and of `PlainTime`.
 */
export class PlainDateTime {
  /** The month as Temporal codes it: `M01` to `M12`. */
  readonly monthCode: string
  /** The calendar, always `iso8601`. */
  readonly calendarId: string
  /** @internal The days since 1970-01-01; not part of Temporal. */
  readonly epochDay: i64
  /** @internal Nanoseconds since midnight; not part of Temporal. */
  readonly nanoOfDay: i64
  /** The year. */
  readonly year: i32
  /** The month, 1 to 12. */
  readonly month: i32
  /** The day of the month, from 1. */
  readonly day: i32
  /** The weekday, 1 for Monday to 7 for Sunday. */
  readonly dayOfWeek: i32
  /** The day of the year, 1 for 1 January. */
  readonly dayOfYear: i32
  /** The ISO week number, 1 to 53. */
  readonly weekOfYear: i32
  /** The year the ISO week belongs to. */
  readonly yearOfWeek: i32
  /** Days in a week: 7. */
  readonly daysInWeek: i32
  /** Days in this date's month. */
  readonly daysInMonth: i32
  /** Days in this date's year: 365 or 366. */
  readonly daysInYear: i32
  /** Months in a year: 12. */
  readonly monthsInYear: i32
  /** The hour, 0 to 23. */
  readonly hour: i32
  /** The minute, 0 to 59. */
  readonly minute: i32
  /** The second, 0 to 59. */
  readonly second: i32
  /** The millisecond, 0 to 999. */
  readonly millisecond: i32
  /** The microsecond, 0 to 999. */
  readonly microsecond: i32
  /** The nanosecond, 0 to 999. */
  readonly nanosecond: i32
  /** Whether this date's year is a leap year. */
  readonly inLeapYear: boolean

  /**
   * The date-time, as `new Temporal.PlainDateTime(...)`; the time fields
   * default to 0. Panics with a `RangeError` on a field out of range, or a
   * moment outside Temporal's range of -271821-04-19T00:00:00.000000001 to
   * +275760-09-13T23:59:59.999999999.
   *
   * @param isoYear the year
   * @param isoMonth the month, 1 to 12
   * @param isoDay the day of the month, from 1
   * @param hour 0 to 23
   * @param minute 0 to 59
   * @param second 0 to 59
   * @param millisecond 0 to 999
   * @param microsecond 0 to 999
   * @param nanosecond 0 to 999
   */
  constructor(
    isoYear: i32,
    isoMonth: i32,
    isoDay: i32,
    hour: i32 = 0,
    minute: i32 = 0,
    second: i32 = 0,
    millisecond: i32 = 0,
    microsecond: i32 = 0,
    nanosecond: i32 = 0
  ) {
    const date: PlainDate = new PlainDate(isoYear, isoMonth, isoDay)
    temporalCheckTime(
      "PlainDateTime",
      toI64(hour),
      toI64(minute),
      toI64(second),
      toI64(millisecond),
      toI64(microsecond),
      toI64(nanosecond)
    )
    const nanoOfDay: i64 = temporalNanoOfDay(hour, minute, second, millisecond, microsecond, nanosecond)
    if (date.epochDay === TEMPORAL_MIN_EPOCH_DAY && nanoOfDay === 0) {
      temporalRangeError("PlainDateTime: the date-time is outside Temporal's range")
    }
    this.year = isoYear
    this.month = isoMonth
    this.day = isoDay
    this.monthCode = date.monthCode
    this.calendarId = date.calendarId
    this.dayOfWeek = date.dayOfWeek
    this.dayOfYear = date.dayOfYear
    this.weekOfYear = date.weekOfYear
    this.yearOfWeek = date.yearOfWeek
    this.daysInWeek = date.daysInWeek
    this.daysInMonth = date.daysInMonth
    this.daysInYear = date.daysInYear
    this.monthsInYear = date.monthsInYear
    this.inLeapYear = date.inLeapYear
    this.hour = hour
    this.minute = minute
    this.second = second
    this.millisecond = millisecond
    this.microsecond = microsecond
    this.nanosecond = nanosecond
    this.epochDay = date.epochDay
    this.nanoOfDay = nanoOfDay
  }

  /**
   * The date-time as Temporal writes it: `2024-01-15T09:05:00`, with the
   * fraction of the second to as many digits as it needs.
   *
   * @returns the ISO 8601 form
   */
  toString(): string {
    const out: u8[] = new Array<u8>(TEMPORAL_TEXT_MAX)
    const sub: i32 = this.millisecond * 1000000 + this.microsecond * 1000 + this.nanosecond
    if (this.year >= 0 && this.year <= 9999) {
      const seconds: i32 = temporalPutDateTime4(
        out,
        0,
        this.year,
        this.month,
        this.day,
        this.hour,
        this.minute,
        this.second
      )
      return String.fromBytes(out, 0, temporalPutFraction(out, seconds, sub))
    }
    const date: i32 = temporalPutDate(out, 0, this.year, this.month, this.day)
    const end: i32 = temporalPutTime(
      out,
      temporalPutByte(out, date, 84),
      this.hour,
      this.minute,
      this.second,
      sub
    )
    return String.fromBytes(out, 0, end)
  }

  /**
   * The same string as `toString`.
   *
   * @returns the ISO 8601 form
   */
  toJSON(): string {
    return this.toString()
  }

  /**
   * The date part.
   *
   * @returns the date
   */
  toPlainDate(): PlainDate {
    return new PlainDate(this.year, this.month, this.day)
  }

  /**
   * The time part.
   *
   * @returns the time
   */
  toPlainTime(): PlainTime {
    return new PlainTime(
      this.hour,
      this.minute,
      this.second,
      this.millisecond,
      this.microsecond,
      this.nanosecond
    )
  }

  /**
   * This date-time with its time replaced by `time`.
   *
   * @param time the new time of day
   * @returns the new date-time
   */
  withPlainTime(time: PlainTime): PlainDateTime {
    return this.toPlainDate().toPlainDateTime(time)
  }

  /**
   * Whether `other` is the same date-time.
   *
   * @param other the date-time to compare with
   * @returns whether the two are equal
   */
  equals(other: PlainDateTime): boolean {
    return this.epochDay === other.epochDay && this.nanoOfDay === other.nanoOfDay
  }

  /**
   * This date-time moved by `duration`: the time fields first, carrying whole
   * days, then the years and months with the day constrained to the new
   * month, then the weeks, the days and the carried days — Temporal's
   * AddDurationToDateTime. Panics with a `RangeError` outside Temporal's range.
   *
   * @param duration how far to move
   * @returns the new date-time
   */
  add(duration: Duration): PlainDateTime {
    let carryDays: i64 = 0
    let nanoOfDay: i64 = this.nanoOfDay
    if (!temporalNoTime(duration)) {
      const seconds: i64 = temporalDurationSeconds(duration, false)
      const nanos: i64 = temporalDurationNanos(duration) + this.nanoOfDay
      const total: i64 = seconds + temporalFloorDiv(nanos, TEMPORAL_NS_PER_SECOND)
      carryDays = temporalFloorDiv(total, TEMPORAL_SECONDS_PER_DAY)
      nanoOfDay =
        temporalFloorMod(total, TEMPORAL_SECONDS_PER_DAY) * TEMPORAL_NS_PER_SECOND +
        temporalFloorMod(nanos, TEMPORAL_NS_PER_SECOND)
    }
    const epochDay: i64 = temporalAddToDate(
      this.year,
      this.month,
      this.day,
      this.epochDay,
      duration.years,
      duration.months,
      duration.weeks * 7 + duration.days + carryDays
    )
    const civil: i64 = temporalCivilOfEpochDay(epochDay)
    const secs: i64 = toI64(nanoOfDay / TEMPORAL_NS_PER_SECOND)
    const sub: i32 = toI32(nanoOfDay % TEMPORAL_NS_PER_SECOND)
    return new PlainDateTime(
      temporalCivilYear(civil),
      temporalCivilMonth(civil),
      temporalCivilDay(civil),
      toI32(secs / 3600),
      toI32(toI64(secs / 60) % 60),
      toI32(secs % 60),
      toI32(sub / 1000000),
      toI32(sub / 1000) % 1000,
      sub % 1000
    )
  }

  /**
   * This date-time moved back by `duration`: `add` of its negation.
   *
   * @param duration how far to move back
   * @returns the new date-time
   */
  subtract(duration: Duration): PlainDateTime {
    return this.add(duration.negated())
  }

  /**
   * The time from this date-time to `other` in days and smaller units
   * (Temporal's default `largestUnit: "day"`), every field with one sign.
   *
   * @param other the later date-time
   * @returns the difference
   */
  until(other: PlainDateTime): Duration {
    return temporalBalance(temporalDateTimeSpan(this, other), TEMPORAL_UNIT_DAY)
  }

  /**
   * The time from `other` to this date-time: `other.until(this)`.
   *
   * @param other the earlier date-time
   * @returns the difference
   */
  since(other: PlainDateTime): Duration {
    return temporalBalance(temporalDateTimeSpan(other, this), TEMPORAL_UNIT_DAY)
  }
}

/** The span from `a` to `b`, every day 24 hours. */
const temporalDateTimeSpan = (a: PlainDateTime, b: PlainDateTime): TemporalSpan =>
  new TemporalSpan((b.epochDay - a.epochDay) * TEMPORAL_SECONDS_PER_DAY, b.nanoOfDay - a.nanoOfDay)

/**
 * `Temporal.PlainDateTime.from(text)`: the date-time an RFC 9557 string
 * names; a date alone is midnight. An offset and annotations are ignored but
 * for a calendar, which must be `iso8601`; a `Z` is refused. Panics with a
 * `RangeError` on anything else.
 *
 * @param text such as `2024-01-15T09:05` or `2024-01-15 09:05:00.5`
 * @returns the date-time
 */
export const plainDateTimeFrom = (text: string): PlainDateTime => {
  const dt: PlainDateTime | null = plainDateTimeFromOrNull(text)
  if (dt === null) {
    temporalRangeError(`PlainDateTime: cannot parse "${text}"`)
    return new PlainDateTime(1970, 1, 1)
  }
  return dt
}

/**
 * `plainDateTimeFrom`, answering `null` instead of panicking on a string it
 * refuses. Not part of Temporal.
 *
 * @param text the string to parse
 * @returns the date-time, or `null`
 */
export const plainDateTimeFromOrNull = (text: string): PlainDateTime | null => {
  const length: i32 = toI32(text.length)
  if (length >= 16 && temporalIsTimeDesignator(temporalCharAt(text, 10))) {
    const civil: i64 = temporalFastDate(text)
    const nanoOfDay: i64 = civil < 0 ? -1 : temporalFastTime(text, length)
    if (nanoOfDay >= 0) {
      const secs: i32 = toI32(nanoOfDay / TEMPORAL_NS_PER_SECOND)
      const sub: i32 = toI32(nanoOfDay % TEMPORAL_NS_PER_SECOND)
      return new PlainDateTime(
        temporalCivilYear(civil),
        temporalCivilMonth(civil),
        temporalCivilDay(civil),
        toI32(secs / 3600),
        toI32(secs / 60) % 60,
        secs % 60,
        toI32(sub / 1000000),
        toI32(sub / 1000) % 1000,
        sub % 1000
      )
    }
  }
  const r: TemporalReader = temporalReadDateTime(text)
  if (!r.ok || r.utc || !r.isoCalendar || !temporalReadInRange(r, true)) {
    return null
  }
  return new PlainDateTime(
    r.year,
    r.month,
    r.day,
    r.hour,
    r.minute,
    r.second,
    toI32(r.fraction / 1000000),
    toI32(r.fraction / 1000) % 1000,
    r.fraction % 1000
  )
}

/**
 * `Temporal.PlainDateTime.compare(a, b)`: -1, 0 or 1 as `a` is before, the
 * same as, or after `b`.
 *
 * @param a the first date-time
 * @param b the second date-time
 * @returns the order of the two
 */
export const plainDateTimeCompare = (a: PlainDateTime, b: PlainDateTime): i32 => {
  const byDay: i32 = temporalSign(a.epochDay - b.epochDay)
  return byDay !== 0 ? byDay : temporalSign(a.nanoOfDay - b.nanoOfDay)
}

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------

/**
 * A length of time in ten signed fields: `Temporal.Duration`. A duration is
 * not balanced: `PT90M` keeps its 90 minutes. Every non-zero field has the
 * same sign.
 */
export class Duration {
  /** Years. */
  readonly years: i64
  /** Months. */
  readonly months: i64
  /** Weeks. */
  readonly weeks: i64
  /** Days. */
  readonly days: i64
  /** Hours. */
  readonly hours: i64
  /** Minutes. */
  readonly minutes: i64
  /** Seconds. */
  readonly seconds: i64
  /** Milliseconds. */
  readonly milliseconds: i64
  /** Microseconds. */
  readonly microseconds: i64
  /** Nanoseconds. */
  readonly nanoseconds: i64
  /** -1, 0 or 1: the sign every non-zero field shares. */
  readonly sign: i32
  /** Whether every field is zero. */
  readonly blank: boolean

  /**
   * The duration, as `new Temporal.Duration(...)`; every field defaults to 0.
   * Panics with a `RangeError` when two fields have different signs, when
   * `years`, `months` or `weeks` reaches 2^32, or when the rest comes to 2^53
   * seconds or more.
   *
   * @param years years
   * @param months months
   * @param weeks weeks
   * @param days days
   * @param hours hours
   * @param minutes minutes
   * @param seconds seconds
   * @param milliseconds milliseconds
   * @param microseconds microseconds
   * @param nanoseconds nanoseconds
   */
  constructor(
    years: i64 = 0,
    months: i64 = 0,
    weeks: i64 = 0,
    days: i64 = 0,
    hours: i64 = 0,
    minutes: i64 = 0,
    seconds: i64 = 0,
    milliseconds: i64 = 0,
    microseconds: i64 = 0,
    nanoseconds: i64 = 0
  ) {
    // The checks are written out here, not a call of `temporalDurationProblem`,
    // because every `until` and `add` builds a `Duration`: as a call they cost
    // `until` on a date 70% (bench/temporal.ts). Each bound is tested on both
    // sides, so the least `i64`, whose magnitude does not fit, is refused too.
    let sign: i32 = temporalSignOf(0, years)
    sign = temporalSignOf(sign, months)
    sign = temporalSignOf(sign, weeks)
    sign = temporalSignOf(sign, days)
    sign = temporalSignOf(sign, hours)
    sign = temporalSignOf(sign, minutes)
    sign = temporalSignOf(sign, seconds)
    sign = temporalSignOf(sign, milliseconds)
    sign = temporalSignOf(sign, microseconds)
    sign = temporalSignOf(sign, nanoseconds)
    const c: i64 = TEMPORAL_MAX_CALENDAR_FIELD
    if (years <= -c || years >= c || months <= -c || months >= c || weeks <= -c || weeks >= c) {
      temporalRangeError("Duration: years, months and weeks must each be below 2^32")
    }
    const m: i64 = TEMPORAL_MAX_DURATION_SECONDS
    if (
      days < -104249991374 ||
      days > 104249991374 ||
      hours < -2501999792983 ||
      hours > 2501999792983 ||
      minutes < -150119987579016 ||
      minutes > 150119987579016 ||
      seconds < -m ||
      seconds > m
    ) {
      temporalRangeError("Duration: the time fields come to 2^53 seconds or more")
    }
    if (temporalWholeSeconds(days, hours, minutes, seconds, milliseconds, microseconds, nanoseconds) > m) {
      temporalRangeError("Duration: the time fields come to 2^53 seconds or more")
    }
    this.years = years
    this.months = months
    this.weeks = weeks
    this.days = days
    this.hours = hours
    this.minutes = minutes
    this.seconds = seconds
    this.milliseconds = milliseconds
    this.microseconds = microseconds
    this.nanoseconds = nanoseconds
    this.sign = sign
    this.blank = sign === 0
  }

  /**
   * The duration as ISO 8601 writes it: `P1Y2M3W4DT5H6M7.008S`, `-PT90M`,
   * and `PT0S` when blank. The seconds and their fractions are written as one
   * decimal number, so `PT1.5S` reads back as 1 second and 500 milliseconds.
   *
   * @returns the ISO 8601 form
   */
  toString(): string {
    const k: i64 = toI64(this.sign < 0 ? -1 : 1)
    const out: u8[] = new Array<u8>(TEMPORAL_TEXT_MAX)
    let i: i32 = 0
    if (this.sign < 0) {
      i = temporalPutByte(out, i, 45)
    }
    i = temporalPutByte(out, i, 80)
    if (this.years !== 0) {
      i = temporalPutField(out, i, this.years * k, 89)
    }
    if (this.months !== 0) {
      i = temporalPutField(out, i, this.months * k, 77)
    }
    if (this.weeks !== 0) {
      i = temporalPutField(out, i, this.weeks * k, 87)
    }
    if (this.days !== 0) {
      i = temporalPutField(out, i, this.days * k, 68)
    }
    const zeroAbove: boolean =
      this.years === 0 &&
      this.months === 0 &&
      this.weeks === 0 &&
      this.days === 0 &&
      this.hours === 0 &&
      this.minutes === 0
    // The seconds and their fractions are one decimal number, balanced. Every
    // field times `k` is not negative, so each division here truncates as a
    // floor would.
    const ms: i64 = this.milliseconds * k
    const us: i64 = this.microseconds * k
    const ns: i64 = this.nanoseconds * k
    let fraction: i64 = (ms % 1000) * 1000000 + (us % 1000000) * 1000 + (ns % TEMPORAL_NS_PER_SECOND)
    const wholeSeconds: i64 =
      this.seconds * k +
      toI64(ms / 1000) +
      toI64(us / 1000000) +
      toI64(ns / TEMPORAL_NS_PER_SECOND) +
      toI64(fraction / TEMPORAL_NS_PER_SECOND)
    fraction = fraction % TEMPORAL_NS_PER_SECOND
    const withSeconds: boolean = wholeSeconds !== 0 || fraction !== 0 || zeroAbove
    if (this.hours !== 0 || this.minutes !== 0 || withSeconds) {
      i = temporalPutByte(out, i, 84)
    }
    if (this.hours !== 0) {
      i = temporalPutField(out, i, this.hours * k, 72)
    }
    if (this.minutes !== 0) {
      i = temporalPutField(out, i, this.minutes * k, 77)
    }
    if (withSeconds) {
      i = temporalPutNumber(out, i, wholeSeconds)
      i = temporalPutByte(out, temporalPutFraction(out, i, toI32(fraction)), 83)
    }
    return String.fromBytes(out, 0, i)
  }

  /**
   * The same string as `toString`.
   *
   * @returns the ISO 8601 form
   */
  toJSON(): string {
    return this.toString()
  }

  /**
   * This duration with every field's sign flipped.
   *
   * @returns the negated duration
   */
  negated(): Duration {
    return new Duration(
      -this.years,
      -this.months,
      -this.weeks,
      -this.days,
      -this.hours,
      -this.minutes,
      -this.seconds,
      -this.milliseconds,
      -this.microseconds,
      -this.nanoseconds
    )
  }

  /**
   * This duration with every field made non-negative.
   *
   * @returns the absolute duration
   */
  abs(): Duration {
    return this.sign < 0 ? this.negated() : this
  }

  /**
   * The sum of this duration and `other`, balanced up to the larger of the
   * two's largest non-zero unit, as Temporal's `Duration.prototype.add`
   * balances it (`P1D` plus `PT25H` is `P2DT1H`). Panics with a `RangeError`
   * when either has years, months or weeks, whose length depends on a date.
   *
   * @param other the duration to add
   * @returns the sum
   */
  add(other: Duration): Duration {
    if (
      this.years !== 0 ||
      this.months !== 0 ||
      this.weeks !== 0 ||
      other.years !== 0 ||
      other.months !== 0 ||
      other.weeks !== 0
    ) {
      temporalRangeError("Duration: adding years, months or weeks needs a relativeTo date")
    }
    const a: i32 = temporalLargestUnit(this)
    const b: i32 = temporalLargestUnit(other)
    const sum: TemporalSpan = temporalSpanOfDuration(this, true).plus(temporalSpanOfDuration(other, true))
    return temporalBalance(sum, a > b ? a : b)
  }

  /**
   * This duration minus `other`: `add` of its negation.
   *
   * @param other the duration to subtract
   * @returns the difference
   */
  subtract(other: Duration): Duration {
    return this.add(other.negated())
  }
}

/** `sign` after a field `n`: its sign, or a `RangeError` when it differs from a non-zero `sign`. */
const temporalSignOf = (sign: i32, n: i64): i32 => {
  if (n === 0) {
    return sign
  }
  const s: i32 = n < 0 ? -1 : 1
  if (sign !== 0 && s !== sign) {
    temporalRangeError("Duration: the fields have mixed signs")
  }
  return s
}

/**
 * The magnitude of the whole seconds of the time fields, rounded toward
 * zero, for fields that share one sign and are each within the bounds the
 * constructor checks first, so that the sum fits an `i64`: the fields' own
 * whole seconds plus the seconds their remainders carry.
 */
const temporalWholeSeconds = (
  days: i64,
  hours: i64,
  minutes: i64,
  seconds: i64,
  milliseconds: i64,
  microseconds: i64,
  nanoseconds: i64
): i64 => {
  const carry: i64 = toI64(
    (toI64(milliseconds % 1000) * 1000000 +
      toI64(microseconds % 1000000) * 1000 +
      (nanoseconds % 1000000000)) /
      1000000000
  )
  const whole: i64 =
    days * TEMPORAL_SECONDS_PER_DAY +
    hours * 3600 +
    minutes * 60 +
    seconds +
    toI64(milliseconds / 1000) +
    toI64(microseconds / 1000000) +
    toI64(nanoseconds / 1000000000) +
    carry
  return whole < 0 ? -whole : whole
}

/**
 * Why the ten fields make no valid `Duration`, or `""` when they make one,
 * by the constructor's own checks, for `durationFromOrNull` to answer `null`
 * where the constructor would panic:
 * two non-zero fields with different signs, `years`, `months` or `weeks` at
 * 2^32 or past, or the rest coming to 2^53 seconds or more (Temporal's
 * IsValidDuration). Every bound is tested on both sides, so the least `i64`,
 * whose magnitude does not fit, is refused too.
 */
const temporalDurationProblem = (
  years: i64,
  months: i64,
  weeks: i64,
  days: i64,
  hours: i64,
  minutes: i64,
  seconds: i64,
  milliseconds: i64,
  microseconds: i64,
  nanoseconds: i64
): string => {
  const positive: boolean =
    years > 0 ||
    months > 0 ||
    weeks > 0 ||
    days > 0 ||
    hours > 0 ||
    minutes > 0 ||
    seconds > 0 ||
    milliseconds > 0 ||
    microseconds > 0 ||
    nanoseconds > 0
  const negative: boolean =
    years < 0 ||
    months < 0 ||
    weeks < 0 ||
    days < 0 ||
    hours < 0 ||
    minutes < 0 ||
    seconds < 0 ||
    milliseconds < 0 ||
    microseconds < 0 ||
    nanoseconds < 0
  if (positive && negative) {
    return "the fields have mixed signs"
  }
  const c: i64 = TEMPORAL_MAX_CALENDAR_FIELD
  if (years <= -c || years >= c || months <= -c || months >= c || weeks <= -c || weeks >= c) {
    return "years, months and weeks must each be below 2^32"
  }
  // Each field alone within the 2^53-second bound keeps the sum inside an i64.
  const m: i64 = TEMPORAL_MAX_DURATION_SECONDS
  if (
    days < -104249991374 ||
    days > 104249991374 ||
    hours < -2501999792983 ||
    hours > 2501999792983 ||
    minutes < -150119987579016 ||
    minutes > 150119987579016 ||
    seconds < -m ||
    seconds > m
  ) {
    return "the time fields come to 2^53 seconds or more"
  }
  if (temporalWholeSeconds(days, hours, minutes, seconds, milliseconds, microseconds, nanoseconds) > m) {
    return "the time fields come to 2^53 seconds or more"
  }
  return ""
}

/** The largest unit `d` has a non-zero field in, or nanoseconds when it is blank. */
const temporalLargestUnit = (d: Duration): i32 => {
  if (d.years !== 0) {
    return TEMPORAL_UNIT_YEAR
  }
  if (d.months !== 0) {
    return TEMPORAL_UNIT_MONTH
  }
  if (d.weeks !== 0) {
    return TEMPORAL_UNIT_WEEK
  }
  if (d.days !== 0) {
    return TEMPORAL_UNIT_DAY
  }
  if (d.hours !== 0) {
    return TEMPORAL_UNIT_HOUR
  }
  if (d.minutes !== 0) {
    return TEMPORAL_UNIT_MINUTE
  }
  if (d.seconds !== 0) {
    return TEMPORAL_UNIT_SECOND
  }
  if (d.milliseconds !== 0) {
    return TEMPORAL_UNIT_MILLISECOND
  }
  if (d.microseconds !== 0) {
    return TEMPORAL_UNIT_MICROSECOND
  }
  return TEMPORAL_UNIT_NANOSECOND
}

/**
 * `Temporal.Duration.from(text)`: the duration an ISO 8601 string names,
 * `[+-]P[nY][nM][nW][nD][T[nH][nM][nS]]` in either case, where the last time
 * field may have a fraction of up to nine digits (`PT1.5H` is an hour and 30
 * minutes). Panics with a `RangeError` on anything else.
 *
 * @param text such as `P1Y2M`, `PT36H` or `-P1DT0.5S`
 * @returns the duration
 */
export const durationFrom = (text: string): Duration => {
  const d: Duration | null = durationFromOrNull(text)
  if (d === null) {
    temporalRangeError(`Duration: cannot parse "${text}"`)
    return new Duration()
  }
  return d
}

/**
 * `durationFrom`, answering `null` instead of panicking on a string it
 * refuses. Not part of Temporal.
 *
 * @param text the string to parse
 * @returns the duration, or `null`
 */
export const durationFromOrNull = (text: string): Duration | null => {
  const r: TemporalReader = new TemporalReader(text)
  let negative: boolean = false
  if (r.eat(toI32(45))) {
    negative = true
  } else {
    r.eat(toI32(43))
  }
  if (!r.eat(toI32(80)) && !r.eat(toI32(112))) {
    return null
  }
  // Fields in order: Y M W D, then after T: H M S. `rank` is the last read.
  const values: i64[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  let rank: i32 = -1
  let inTime: boolean = false
  let any: boolean = false
  let fractionSeen: boolean = false
  let longest: i32 = 0
  while (!r.done()) {
    const c: i32 = r.peek(toI32(0))
    if (c === 84 || c === 116) {
      if (inTime) {
        return null
      }
      inTime = true
      r.at = r.at + 1
      if (r.done()) {
        return null
      }
      continue
    }
    if (fractionSeen || !r.digitAt(toI32(0))) {
      return null
    }
    let n: i64 = 0
    let count: i32 = 0
    while (r.digitAt(toI32(0))) {
      if (count === 16) {
        return null
      }
      n = n * 10 + toI64(r.peek(toI32(0)) - 48)
      count = count + 1
      r.at = r.at + 1
    }
    if (count > longest) {
      longest = count
    }
    const beforeFraction: i32 = r.at
    const fraction: i32 = r.fractionDigits()
    const sawFraction: boolean = r.at !== beforeFraction
    const unit: i32 = r.peek(toI32(0)) | 32 // lowercased
    r.at = r.at + 1
    const slot: i32 = temporalDurationSlot(unit, inTime)
    if (slot < 0 || slot >= toI32(values.length) || slot <= rank || !r.ok) {
      return null
    }
    rank = slot
    any = true
    values[slot] = n
    if (sawFraction) {
      if (!inTime) {
        return null
      }
      fractionSeen = true
      // The fraction of an hour, a minute or a second, spread over the smaller fields.
      let ns: i64 = toI64(fraction)
      if (slot === 4) {
        ns = ns * 3600
      } else if (slot === 5) {
        ns = ns * 60
      }
      if (slot === 4) {
        values[5] = temporalTruncDiv(ns, 60 * TEMPORAL_NS_PER_SECOND)
        ns = ns % (60 * TEMPORAL_NS_PER_SECOND)
      }
      if (slot <= 5) {
        values[6] = temporalTruncDiv(ns, TEMPORAL_NS_PER_SECOND)
        ns = ns % TEMPORAL_NS_PER_SECOND
      }
      values[7] = temporalTruncDiv(ns, 1000000)
      values[8] = temporalTruncDiv(ns, 1000) % 1000
      values[9] = ns % 1000
    }
  }
  if (!any || !r.ok) {
    return null
  }
  const k: i64 = toI64(negative ? -1 : 1)
  // Fields of nine digits or fewer cannot reach any of the constructor's
  // bounds, so only a longer one is checked here first.
  const problem: string =
    longest <= 9
      ? ""
      : temporalDurationProblem(
          values[0] * k,
          values[1] * k,
          values[2] * k,
          values[3] * k,
          values[4] * k,
          values[5] * k,
          values[6] * k,
          values[7] * k,
          values[8] * k,
          values[9] * k
        )
  if (problem.length > 0) {
    return null
  }
  return new Duration(
    values[0] * k,
    values[1] * k,
    values[2] * k,
    values[3] * k,
    values[4] * k,
    values[5] * k,
    values[6] * k,
    values[7] * k,
    values[8] * k,
    values[9] * k
  )
}

/**
 * The field a duration designator fills: 0 to 3 for `Y`, `M`, `W` and `D`
 * before the `T`, 4 to 6 for `H`, `M` and `S` after it, and -1 for any other
 * character. `unit` is already lowercased.
 */
const temporalDurationSlot = (unit: i32, inTime: boolean): i32 => {
  const designators: string = inTime ? "hms" : "ymwd"
  for (let i: i32 = 0; i < toI32(designators.length); i++) {
    if (toI32(designators.charCodeAt(i)) === unit) {
      return inTime ? i + 4 : i
    }
  }
  return -1
}

/**
 * `Temporal.Duration.compare(a, b)`: -1, 0 or 1 as `a` is shorter than, as
 * long as, or longer than `b`, each day counted as 24 hours. Panics with a
 * `RangeError` when either has years, months or weeks, which Temporal
 * compares only against a `relativeTo` date; two durations with the same
 * fields compare equal whatever they hold.
 *
 * @param a the first duration
 * @param b the second duration
 * @returns the order of the two
 */
export const durationCompare = (a: Duration, b: Duration): i32 => {
  if (
    a.years === b.years &&
    a.months === b.months &&
    a.weeks === b.weeks &&
    a.days === b.days &&
    a.hours === b.hours &&
    a.minutes === b.minutes &&
    a.seconds === b.seconds &&
    a.milliseconds === b.milliseconds &&
    a.microseconds === b.microseconds &&
    a.nanoseconds === b.nanoseconds
  ) {
    return 0
  }
  if (a.years !== 0 || a.months !== 0 || a.weeks !== 0 || b.years !== 0 || b.months !== 0 || b.weeks !== 0) {
    temporalRangeError("Duration: comparing years, months or weeks needs a relativeTo date")
  }
  return temporalSpanOfDuration(a, true).plus(temporalSpanOfDuration(b, true).negated()).sign()
}

// ---------------------------------------------------------------------------
// Instant
// ---------------------------------------------------------------------------

/**
 * An exact point on the UTC timeline, to the nanosecond: `Temporal.Instant`.
 * It has no calendar and no time zone; `toString` writes it in UTC.
 */
export class Instant {
  /** Milliseconds since 1970-01-01T00:00:00Z, rounded toward negative infinity. */
  readonly epochMilliseconds: f64
  /** @internal Whole seconds since the epoch, rounded down; not part of Temporal. */
  readonly epochSeconds: i64
  /** @internal The nanoseconds past `epochSeconds`, 0 to 999,999,999; not part of Temporal. */
  readonly nanosecondOfSecond: i32

  /**
   * The instant `epochSeconds` seconds and `nanoseconds` nanoseconds after the
   * epoch. This is this module's constructor, not Temporal's, whose
   * `new Temporal.Instant(epochNanoseconds)` takes a `bigint`; use
   * `instantFromEpochMilliseconds` or `instantFrom` for a portable program.
   * Panics with a `RangeError` outside ±10^8 days of the epoch.
   *
   * @param epochSeconds whole seconds since the epoch
   * @param nanoseconds nanoseconds to add, of any sign below 2^53
   */
  constructor(epochSeconds: i64, nanoseconds: i64 = 0) {
    let seconds: i64 = epochSeconds
    let nanos: i64 = nanoseconds
    if (nanos < 0 || nanos >= TEMPORAL_NS_PER_SECOND) {
      seconds = seconds + temporalFloorDiv(nanos, TEMPORAL_NS_PER_SECOND)
      nanos = temporalFloorMod(nanos, TEMPORAL_NS_PER_SECOND)
    }
    if (!temporalInstantInRange(seconds, nanos)) {
      temporalRangeError("Instant: the instant is outside Temporal's range")
    }
    this.epochSeconds = seconds
    this.nanosecondOfSecond = toI32(nanos)
    this.epochMilliseconds = toF64(seconds * 1000 + toI64(nanos / 1000000))
  }

  /**
   * The instant in UTC as Temporal writes it: `2024-01-15T09:05:00Z`, with the
   * fraction of the second to as many digits as it needs.
   *
   * @returns the RFC 3339 form
   */
  toString(): string {
    const day: i64 = temporalFloorDiv(this.epochSeconds, TEMPORAL_SECONDS_PER_DAY)
    const secondOfDay: i64 = temporalFloorMod(this.epochSeconds, TEMPORAL_SECONDS_PER_DAY)
    const civil: i64 = temporalCivilOfEpochDay(day)
    const out: u8[] = new Array<u8>(TEMPORAL_TEXT_MAX)
    const year: i32 = temporalCivilYear(civil)
    const nanoOfDay: i64 = secondOfDay * TEMPORAL_NS_PER_SECOND + toI64(this.nanosecondOfSecond)
    let i: i32 = 0
    if (year >= 0 && year <= 9999) {
      const secs: i32 = toI32(secondOfDay)
      const minutes: i32 = toI32(secs / 60)
      i = temporalPutDateTime4(
        out,
        0,
        year,
        temporalCivilMonth(civil),
        temporalCivilDay(civil),
        toI32(minutes / 60),
        minutes % 60,
        secs - minutes * 60
      )
      i = temporalPutFraction(out, i, this.nanosecondOfSecond)
    } else {
      i = temporalPutDate(out, 0, year, temporalCivilMonth(civil), temporalCivilDay(civil))
      i = temporalPutNanoOfDay(out, temporalPutByte(out, i, 84), nanoOfDay)
    }
    return String.fromBytes(out, 0, temporalPutByte(out, i, 90))
  }

  /**
   * The same string as `toString`.
   *
   * @returns the RFC 3339 form
   */
  toJSON(): string {
    return this.toString()
  }

  /**
   * Whether `other` is the same instant.
   *
   * @param other the instant to compare with
   * @returns whether the two are equal
   */
  equals(other: Instant): boolean {
    return this.epochSeconds === other.epochSeconds && this.nanosecondOfSecond === other.nanosecondOfSecond
  }

  /**
   * This instant moved by `duration`, which may hold hours and smaller units
   * only: a day is not always 24 hours once a zone is involved, so Temporal
   * refuses days and larger units here, and so does this, with a `RangeError`.
   *
   * @param duration how far to move
   * @returns the new instant
   */
  add(duration: Duration): Instant {
    if (duration.years !== 0 || duration.months !== 0 || duration.weeks !== 0 || duration.days !== 0) {
      temporalRangeError("Instant: a duration with days or larger units cannot be added to an instant")
    }
    const span: TemporalSpan = temporalSpanOfDuration(duration, false)
    return new Instant(this.epochSeconds + span.seconds, toI64(this.nanosecondOfSecond) + toI64(span.nanos))
  }

  /**
   * This instant moved back by `duration`: `add` of its negation.
   *
   * @param duration how far to move back
   * @returns the new instant
   */
  subtract(duration: Duration): Instant {
    return this.add(duration.negated())
  }

  /**
   * The time from this instant to `other` in seconds and smaller units
   * (Temporal's default `largestUnit: "second"`).
   *
   * @param other the later instant
   * @returns the difference
   */
  until(other: Instant): Duration {
    return temporalBalance(temporalInstantSpan(this, other), TEMPORAL_UNIT_SECOND)
  }

  /**
   * The time from `other` to this instant: `other.until(this)`.
   *
   * @param other the earlier instant
   * @returns the difference
   */
  since(other: Instant): Duration {
    return temporalBalance(temporalInstantSpan(other, this), TEMPORAL_UNIT_SECOND)
  }
}

/** The span from `a` to `b`. */
const temporalInstantSpan = (a: Instant, b: Instant): TemporalSpan =>
  new TemporalSpan(b.epochSeconds - a.epochSeconds, toI64(b.nanosecondOfSecond) - toI64(a.nanosecondOfSecond))

/**
 * `Temporal.Instant.fromEpochMilliseconds(ms)`: the instant `ms` milliseconds
 * after 1970-01-01T00:00:00Z. Panics with a `RangeError` when `ms` is not a
 * whole number or is outside ±8.64 × 10^15.
 *
 * @param ms milliseconds since the epoch
 * @returns the instant
 */
export const instantFromEpochMilliseconds = (ms: f64): Instant => {
  if (ms !== Math.floor(ms) || ms > 8.64e15 || ms < -8.64e15) {
    temporalRangeError("Instant: epoch milliseconds must be a whole number within ±8.64e15")
  }
  const whole: i64 = toI64(ms)
  return new Instant(temporalFloorDiv(whole, 1000), temporalFloorMod(whole, 1000) * 1000000)
}

/**
 * `Temporal.Instant.from(text)`: the instant an RFC 9557 string names. It
 * must have a date, a time and either `Z` or a numeric offset, which is
 * subtracted (`2024-01-15T09:05+01:00` is `2024-01-15T08:05:00Z`); a
 * bracketed time zone after it is ignored. Panics with a `RangeError` on
 * anything else.
 *
 * @param text such as `2024-01-15T09:05:00Z`
 * @returns the instant
 */
export const instantFrom = (text: string): Instant => {
  const i: Instant | null = instantFromOrNull(text)
  if (i === null) {
    temporalRangeError(`Instant: cannot parse "${text}"`)
    return new Instant(0)
  }
  return i
}

/**
 * `instantFrom`, answering `null` instead of panicking on a string it
 * refuses. Not part of Temporal.
 *
 * @param text the string to parse
 * @returns the instant, or `null`
 */
export const instantFromOrNull = (text: string): Instant | null => {
  const length: i32 = toI32(text.length)
  const last: i32 = temporalCharAt(text, length - 1)
  // `Z`, or a `±HH:MM` offset, ends the string: the two forms RFC 3339 writes.
  let timeEnd: i32 = -1
  let offsetSeconds: i64 = 0
  if (last === 90 || last === 122) {
    timeEnd = length - 1
  } else {
    const sign: i32 = temporalCharAt(text, length - 6)
    const hours: i32 = temporalFastTwo(text, length - 5)
    const minutes: i32 = temporalFastTwo(text, length - 2)
    if (
      (sign === 43 || sign === 45) &&
      temporalCharAt(text, length - 3) === 58 &&
      hours >= 0 &&
      hours <= 23
    ) {
      if (minutes >= 0 && minutes <= 59) {
        timeEnd = length - 6
        offsetSeconds = toI64(hours * 3600 + minutes * 60) * (sign === 43 ? 1 : -1)
      }
    }
  }
  if (timeEnd >= 16 && temporalIsTimeDesignator(temporalCharAt(text, 10))) {
    const civil: i64 = temporalFastDate(text)
    const nanoOfDay: i64 = civil < 0 ? -1 : temporalFastTime(text, timeEnd)
    if (nanoOfDay >= 0) {
      const day: i64 = temporalEpochDay(
        temporalCivilYear(civil),
        temporalCivilMonth(civil),
        temporalCivilDay(civil)
      )
      return new Instant(
        day * TEMPORAL_SECONDS_PER_DAY + toI64(nanoOfDay / TEMPORAL_NS_PER_SECOND) - offsetSeconds,
        nanoOfDay % TEMPORAL_NS_PER_SECOND
      )
    }
  }
  const r: TemporalReader = temporalReadDateTime(text)
  if (!r.ok || !r.hasTime || (!r.utc && !r.hasOffset)) {
    return null
  }
  const day: i64 = temporalEpochDay(r.year, r.month, r.day)
  const seconds: i64 =
    day * TEMPORAL_SECONDS_PER_DAY + toI64(r.hour) * 3600 + toI64(r.minute) * 60 + toI64(r.second)
  // The offset is below a day, so its nanoseconds stay below 2^53.
  const nanos: i64 = toI64(r.fraction) - r.offsetNanos
  const exactSeconds: i64 = seconds + temporalFloorDiv(nanos, TEMPORAL_NS_PER_SECOND)
  const exactNanos: i64 = temporalFloorMod(nanos, TEMPORAL_NS_PER_SECOND)
  if (!temporalInstantInRange(exactSeconds, exactNanos)) {
    return null
  }
  return new Instant(exactSeconds, exactNanos)
}

/** Whether `seconds` and `nanos` (in `[0, 10^9)`) past the epoch are within Temporal's ±10^8 days. */
const temporalInstantInRange = (seconds: i64, nanos: i64): boolean => {
  const limit: i64 = TEMPORAL_MAX_EPOCH_DAY * TEMPORAL_SECONDS_PER_DAY
  return seconds >= -limit && seconds <= limit && !(seconds === limit && nanos > 0)
}

/**
 * `Temporal.Instant.compare(a, b)`: -1, 0 or 1 as `a` is before, the same as,
 * or after `b`.
 *
 * @param a the first instant
 * @param b the second instant
 * @returns the order of the two
 */
export const instantCompare = (a: Instant, b: Instant): i32 => temporalInstantSpan(b, a).sign()

/**
 * `Temporal.Now.instant()`: the wall clock now, to the nanosecond the
 * operating system reports. Capability: clock.
 *
 * @returns the current instant
 */
export const nowInstant = (): Instant => {
  const ns: i64 = wallClockNanos()
  return new Instant(
    temporalFloorDiv(ns, TEMPORAL_NS_PER_SECOND),
    temporalFloorMod(ns, TEMPORAL_NS_PER_SECOND)
  )
}
