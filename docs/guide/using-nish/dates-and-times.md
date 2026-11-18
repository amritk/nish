# Dates and times

`nish/temporal` gives Nish dates, times of day, exact instants and durations,
under the names and the rules of JavaScript's
[`Temporal`](https://tc39.es/proposal-temporal/docs/). A program that uses it
reads them the same way natively and under Node. It is written in Nish and
imported like any other library module
([`export` and `import`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#export-and-import)).
Its reference is [`nish/temporal`](../../reference/temporal.md).

The language has no `Date` object: `Date.now()` is the only member it keeps
([the clock](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#the-host-the-wall-clock-entropy-file-times-and-signals)).
For anything beyond a timestamp in milliseconds, use this module.

## Five types

| Type | Holds | Writes as |
| --- | --- | --- |
| `PlainDate` | a calendar date, no time, no zone | `2024-01-15` |
| `PlainTime` | a time of day | `09:05:00.25` |
| `PlainDateTime` | both, still with no zone | `2024-01-15T09:05:00` |
| `Instant` | an exact point in time, to the nanosecond | `2024-01-15T09:05:00Z` |
| `Duration` | years down to nanoseconds, each field signed | `P1Y2M3DT4H` |

Every value is immutable: `add` answers a new date rather than changing the one
it was called on. The calendar is ISO 8601, the proleptic Gregorian one that
`toString` writes.

<!-- nish:ok -->
```ts
import { Duration, plainDateFrom, PlainDate } from "nish/temporal";

export const main = (): number => {
  const due: PlainDate = plainDateFrom("2024-01-31");
  const next: PlainDate = due.add(new Duration(0, 1)); // one month
  console.log(next.toString()); // 2024-02-29
  console.log(`${next.dayOfWeek} ${next.weekOfYear} ${next.inLeapYear}`); // 4 9 true
  console.log(due.until(next).toString()); // P29D
  return 0;
};
```

Adding a month to 31 January gives the last day of February rather than an
error: a day past the end of the new month moves back to its last day. That is
Temporal's `overflow: "constrain"`, the default.

## Reading and writing strings

Each type has a function that reads it, named after the type:
`plainDateFrom`, `plainTimeFrom`, `plainDateTimeFrom`, `durationFrom` and
`instantFrom`. In JavaScript the same calls are `Temporal.PlainDate.from` and
so on. Nish classes have no `static` members, so here they are functions.

The strings are ISO 8601 with RFC 3339's offsets and RFC 9557's annotations,
exactly as Temporal reads them:

- **Dates** are `2024-01-15`, `20240115`, or a year past four digits with a
  sign, as in `+012345-01-15`.
- **Date-times** use `T`, `t` or a space before the time.
- **Fractions** of a second take up to nine digits after `.` or `,`.
- **An `Instant`** needs `Z` or an offset: `2024-01-15T09:05+01:00`.
- **A `Duration`** is `P1Y2M3W4DT5H6M7.5S`, and its last time field may have a
  fraction, as in `PT1.5H`.

A string that Temporal refuses is a panic whose message starts `RangeError:`.
To read input you do not trust, use the `...OrNull` twin, which answers `null`
instead:

<!-- nish:ok -->
```ts
import { PlainDate, plainDateFromOrNull } from "nish/temporal";

export const main = (): number => {
  const inputs: string[] = ["2024-02-29", "2023-02-29", "2024-01-15T12:00Z"];
  for (const text of inputs) {
    const d: PlainDate | null = plainDateFromOrNull(text);
    console.log(d === null ? `${text}: not a date` : `${text}: ${d.toString()}`);
  }
  return 0;
};
```

The last input is refused because a `Z` names an exact time in UTC, and a
`PlainDate` has no zone to read one into.

## Arithmetic and differences

Here is what `add` and `subtract` do to each type:

- **`PlainDate`** moves by the years and months first, constraining the day,
  then by the weeks and days. Time fields count only as whole days.
- **`PlainTime`** wraps past midnight and ignores days.
- **`PlainDateTime`** moves the time first, carrying whole days into the date.
- **`Instant`** takes hours and smaller units only, because a day is not
  always 24 hours once a zone is involved.

`until` and `since` answer a `Duration` in the units Temporal's default
gives: days for a date or a date-time, hours for a time, and seconds for an
instant.

<!-- nish:ok -->
```ts
import { durationFrom, instantFrom, plainDateTimeFrom } from "nish/temporal";

export const main = (): number => {
  const start = plainDateTimeFrom("2024-01-15T09:00");
  const end = start.add(durationFrom("PT39H30M"));
  console.log(end.toString()); // 2024-01-17T00:30:00
  console.log(start.until(end).toString()); // P1DT15H30M

  const sent = instantFrom("2024-01-15T09:05:00Z");
  const seen = instantFrom("2024-01-15T10:06:01.5+01:00");
  console.log(sent.until(seen).toString()); // PT61.5S
  return 0;
};
```

Each type also has `equals` and a `compare` function (`plainDateCompare`, and
so on) that answers -1, 0 or 1, which is the comparator an array's `sort` takes.
Durations add with `add`, which balances the result up to the larger of the
two's largest unit (`P1D` plus `PT25H` is `P2DT1H`). A duration with years,
months or weeks cannot be added or compared that way, because how long a
month is depends on which one.

## The current time

`nowInstant()` is `Temporal.Now.instant()`: the wall clock, to the nanosecond
the system reports. It needs the `clock` capability, as `Date.now()` does.
`instantFromEpochMilliseconds(Date.now())` gives the same instant to the
millisecond.

## What it does not do yet

These parts of `Temporal` are not in this module yet:

- **Time zones.** There is no `ZonedDateTime`, and no zone but UTC. An
  `Instant` writes itself in UTC, and an offset in a string is applied to it,
  but a bracketed zone such as `[Europe/Paris]` is read and then ignored.
- **The global `Temporal`.** You import the classes and functions; you cannot
  write `Temporal.PlainDate.from(...)`.
- **Option bags.** `until` with `{ largestUnit: "year" }`, `round`, `total`
  and `with` are missing. Each method uses Temporal's defaults.
- **Other calendars.** Only `iso8601` is read: a `[u-ca=japanese]` annotation
  is refused by `plainDateFrom` and `plainDateTimeFrom`. `instantFrom` and
  `plainTimeFrom` ignore it, as Temporal does, because neither type holds a
  calendar.
- **`PlainYearMonth`, `PlainMonthDay` and `toLocaleString`.**
- **`epochNanoseconds`,** which is a `bigint` in JavaScript. An `Instant` has
  `epochMilliseconds`.
- **The constructors** of the `Plain*` types and `Duration` match Temporal's.
  `new Instant(seconds, nanoseconds)` is this module's own, so build an
  instant with `instantFrom` or `instantFromEpochMilliseconds` in a program
  meant to run under Node too.
