// The HTTP date: `httpDateWrite` in `nish/net/http-fields`, which writes an
// IMF-fixdate (RFC 9110 §5.6.7) and reads no clock, and `HttpDate` in
// `nish/net/http1-server`, the cache that reads one and formats at most once a
// second. Three groups of checks:
//
// - **The writer**: fixed instants across the leap rules (2000 is a leap year,
//   2100 is not) to the last second a four-digit year can name; every day
//   from 1970 to 2400 against a calendar counted a day at a time; and every
//   refusal, each of which writes nothing.
// - **The cache**: a format per second however many calls, a second crossed
//   either way, the arena flat across both, and `pin` refusing what the
//   writer cannot name without changing anything.
// - **The clock**: unpinned, it reads `Date.now()`.
import { HTTP_DATE_LAST_SECOND, HTTP_DATE_SIZE, httpDateWrite } from "nish/net/http-fields";
import { HttpDate } from "nish/net/http1-server";
import { Suite } from "nish/testing";

// Instants in milliseconds since 1970, wider than an i32.
const LAST_OF_1999: i64 = 946684799000;
const FIRST_OF_2000: i64 = 946684800000;
const LEAP_DAY_2000: i64 = 951782400000;
const LEAP_DAY_2024: i64 = 1709164800000;
const LAST_OF_FEB_2100: i64 = 4107542399000;
const FIRST_OF_MAR_2100: i64 = 4107542400000;
/** 2026-10-16T08:11:54Z, the second the cache is pinned to, and its last millisecond and the next second. */
const PINNED_MS: i64 = 1792138314000;
const PINNED_LAST_MS: i64 = 1792138314999;
const NEXT_SECOND_MS: i64 = 1792138315000;

/** `bytes[at .. at + length)` as a string, one character a byte. */
const textOf = (bytes: u8[], at: i32, length: i32): string => {
  const parts: string[] = [];
  for (let k: i32 = at; k < at + length; k++) {
    parts.push(String.fromCharCode(toI32(bytes[k])));
  }
  return parts.join("");
};

/** The IMF-fixdate of `unixMs`, or "refused". */
const dateOf = (unixMs: i64): string => {
  const out: u8[] = new Array<u8>(HTTP_DATE_SIZE);
  return httpDateWrite(out, 0, unixMs / toI64(1000)) < 0 ? "refused" : textOf(out, 0, HTTP_DATE_SIZE);
};

/** The decimal number in `bytes[at .. at + digits)`. */
const numberAt = (bytes: u8[], at: i32, digits: i32): i32 => {
  let n: i32 = 0;
  for (let k: i32 = at; k < at + digits; k++) {
    n = n * 10 + (toI32(bytes[k]) - 48);
  }
  return n;
};

/** The days in `month` (1 to 12) of `year`, by the Gregorian rule. */
const daysIn = (year: i32, month: i32): i32 => {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
};

/** The first day from 1970-01-01 to 2399-12-31 the writer gets wrong, as text, or empty. */
const firstWrongDay = (): string => {
  const days: string = "SunMonTueWedThuFriSat";
  const months: string = "JanFebMarAprMayJunJulAugSepOctNovDec";
  const out: u8[] = new Array<u8>(HTTP_DATE_SIZE);
  let year: i32 = 1970;
  let month: i32 = 1;
  let day: i32 = 1;
  let weekday: i32 = 4;
  let index: i64 = 0;
  while (year < 2400) {
    // A second late in the day, so that the time of day is checked as well as the date.
    const seconds: i64 = index * toI64(86400) + toI64(86399);
    const end: i32 = httpDateWrite(out, 0, seconds);
    const want: string = `${days.substring(3 * weekday, 3 * weekday + 3)}, ${months.substring(3 * month - 3, 3 * month)}`;
    const got: string = `${textOf(out, 0, 3)}, ${textOf(out, 8, 3)}`;
    if (end !== HTTP_DATE_SIZE || got !== want || numberAt(out, 5, 2) !== day || numberAt(out, 12, 4) !== year || textOf(out, 16, 13) !== " 23:59:59 GMT") {
      return `${year}-${month}-${day}: ${textOf(out, 0, HTTP_DATE_SIZE)}`;
    }
    index = index + toI64(1);
    weekday = (weekday + 1) % 7;
    day = day + 1;
    if (day > daysIn(year, month)) {
      day = 1;
      month = month + 1;
      if (month > 12) {
        month = 1;
        year = year + 1;
      }
    }
  }
  return "";
};

