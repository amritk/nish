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

/** `a / b` rounded toward negative infinity, for `b > 0`. */
const temporalFloorDiv = (a: i64, b: i64): i64 => {
  const q: i64 = toI64(a / b)
  return q * b > a ? q - 1 : q
}

/** `a` modulo `b` in `[0, b)`, for `b > 0`. */
const temporalFloorMod = (a: i64, b: i64): i64 => a - temporalFloorDiv(a, b) * b

/** `a / b` rounded toward zero, for `b > 0`. */
const temporalTruncDiv = (a: i64, b: i64): i64 => toI64(a / b)

/** The magnitude of `a`. */
const temporalAbs = (a: i64): i64 => (a < 0 ? -a : a)

/** -1, 0 or 1 as `a` is negative, zero or positive. */
const temporalSign = (a: i64): i32 => {
  if (a < 0) {
    return -1
  }
  return a > 0 ? 1 : 0
}

/** `n` in decimal, left-padded with zeros to `width` digits; `n` is not negative. */
const temporalPad = (n: i64, width: i32): string => {
  let text: string = `${n}`
  while (toI32(text.length) < width) {
    text = `0${text}`
  }
  return text
}

/**
 * A year as Temporal writes it: four digits for 0 to 9999, otherwise a sign
 * and six digits.
 */
const temporalYearString = (year: i32): string => {
  if (year >= 0 && year <= 9999) {
    return temporalPad(toI64(year), 4)
  }
  return `${year < 0 ? "-" : "+"}${temporalPad(temporalAbs(toI64(year)), 6)}`
}

/**
 * `ns` nanoseconds of a second as Temporal's automatic precision writes them:
 * nothing for zero, otherwise a `.` and up to nine digits with the trailing
 * zeros dropped.
 */
const temporalFraction = (ns: i32): string => {
  if (ns === 0) {
    return ""
  }
  let digits: string = temporalPad(toI64(ns), 9)
  let end: i32 = 9
  while (end > 1 && toI32(digits.charCodeAt(end - 1)) === 48) {
    end = end - 1
  }
  digits = digits.substring(0, end)
  return `.${digits}`
}

/** Panic with Temporal's `RangeError`, naming `what`. */
const temporalRangeError = (what: string): void => {
  panic(`RangeError: ${what}`)
}

// ---------------------------------------------------------------------------
// The proleptic Gregorian calendar (Hinnant, "chrono-Compatible Low-Level Date
// Algorithms": days_from_civil and civil_from_days over 400-year eras).
// ---------------------------------------------------------------------------

/** Whether `year` is a leap year of the proleptic Gregorian calendar. */
const temporalIsLeapYear = (year: i64): boolean =>
  temporalFloorMod(year, 4) === 0 && (temporalFloorMod(year, 100) !== 0 || temporalFloorMod(year, 400) === 0)

/** The days in `month` (1 to 12) of `year`. */
const temporalDaysInMonth = (year: i64, month: i32): i32 => {
  if (month === 2) {
    return temporalIsLeapYear(year) ? 29 : 28
  }
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30
  }
  return 31
}

/** The days from 1970-01-01 to the given date, negative before it. */
const temporalEpochDay = (year: i64, month: i32, day: i32): i64 => {
  const y: i64 = month <= 2 ? year - 1 : year
  const era: i64 = temporalFloorDiv(y, 400)
  const yoe: i64 = y - era * 400
  const mp: i64 = toI64(month > 2 ? month - 3 : month + 9)
  const doy: i64 = temporalTruncDiv(153 * mp + 2, 5) + toI64(day) - 1
  const doe: i64 = yoe * 365 + temporalTruncDiv(yoe, 4) - temporalTruncDiv(yoe, 100) + doy
  return era * 146097 + doe - 719468
}

/** The days from 1 January of `year` to the given date, plus one. */
const temporalDayOfYear = (year: i64, month: i32, day: i32): i32 =>
  toI32(temporalEpochDay(year, month, day) - temporalEpochDay(year, 1, 1)) + 1

/** The ISO weekday of an epoch day: 1 for Monday to 7 for Sunday. */
const temporalDayOfWeek = (epochDay: i64): i32 => toI32(temporalFloorMod(epochDay + 3, 7)) + 1

/** How many ISO weeks `year` has: 53 when it starts on a Thursday, or is a leap year starting on a Wednesday. */
const temporalWeeksInYear = (year: i64): i32 =>
  temporalWeekdayOfDecember31(year) === 4 || temporalWeekdayOfDecember31(year - 1) === 3 ? 53 : 52

/** The weekday of 31 December of `year`, 0 for Sunday to 6 for Saturday. */
const temporalWeekdayOfDecember31 = (y: i64): i64 =>
  temporalFloorMod(y + temporalFloorDiv(y, 4) - temporalFloorDiv(y, 100) + temporalFloorDiv(y, 400), 7)

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

/** A date on an epoch day, after checking the day is inside Temporal's range. */
const temporalDateOfEpochDay = (epochDay: i64): PlainDate => {
  if (epochDay < TEMPORAL_MIN_EPOCH_DAY || epochDay > TEMPORAL_MAX_EPOCH_DAY) {
    temporalRangeError("PlainDate: the date is outside Temporal's range")
  }
  const z: i64 = epochDay + 719468
  const era: i64 = temporalFloorDiv(z, 146097)
  const doe: i64 = z - era * 146097
  const yoe: i64 = temporalTruncDiv(
    doe - temporalTruncDiv(doe, 1460) + temporalTruncDiv(doe, 36524) - temporalTruncDiv(doe, 146096),
    365
  )
  const doy: i64 = doe - (365 * yoe + temporalTruncDiv(yoe, 4) - temporalTruncDiv(yoe, 100))
  const mp: i64 = temporalTruncDiv(5 * doy + 2, 153)
  const day: i64 = doy - temporalTruncDiv(153 * mp + 2, 5) + 1
  const month: i64 = mp < 10 ? mp + 3 : mp - 9
  const year: i64 = yoe + era * 400 + (month <= 2 ? 1 : 0)
  return new PlainDate(toI32(year), toI32(month), toI32(day))
}

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
    this.seconds = seconds + temporalFloorDiv(nanos, TEMPORAL_NS_PER_SECOND)
    this.nanos = toI32(temporalFloorMod(nanos, TEMPORAL_NS_PER_SECOND))
  }

  /**
   * This span plus `other`.
   *
   * @param other the span to add
   * @returns the sum
   */
  plus(other: TemporalSpan): TemporalSpan {
    return new TemporalSpan(this.seconds + other.seconds, toI64(this.nanos) + toI64(other.nanos))
  }

  /**
   * This span negated.
   *
   * @returns the span of the same length in the other direction
   */
  negated(): TemporalSpan {
    return new TemporalSpan(-this.seconds, -toI64(this.nanos))
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
    return -temporalFloorDiv(magnitude.seconds, TEMPORAL_SECONDS_PER_DAY)
  }
}

/** The span of one field of `count` units, each `unitNanos` nanoseconds and `unitNanos <= 10^9` or a whole number of seconds. */
const temporalSpanOf = (count: i64, unitSeconds: i64, unitNanos: i64): TemporalSpan => {
  if (unitSeconds > 0) {
    return new TemporalSpan(count * unitSeconds, 0)
  }
  // A sub-second unit: split the count into whole seconds first, so that the
  // product stays below 2^53.
  const per: i64 = temporalTruncDiv(TEMPORAL_NS_PER_SECOND, unitNanos)
  return new TemporalSpan(temporalFloorDiv(count, per), temporalFloorMod(count, per) * unitNanos)
}