export const dateChecks = (): i32 => {
  const t = new Suite("http date");

  // --- The writer ------------------------------------------------------------------------------
  t.eqStr("the epoch", dateOf(toI64(0)), "Thu, 01 Jan 1970 00:00:00 GMT");
  t.eqStr("the last second of 1999", dateOf(LAST_OF_1999), "Fri, 31 Dec 1999 23:59:59 GMT");
  t.eqStr("and the first of 2000", dateOf(FIRST_OF_2000), "Sat, 01 Jan 2000 00:00:00 GMT");
  t.eqStr("2000 is a leap year, divisible by 400", dateOf(LEAP_DAY_2000), "Tue, 29 Feb 2000 00:00:00 GMT");
  t.eqStr("2024 is one, divisible by 4", dateOf(LEAP_DAY_2024), "Thu, 29 Feb 2024 00:00:00 GMT");
  t.eqStr("a time of day", dateOf(PINNED_MS), "Fri, 16 Oct 2026 08:11:54 GMT");
  t.eqStr("2100 is not, divisible by 100: its 28 February", dateOf(LAST_OF_FEB_2100), "Sun, 28 Feb 2100 23:59:59 GMT");
  t.eqStr("is followed by 1 March", dateOf(FIRST_OF_MAR_2100), "Mon, 01 Mar 2100 00:00:00 GMT");
  t.eqStr("the last second a four-digit year can name", dateOf(HTTP_DATE_LAST_SECOND * toI64(1000)), "Fri, 31 Dec 9999 23:59:59 GMT");
  t.eqStr("every day from 1970 to 2399 agrees with a calendar counted a day at a time", firstWrongDay(), "");

  const out: u8[] = new Array<u8>(40);
  t.eqI32("written at an offset, it answers where it ends", httpDateWrite(out, 7, toI64(0)), toI32(36));
  t.eqStr("and the date is there", textOf(out, 7, HTTP_DATE_SIZE), "Thu, 01 Jan 1970 00:00:00 GMT");
  const untouched: u8[] = new Array<u8>(HTTP_DATE_SIZE);
  untouched.fill(toU8(120));
  const one: i64 = toI64(1);
  t.ok(
    "refused, with nothing written: a second before 1970",
    httpDateWrite(untouched, 0, toI64(-1)) === -1 && untouched[0] === toU8(120)
  );
  t.ok(
    "a second past the last one",
    httpDateWrite(untouched, 0, HTTP_DATE_LAST_SECOND + one) === -1 && untouched[0] === toU8(120)
  );
  t.ok("a negative offset", httpDateWrite(untouched, toI32(-1), toI64(0)) === -1 && untouched[0] === toU8(120));
  t.ok("an offset one byte short of the room", httpDateWrite(untouched, 1, toI64(0)) === -1 && untouched[1] === toU8(120));
  const short: u8[] = new Array<u8>(HTTP_DATE_SIZE - 1);
  t.eqI32("and a buffer one byte short", httpDateWrite(short, 0, toI64(0)), toI32(-1));

  // --- The cache -------------------------------------------------------------------------------
  const date = new HttpDate();
  t.eqI64("a new date has formatted nothing", date.formats(), toI64(0));
  t.ok("pin takes an instant", date.pin(PINNED_MS));
  t.eqStr("current() is the pinned second", textOf(date.current(), 0, HTTP_DATE_SIZE), "Fri, 16 Oct 2026 08:11:54 GMT");
  // The arena is read around the cache's own calls; what the checks build stays outside it.
  const next: u8[] = new Array<u8>(HTTP_DATE_SIZE);
  const back: u8[] = new Array<u8>(HTTP_DATE_SIZE);
  const before: i64 = Arena.used();
  for (let k: i32 = 0; k < 1000; k++) {
    date.current();
  }
  const afterLoop: i64 = date.formats();
  date.pin(PINNED_LAST_MS);
  date.current();
  const sameSecond: i64 = date.formats();
  date.pin(NEXT_SECOND_MS);
  next.set(date.current(), 0);
  const nextFormats: i64 = date.formats();
  date.pin(PINNED_MS);
  back.set(date.current(), 0);
  const moved: i64 = Arena.used() - before;
  t.eqI64("a thousand calls in that second format it once", afterLoop, toI64(1));
  t.eqI64("so does a later instant in the same second", sameSecond, toI64(1));
  t.eqStr("the next second is formatted", textOf(next, 0, HTTP_DATE_SIZE), "Fri, 16 Oct 2026 08:11:55 GMT");
  t.eqI64("once", nextFormats, toI64(2));
  t.eqStr("a clock stepped back is formatted too", textOf(back, 0, HTTP_DATE_SIZE), "Fri, 16 Oct 2026 08:11:54 GMT");
  t.eqI64("once more", date.formats(), toI64(3));
  t.ok(`and none of it moved the arena (${moved} bytes)`, moved === toI64(0));

  t.ok("pin refuses an instant before 1970", !date.pin(toI64(-1)));
  t.ok("and one past the last second", !date.pin((HTTP_DATE_LAST_SECOND + one) * toI64(1000)));
  t.ok(
    "and changes nothing: the date is the one pinned before",
    textOf(date.current(), 0, HTTP_DATE_SIZE) === "Fri, 16 Oct 2026 08:11:54 GMT" && date.formats() === toI64(3)
  );
  t.ok("it takes the last millisecond of the last second", date.pin(HTTP_DATE_LAST_SECOND * toI64(1000) + toI64(999)));
  t.eqStr("which is that second", textOf(date.current(), 0, HTTP_DATE_SIZE), "Fri, 31 Dec 9999 23:59:59 GMT");

  // --- The clock -------------------------------------------------------------------------------
  // One read: a second ending between two would format again and make the count 6.
  date.unpin();
  const clocked: u8[] = date.current();
  const now: string = textOf(clocked, 0, HTTP_DATE_SIZE);
  t.ok(
    "unpinned, it reads the clock: a date after this test was written",
    now !== "Fri, 31 Dec 9999 23:59:59 GMT" && numberAt(clocked, 12, 4) >= 2026 && now.endsWith(" GMT")
  );
  t.eqI64("formatted once for the change", date.formats(), toI64(5));
  return t.done();
};