/** The time fields of `d` as one span; its days too, each 24 hours, when `withDays`. */
const temporalSpanOfDuration = (d: Duration, withDays: boolean): TemporalSpan => {
  let span: TemporalSpan = temporalSpanOf(d.hours, 3600, 0)
  span = span.plus(temporalSpanOf(d.minutes, 60, 0))
  span = span.plus(temporalSpanOf(d.seconds, 1, 0))
  span = span.plus(temporalSpanOf(d.milliseconds, 0, 1000000))
  span = span.plus(temporalSpanOf(d.microseconds, 0, 1000))
  span = span.plus(temporalSpanOf(d.nanoseconds, 0, 1))
  if (withDays) {
    span = span.plus(temporalSpanOf(d.days, TEMPORAL_SECONDS_PER_DAY, 0))
  }
  return span
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
      ms = s * 1000 + ms
    } else if (largest === TEMPORAL_UNIT_MICROSECOND) {
      us = s * 1000000 + ms * 1000 + us
      ms = 0
    } else {
      ns = s * 1000000000 + ms * 1000000 + us * 1000 + ns
      ms = 0
      us = 0
    }
  }
  const k: i64 = toI64(sign < 0 ? -1 : 1)
  return new Duration(0, 0, 0, days * k, hours * k, minutes * k, seconds * k, ms * k, us * k, ns * k)
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
  /** The index of the next character. */
  at: i32
  /** Whether the text has parsed so far. */
  ok: boolean
  /** The date read, when `hasDate`. */
  hasDate: boolean
  year: i32
  month: i32
  day: i32
  /** The time read, when `hasTime`; midnight otherwise. */
  hasTime: boolean
  hour: i32
  minute: i32
  second: i32
  /** The nanoseconds past `second`. */
  fraction: i32
  /** Whether a `Z` was read in the offset's place. */
  utc: boolean
  /** Whether a numeric offset was read, and its nanoseconds east of UTC. */
  hasOffset: boolean
  offsetNanos: i64
  /** Whether a bracketed time zone annotation was read. */
  hasZone: boolean

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
  }

  /**
   * The character code at `at + ahead`, or -1 past the end.
   *
   * @param ahead how far past `at` to look
   * @returns the code
   */
  peek(ahead: i32): i32 {
    const i: i32 = this.at + ahead
    if (i < 0 || i >= toI32(this.text.length)) {
      return -1
    }
    return toI32(this.text.charCodeAt(i))
  }

  /**
   * Whether the character `ahead` past `at` is a decimal digit.
   *
   * @param ahead how far past `at` to look
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
      this.at = this.at + 1
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
    let value: i32 = 0
    for (let i: i32 = 0; i < count; i++) {
      if (!this.digitAt(toI32(0))) {
        this.ok = false
        return 0
      }
      value = value * 10 + this.peek(toI32(0)) - 48
      this.at = this.at + 1
    }
    return value
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
    this.at = this.at + 1
    let value: i32 = 0
    let count: i32 = 0
    while (this.digitAt(toI32(0))) {
      if (count === 9) {
        this.ok = false
        return 0
      }
      value = value * 10 + this.peek(toI32(0)) - 48
      count = count + 1
      this.at = this.at + 1
    }
    while (count < 9) {
      value = value * 10
      count = count + 1
    }
    return value
  }

  /** Read a date: `YYYY-MM-DD`, `±YYYYYY-MM-DD`, or either without the dashes. */
  readDate(): void {
    const sign: i32 = this.peek(toI32(0))
    let year: i32 = 0
    if (sign === 43 || sign === 45) {
      this.at = this.at + 1
      year = this.digits(toI32(6))
      if (sign !== 43 && year === 0) {
        this.ok = false // -000000 is not a year
      }
      if (sign !== 43) {
        year = -year
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
          this.at = this.at + 1
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
      this.at = this.at + 1
      this.utc = true
      return
    }
    if (c !== 43 && c !== 45) {
      return
    }
    this.at = this.at + 1
    const hours: i32 = this.digits(toI32(2))
    let minutes: i32 = 0
    let seconds: i32 = 0
    let fraction: i32 = 0
    if (this.digitAt(toI32(0)) || this.peek(toI32(0)) === 58) {
      const extended: boolean = this.eat(toI32(58))
      minutes = this.digits(toI32(2))
      if ((extended && this.peek(toI32(0)) === 58) || (!extended && this.digitAt(toI32(0)))) {
        if (extended) {
          this.at = this.at + 1
        }
        seconds = this.digits(toI32(2))
        fraction = this.fractionDigits()
      }
    }
    if (hours > 23 || minutes > 59 || seconds > 59) {
      this.ok = false
      return
    }
    const total: i64 =
      (toI64(hours) * 3600 + toI64(minutes) * 60 + toI64(seconds)) * TEMPORAL_NS_PER_SECOND + toI64(fraction)
    this.hasOffset = true
    this.offsetNanos = c === 43 ? total : -total
  }

  /**
   * Read the bracketed annotations: at most one time zone, first, then
   * `key=value` pairs. A calendar other than `iso8601`, two calendars where
   * either is critical, and an unknown critical key each fail the parse.
   */
  readAnnotations(): void {
    let calendars: i32 = 0
    let criticalCalendar: boolean = false
    let first: boolean = true
    while (this.ok && this.eat(toI32(91))) {
      const critical: boolean = this.eat(toI32(33))
      const start: i32 = this.at
      while (!this.done() && this.peek(toI32(0)) !== 93) {
        this.at = this.at + 1
      }
      if (this.done() || this.at === start) {
        this.ok = false
        return
      }
      const body: string = this.text.substring(start, this.at)
      this.at = this.at + 1
      const eq: i32 = toI32(body.indexOf("="))
      if (eq < 0) {
        // A time zone: only first, and only once.
        if (!first) {
          this.ok = false
          return
        }
        this.hasZone = true
      } else {
        const key: string = body.substring(0, eq)
        const value: string = body.substring(eq + 1, toI32(body.length))
        if (!temporalIsAnnotationKey(key) || value.length === 0) {
          this.ok = false
          return
        }
        if (key === "u-ca") {
          calendars = calendars + 1
          criticalCalendar = criticalCalendar || critical
          if (calendars === 1 && !temporalIsIsoCalendar(value)) {
            this.ok = false
            return
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
      this.at = this.at + 1
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

/** Whether `key` is an annotation key: a lowercase letter or `_`, then lowercase letters, digits, `_` or `-`. */
const temporalIsAnnotationKey = (key: string): boolean => {
  if (key.length === 0) {
    return false
  }
  for (let i: i32 = 0; i < toI32(key.length); i++) {
    const c: i32 = toI32(key.charCodeAt(i))
    const letter: boolean = (c >= 97 && c <= 122) || c === 95
    if (!letter && (i === 0 || !((c >= 48 && c <= 57) || c === 45))) {
      return false
    }
  }
  return true
}

/** Whether `value` is `iso8601` in any case. */
const temporalIsIsoCalendar = (value: string): boolean => {
  const want: string = "iso8601"
  if (value.length !== want.length) {
    return false
  }
  for (let i: i32 = 0; i < toI32(want.length); i++) {
    let c: i32 = toI32(value.charCodeAt(i))
    if (c >= 65 && c <= 90) {
      c = c + 32
    }
    if (c !== toI32(want.charCodeAt(i))) {
      return false
    }
  }
  return true
}

/**
 * Whether the date `r` read is inside Temporal's range: a date from
 * -271821-04-19 to +275760-09-13, and with `withTime`, a date-time after
 * -271821-04-19T00:00. The reader has already checked the fields.
 */
const temporalReadInRange = (r: TemporalReader, withTime: boolean): boolean => {
  const day: i64 = temporalEpochDay(toI64(r.year), r.month, r.day)
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
  /** The year; negative before 1 BCE's year 0. */
  readonly year: i32
  /** The month, 1 to 12. */
  readonly month: i32
  /** The day of the month, from 1. */
  readonly day: i32
  /** The month as Temporal codes it: `M01` to `M12`. */
  readonly monthCode: string
  /** The calendar, always `iso8601`. */
  readonly calendarId: string
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
  /** @internal The days since 1970-01-01; not part of Temporal. */
  readonly epochDay: i64

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
    const epochDay: i64 = temporalEpochDay(toI64(isoYear), isoMonth, isoDay)
    if (epochDay < TEMPORAL_MIN_EPOCH_DAY || epochDay > TEMPORAL_MAX_EPOCH_DAY) {
      temporalRangeError("PlainDate: the date is outside Temporal's range")
    }
    const y: i64 = toI64(isoYear)
    const doy: i32 = temporalDayOfYear(y, isoMonth, isoDay)
    const dow: i32 = temporalDayOfWeek(epochDay)
    let week: i32 = toI32(temporalTruncDiv(toI64(doy - dow + 10), 7))
    let weekYear: i32 = isoYear
    if (week < 1) {
      weekYear = isoYear - 1
      week = temporalWeeksInYear(y - 1)
    } else if (week > temporalWeeksInYear(y)) {
      weekYear = isoYear + 1
      week = 1
    }
    this.year = isoYear
    this.month = isoMonth
    this.day = isoDay
    this.monthCode = `M${temporalPad(toI64(isoMonth), 2)}`
    this.calendarId = "iso8601"
    this.dayOfWeek = dow
    this.dayOfYear = doy
    this.weekOfYear = week
    this.yearOfWeek = weekYear
    this.daysInWeek = 7
    this.daysInMonth = temporalDaysInMonth(y, isoMonth)
    this.daysInYear = temporalIsLeapYear(y) ? 366 : 365
    this.monthsInYear = 12
    this.inLeapYear = temporalIsLeapYear(y)
    this.epochDay = epochDay
  }

  /**
   * The date as Temporal writes it: `2024-01-15`, or `+012345-01-15` for a
   * year past 9999 or before 0.
   *
   * @returns the ISO 8601 form
   */
  toString(): string {
    return `${temporalYearString(this.year)}-${temporalPad(toI64(this.month), 2)}-${temporalPad(toI64(this.day), 2)}`
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
    let year: i64 = toI64(this.year) + duration.years
    let month: i64 = toI64(this.month) + duration.months
    year = year + temporalFloorDiv(month - 1, 12)
    month = temporalFloorMod(month - 1, 12) + 1
    if (year < -271821 || year > 275760) {
      temporalRangeError("PlainDate: the date is outside Temporal's range")
    }
    const most: i32 = temporalDaysInMonth(year, toI32(month))
    const day: i32 = this.day > most ? most : this.day
    const days: i64 = duration.weeks * 7 + duration.days + temporalSpanOfDuration(duration, false).truncDays()
    return temporalDateOfEpochDay(temporalEpochDay(year, toI32(month), day) + days)
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
  const r: TemporalReader = temporalReadDateTime(text)
  if (!r.ok || r.utc || !temporalReadInRange(r, false)) {
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
    this.nanoOfDay =
      (toI64(hour) * 3600 + toI64(minute) * 60 + toI64(second)) * TEMPORAL_NS_PER_SECOND +
      toI64(millisecond) * 1000000 +
      toI64(microsecond) * 1000 +
      toI64(nanosecond)
  }

  /**
   * The time as Temporal writes it: `09:05:00`, with the fraction of the
   * second to as many digits as it needs (`09:05:00.25`).
   *
   * @returns the ISO 8601 form
   */
  toString(): string {
    const sub: i32 = this.millisecond * 1000000 + this.microsecond * 1000 + this.nanosecond
    return `${temporalPad(toI64(this.hour), 2)}:${temporalPad(toI64(this.minute), 2)}:${temporalPad(toI64(this.second), 2)}${temporalFraction(sub)}`
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
 * without its `T` may not be. The test is the grammar's, not the calendar's:
 * `0230` is a month and day to it, though February has no 30th.
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
    return m >= 1 && m <= 12 && d >= 1 && d <= 31
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
  /** The year. */
  readonly year: i32
  /** The month, 1 to 12. */
  readonly month: i32
  /** The day of the month, from 1. */
  readonly day: i32
  /** The month as Temporal codes it: `M01` to `M12`. */
  readonly monthCode: string
  /** The calendar, always `iso8601`. */
  readonly calendarId: string
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
  /** Whether this date's year is a leap year. */
  readonly inLeapYear: boolean
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
  /** @internal The days since 1970-01-01; not part of Temporal. */
  readonly epochDay: i64
  /** @internal Nanoseconds since midnight; not part of Temporal. */
  readonly nanoOfDay: i64

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
    const time: PlainTime = new PlainTime(hour, minute, second, millisecond, microsecond, nanosecond)
    if (date.epochDay === TEMPORAL_MIN_EPOCH_DAY && time.nanoOfDay === 0) {
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
    this.nanoOfDay = time.nanoOfDay
  }

  /**
   * The date-time as Temporal writes it: `2024-01-15T09:05:00`, with the
   * fraction of the second to as many digits as it needs.
   *
   * @returns the ISO 8601 form
   */
  toString(): string {
    return `${this.toPlainDate().toString()}T${this.toPlainTime().toString()}`
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
    const span: TemporalSpan = temporalSpanOfDuration(duration, false)
    const carried: TemporalSpan = span.plus(new TemporalSpan(0, this.nanoOfDay))
    const carryDays: i64 = temporalFloorDiv(carried.seconds, TEMPORAL_SECONDS_PER_DAY)
    const nanoOfDay: i64 =
      temporalFloorMod(carried.seconds, TEMPORAL_SECONDS_PER_DAY) * TEMPORAL_NS_PER_SECOND +
      toI64(carried.nanos)
    const dateOnly: Duration = new Duration(
      duration.years,
      duration.months,
      duration.weeks,
      duration.days + carryDays
    )
    const date: PlainDate = this.toPlainDate().add(dateOnly)
    return date.toPlainDateTime(temporalTimeOfNanos(nanoOfDay))
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
  const r: TemporalReader = temporalReadDateTime(text)
  if (!r.ok || r.utc || !temporalReadInRange(r, true)) {
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
    let sign: i32 = 0
    const fields: i64[] = [
      years,
      months,
      weeks,
      days,
      hours,
      minutes,
      seconds,
      milliseconds,
      microseconds,
      nanoseconds,
    ]
    for (let i: i32 = 0; i < 10; i++) {
      const s: i32 = temporalSign(fields[i])
      if (s !== 0) {
        if (sign !== 0 && s !== sign) {
          temporalRangeError("Duration: the fields have mixed signs")
        }
        sign = s
      }
    }
    if (
      temporalAbs(years) >= TEMPORAL_MAX_CALENDAR_FIELD ||
      temporalAbs(months) >= TEMPORAL_MAX_CALENDAR_FIELD ||
      temporalAbs(weeks) >= TEMPORAL_MAX_CALENDAR_FIELD
    ) {
      temporalRangeError("Duration: years, months and weeks must each be below 2^32")
    }
    // Each field alone below the 2^53-second bound keeps the sum inside an i64.
    if (
      temporalAbs(days) > 104249991374 ||
      temporalAbs(hours) > 2501999792983 ||
      temporalAbs(minutes) > 150119987579016 ||
      temporalAbs(seconds) > TEMPORAL_MAX_DURATION_SECONDS
    ) {
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
    const total: TemporalSpan = temporalSpanOfDuration(this, true)
    const whole: i64 = total.sign() < 0 ? -total.negated().seconds : total.seconds
    if (temporalAbs(whole) > TEMPORAL_MAX_DURATION_SECONDS) {
      temporalRangeError("Duration: the time fields come to 2^53 seconds or more")
    }
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
    let date: string = ""
    if (this.years !== 0) {
      date = `${date}${this.years * k}Y`
    }
    if (this.months !== 0) {
      date = `${date}${this.months * k}M`
    }
    if (this.weeks !== 0) {
      date = `${date}${this.weeks * k}W`
    }
    if (this.days !== 0) {
      date = `${date}${this.days * k}D`
    }
    let time: string = ""
    if (this.hours !== 0) {
      time = `${time}${this.hours * k}H`
    }
    if (this.minutes !== 0) {
      time = `${time}${this.minutes * k}M`
    }
    const secs: TemporalSpan = temporalSpanOf(this.seconds * k, 1, 0)
      .plus(temporalSpanOf(this.milliseconds * k, 0, 1000000))
      .plus(temporalSpanOf(this.microseconds * k, 0, 1000))
      .plus(temporalSpanOf(this.nanoseconds * k, 0, 1))
    const zeroAbove: boolean =
      this.years === 0 &&
      this.months === 0 &&
      this.weeks === 0 &&
      this.days === 0 &&
      this.hours === 0 &&
      this.minutes === 0
    if (secs.sign() !== 0 || zeroAbove) {
      time = `${time}${secs.seconds}${temporalFraction(secs.nanos)}S`
    }
    return `${this.sign < 0 ? "-" : ""}P${date}${time.length > 0 ? "T" : ""}${time}`
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
    const beforeFraction: i32 = r.at
    const fraction: i32 = r.fractionDigits()
    const sawFraction: boolean = r.at !== beforeFraction
    const unit: i32 = r.peek(toI32(0)) | 32 // lowercased
    r.at = r.at + 1
    const slot: i32 = temporalDurationSlot(unit, inTime)
    if (slot < 0 || slot <= rank || !r.ok) {
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
    const span: TemporalSpan = new TemporalSpan(epochSeconds, nanoseconds)
    const limit: i64 = TEMPORAL_MAX_EPOCH_DAY * TEMPORAL_SECONDS_PER_DAY
    if (span.seconds < -limit || span.seconds > limit || (span.seconds === limit && span.nanos > 0)) {
      temporalRangeError("Instant: the instant is outside Temporal's range")
    }
    this.epochSeconds = span.seconds
    this.nanosecondOfSecond = span.nanos
    this.epochMilliseconds = toF64(span.seconds * 1000 + toI64(span.nanos / 1000000))
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
    const date: PlainDate = temporalDateOfEpochDayUnchecked(day)
    const time: PlainTime = temporalTimeOfNanos(
      secondOfDay * TEMPORAL_NS_PER_SECOND + toI64(this.nanosecondOfSecond)
    )
    return `${date.toString()}T${time.toString()}Z`
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
 * The date on an epoch day that may be one past Temporal's last date — an
 * instant at the very end of the range, written in UTC, is on it. Only
 * `Instant.toString` asks for one.
 */
const temporalDateOfEpochDayUnchecked = (epochDay: i64): PlainDate =>
  temporalDateOfEpochDay(epochDay < TEMPORAL_MIN_EPOCH_DAY ? TEMPORAL_MIN_EPOCH_DAY : epochDay)

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
  const r: TemporalReader = temporalReadDateTime(text)
  if (!r.ok || !r.hasTime || (!r.utc && !r.hasOffset)) {
    return null
  }
  const day: i64 = temporalEpochDay(toI64(r.year), r.month, r.day)
  const seconds: i64 =
    day * TEMPORAL_SECONDS_PER_DAY + toI64(r.hour) * 3600 + toI64(r.minute) * 60 + toI64(r.second)
  const offset: TemporalSpan = new TemporalSpan(0, r.offsetNanos)
  const local: TemporalSpan = new TemporalSpan(seconds, toI64(r.fraction))
  const exact: TemporalSpan = local.plus(offset.negated())
  const limit: i64 = TEMPORAL_MAX_EPOCH_DAY * TEMPORAL_SECONDS_PER_DAY
  if (exact.seconds < -limit || exact.seconds > limit || (exact.seconds === limit && exact.nanos > 0)) {
    return null
  }
  return new Instant(exact.seconds, toI64(exact.nanos))
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
