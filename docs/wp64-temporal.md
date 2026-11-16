# WP64: Temporal — dates, times and time zones, as TC39 specifies them

**Status: S1 built** (`std/temporal.ts`, `nish/temporal`: the ISO 8601 core).
S2 to S6 are designed here and not built. [LANGUAGE.md](LANGUAGE.md) stays
normative. Research was done in November 2026, and every claim in §2 names its
primary source.

**The decision: Nish's date and time library is TC39's `Temporal`, not a
design of its own.** It reached Stage 4 in March 2026 for ES2027. It ships in
Firefox 139, Chrome 144 and Node 26, the Node CI pins. Its core needs no locale
data. A Nish program has to run under Node unchanged, so the only API that can
be both native and portable is the one Node already has. Every other library
surveyed (§2) either wraps the host's ICU or invents its own surface.

## 1. Why

Today the clock is all there is. `Date.now()`, `wallClockNanos()` and
`monotonicNanos()` answer numbers, and `new Date()` is refused under NL2401.
LANGUAGE.md gives the reason: "a program that formats a date needs a calendar,
a time zone database and a locale, none of which this language has". That is
true of `Date`. It is not true of `Temporal`, whose ISO-calendar half is
integer arithmetic plus, for zones, the TZif files every Unix already ships
(§3). A server that writes a log timestamp, a CLI that parses `--since
2024-01-15`, or a job that runs "the last day of each month" needs exactly
that half.

## 2. The field

| Library | Model | Time zones from | What it shows |
| --- | --- | --- | --- |
| **TC39 Temporal** ([proposal](https://github.com/tc39/proposal-temporal)) | Eight immutable types: `Instant`, `ZonedDateTime`, `PlainDate`, `PlainTime`, `PlainDateTime`, `PlainYearMonth`, `PlainMonthDay` and `Duration`, plus the `Now` namespace | The engine (IANA names required with ECMA-402) | Exact time and wall time kept apart; strings are RFC 9557 |
| **temporal_rs** ([boa-dev/temporal](https://github.com/boa-dev/temporal)) | Temporal in Rust, used by V8, Boa and Kiesel; `i128` epoch nanoseconds | Pluggable: host TZif files, embedded TZif or ICU's `zoneinfo64` | A native Temporal is practical; slim TZif needs the POSIX footer for future dates (`docs/TZDB.md`) |
| **Jiff** ([BurntSushi/jiff](https://github.com/BurntSushi/jiff), 1.0 on 2026-11-15) | Temporal-inspired: `Timestamp`, `ZonedDateTime`, `civil::{Date, Time, DateTime}`, `Span` and `SignedDuration`; `{i64 s, i32 ns}` | `/usr/share/zoneinfo` (`TZDIR`, `TZ`), or a bundle of about 207 KB | The tz layering this note copies; it documents its differences from Temporal (±9999 years, Gregorian only) |
| **Go `time`** ([pkg.go.dev/time](https://pkg.go.dev/time)) | `Time` holds wall and monotonic readings; `Duration` is `int64` ns (about 290 years) | `ZONEINFO`, system directories, then embedded `time/tzdata` (+450 KB) | Monotonic and wall clocks in one value is a trap Temporal avoids; layout-string formatting |
| **java.time** (JSR-310) | `Instant`, `Local*`, `ZonedDateTime`; `Duration` against `Period` | `lib/tzdb.dat` | Temporal's ancestor: `ofLocal`'s gap and overlap rules are `compatible` |
| **chrono** (Rust) | `Naive*` and `DateTime<Tz>` | None of its own; `chrono-tz` generates code from IANA | The type split works; tz as code bloats |
| **date-fns** v4 ([date-fns](https://github.com/date-fns/date-fns)) | 200+ pure functions over the mutable `Date` | `@date-fns/tz`, by formatting with `Intl` and parsing the offset back | Tiny, but a date is a midnight instant, and correctness is the host ICU's |
| **Luxon** and **Day.js** | Immutable `DateTime` and a Moment-compatible API | `Intl`, "abused horribly" (Luxon's own words) | Without their own data, JS libraries inherit the host's |
| **js-joda** | A port of java.time | Embeds IANA data | The closest JS analogue to a native design |
| **Hinnant's `date`** and C++20 `<chrono>` | `days_from_civil` and `civil_from_days` over 400-year eras | `tzdb` | The algorithm S1 uses |

What every native design converged on:

- **Exact time and wall time are separate types.** That split removes the
  "date stored as a midnight instant" class of bugs.
- **Time zones are layered.** The system's TZif files come first, then a
  POSIX TZ rule for instants past the file's last transition, then an
  optional embedded copy of the database.
- **Integers, never floats.** Seconds and nanoseconds, or one wide nanosecond
  count.

### What Temporal asks of an implementation

- **Calendars and zones are strings.** The 2024 reduction
  ([#2826](https://github.com/tc39/proposal-temporal/issues/2826)) removed
  `Temporal.Calendar` and `Temporal.TimeZone`. Only `iso8601` is mandatory,
  and an implementation without ECMA-402 may support only the `UTC` zone.
  A staged rollout is therefore within the specification.
- **Ranges.** An `Instant` is a BigInt of nanoseconds within ±8.64 × 10^21,
  that is ±10^8 days. A `PlainDateTime` may go one day past that either way.
  A `Duration` is ten integer fields: years, months and weeks below 2^32, and
  the rest below 2^53 seconds in total.
- **Strings** are ISO 8601 with RFC 3339 offsets and RFC 9557 annotations.
  A year is four digits, or a sign and six (never `-000000`). Second 60 reads
  as 59. A critical (`!`) unknown annotation is a `RangeError`. The `Plain*`
  types refuse `Z`.
- **Arithmetic.** `add` constrains a day past the month's end. `until` and
  `since` truncate, and their default largest unit depends on the type: day,
  hour or second. `Duration.add` refuses years, months and weeks.
  `ZonedDateTime` adds date units on wall time and time units on exact time
  (RFC 5545). A wall time in a gap or an overlap resolves by
  `disambiguation`, `compatible` by default: later in a gap, earlier in an
  overlap.
- **ICU is needed only** for `toLocaleString`, non-ISO calendars and
  localized zone names. Everything else is integers and the tz database.

## 3. What Nish can build

The ISO calendar, every type, parsing and `toString`, every arithmetic
method, offset zones, and IANA zones read from the system's TZif files:
everything but the ICU column. No C is needed for any of it, because a
library written in Nish can do the whole job. `nish:fs` reads the TZif files,
and `wallClockNanos` (`CLOCK_REALTIME`) gives `Now`.

## 4. How the API maps onto Nish

Temporal's API is shaped by JavaScript in six ways Nish does not have. Each
needs an answer that keeps a program valid TypeScript and correct under Node's
real `Temporal`.

| Temporal uses | Nish today | S1's answer | The full answer, and its stage |
| --- | --- | --- | --- |
| `Temporal.PlainDate.from(s)`: a namespace and `static` members | No namespaces, no `static` (`reject_cls_static`) | Free functions named after the class: `plainDateFrom`, `plainDateCompare` | S2: the global `Temporal`, bound by the compiler as `Math.atan2` is bound to `std/math.ts` (`Checker.importMath`): a dotted local the scan imports from `nish/temporal` |
| `d.year`, `d.dayOfWeek`: prototype getters | No getters (`reject_cls_accessor`) | `readonly` fields computed by the constructor, so a read is the same syntax | Kept: a field read is what a getter read compiles to |
| `add(d: Duration \| DurationLike \| string)`: unions | Only `T \| null` | One parameter type, `Duration` | S2 accepts a string literal argument by parsing it at compile time; S4 adds the object form |
| `{ largestUnit: "year" }`, `with({ day: 1 })`: option bags with optional fields | An object literal must set every field | Not offered; each method takes Temporal's defaults | S4: an *option interface*, whose fields have initializers and may be left out of a literal; open question OQ1 |
| `epochNanoseconds: bigint` | No `bigint` value | Leaving it out: `epochMilliseconds` (`f64`) and this module's `epochSeconds` and `nanosecondOfSecond` | OQ4 |
| `throw new RangeError(...)` | No `throw` | A panic whose message starts `RangeError:`, plus `...OrNull` parses | Kept; S2 documents it in LANGUAGE.md as the one way the builtin fails |

An integer division in the module is written `toI64(a / b)`, which truncates
under Node as the native `sdiv` does. Every value divided stays below 2^53,
so Node's doubles hold it exactly. That is why the module reads the same
under Node, and `check.mjs` relies on it (§7).

## 5. Representation

- **`PlainDate`** holds the year, month and day as `i32`, every derived field
  Temporal has a getter for, and its epoch day as `i64`. The conversions are
  Hinnant's `days_from_civil` and `civil_from_days`, which are exact for every
  proleptic Gregorian year with floor division.
- **`PlainTime`** holds six `i32` fields and its nanosecond of the day.
- **`PlainDateTime`** holds both sets.
- **`Instant`** holds `i64` seconds and an `i32` nanosecond, as Jiff, Go and
  chrono do. This covers Temporal's ±10^8 days without the 74 bits one
  nanosecond count would need, or the `i128` temporal_rs uses.
- **`Duration`** holds ten `i64` fields. That matches Temporal for years
  through milliseconds. For microseconds and nanoseconds alone it is narrower,
  because Temporal allows up to 2^53 seconds' worth of them (OQ3).
- **Inside the module**, a length of time is a `TemporalSpan` of seconds and
  a nanosecond remainder, so `until` across 500,000 years is exact.

## 6. Stages

Each stage is one PR.

1. **S1: the ISO core as `nish/temporal`** (this PR).
   - The types are `PlainDate`, `PlainTime`, `PlainDateTime`, `Duration` and
     `Instant`. Each has `from` (with an `...OrNull` twin), `compare`,
     `equals`, `toString`, `toJSON`, `add`, `subtract`, `until` and `since`,
     with Temporal's defaults. `Duration` also has `negated` and `abs`.
     `Instant` also has `fromEpochMilliseconds` and `Now.instant()` (as
     `nowInstant`).
   - It lands with `tests/link/std_temporal`: 179 cases, held natively to
     `expected.out` and by `check.mjs` to Node's own `Temporal`.
2. **S2: the global `Temporal`.**
   - The checker binds `Temporal.PlainDate.from(...)`, `new
     Temporal.PlainDate(...)`, `Temporal.Now.instant()` and the rest to
     `nish/temporal`'s functions and classes, as it binds `Math.atan2`.
   - A dotted type reference, `Temporal.PlainDate`, is accepted where today
     only an enum member may be named with a dot.
   - `runtime/nish.d.ts` declares the subset for `tsc`.
   - A call outside the subset (an option bag, an object argument) is a
     diagnostic that names the supported spelling.
   - The differential corpus gains programs that use the global, which run
     natively and under Node's real `Temporal`, so the oracle is the engine
     itself.
   - It also ships the LANGUAGE.md rule, the cookbook entry and the guide
     page for the builtin.
3. **S3: `ZonedDateTime` and time zones.**
   - A TZif v1–v4 reader (RFC 9636) over `$TZDIR` or `/usr/share/zoneinfo`,
     the POSIX TZ footer rule for instants past the last transition (with its
     inverted signs and southern-hemisphere wrap), and offset zones.
   - `Temporal.Now.timeZoneId()` reads `$TZ` or the `/etc/localtime` link,
     with `UTC` as the fallback.
   - `disambiguation` and `offset` are resolved as `DisambiguatePossibleEpochNanoseconds`
     does, with wall-time date units and exact-time time units.
   - Reading a file named by `$TZ` is attacker-facing, so this stage lands
     with its `docs/security/` record and a fuzz corpus of malformed TZif
     files.
   - It adds the `fs.read` and `env` capabilities to any program that names a
     zone.
4. **S4: option bags.** `until`/`since` with
   `largestUnit`/`smallestUnit`/`roundingIncrement`/`roundingMode` (nine modes;
   calendar units balanced against the receiver), `round`, `total`, `with`, and
   the `overflow: "reject"` choice. It depends on the language deciding OQ1.
5. **S5: `PlainYearMonth`, `PlainMonthDay`, and `toLocaleString`.**
   `toLocaleString` falls back to `toString`, which ECMA-262 permits for an
   implementation without ECMA-402.
6. **S6: the wasm profile and an embedded database.** A page module has no
   files, so a build flag embeds slim TZif for every zone (about 200 KB, as
   Jiff's bundle is), or only for the zones the program names, as a
   `--deterministic` build may have to (OQ2).

## 7. Tests

`tests/link/std_temporal/vectors.ts` is one table of cases
(`operation|a|b`). `main.ts` answers each one natively, and the link loop holds
the output to `expected.out`. `check.mjs` reads the same table and answers each
case with the engine's `Temporal`, and `tests/run.js` holds that to the same
`expected.out`. So every line is what both this module and the
specification's engine say. Under a Node without `Temporal` (before 26), the
check skips and names the Node it ran under.

The cases cover:

- the grammar: basic and extended forms, the six-digit years and their range
  ends, `-000000`, leap seconds, annotations critical and not, and the
  ambiguous bare times (`1230`, `0230`, `2021-12`);
- the ISO week at both ends of a year, including week 53 of 2020 and of
  year −2;
- month-end constraining, days carried from time fields, and negative and zero
  differences;
- `Duration` fractions on hours, minutes and seconds, and its unbalanced
  fields;
- the `Instant` range to the nanosecond at both ends.

Three checks were made outside CI:

- the date fields, day differences and epoch milliseconds were checked against
  Python's `datetime` for every year it can hold;
- the module was run under Node, by type stripping, with `judge` given the
  module itself in place of `Temporal`, and gave the same 179 lines;
- every case gives the same answers under `--number-mode f64`.

## 8. Where S1 differs from Temporal

These are all recorded on the guide page.

- **Calendars.** Any calendar but `iso8601` is refused. Temporal with ECMA-402
  accepts `gregory`, `japanese` and the rest.
- **Missing:** a `bigint` `epochNanoseconds`, `new Instant(bigint)`,
  `ZonedDateTime`, `PlainYearMonth`, `PlainMonthDay`, option bags, and
  `valueOf` (which throws in Temporal: Nish has no implicit conversion to
  call it).
- **Narrower ranges.** `Duration`'s microseconds and nanoseconds are limited
  to `i64`.
- **The `Instant` constructor** is this module's (seconds and nanoseconds),
  not Temporal's.
- **Methods take only an object.** `add`, `until` and the rest take a
  `Duration` or a `Plain*`, not a string or a property bag.
- **Errors panic.** A `RangeError` is a panic, which a program cannot catch.
  The `...OrNull` parses are the way to handle bad input.

## 9. Open questions

- **OQ1: option bags in the language.** An interface field with an
  initializer could be left out of an object literal, which would give
  Temporal's `{ largestUnit: "year" }` a layout. The alternative is a
  Nish-only spelling (`untilIn(other, "year")`), which is not portable. The
  first is a language change with its own LANGUAGE.md rule. It would also
  serve every `std/` options type.
- **OQ2: embed the tz database by default?** Go and Jiff embed only on
  request, and temporal_rs makes it a feature. A `--deterministic` build
  cannot read the host's files and stay deterministic, so it must embed or
  refuse IANA zones.
- **OQ3: `Duration`'s field width.** `i64` is exact and simple. Temporal's
  float64 fields allow a nanoseconds field up to 9 × 10^24, which no
  realistic program writes. Widening would cost the constructor and
  `toString` an `i128` or a pair.
- **OQ4: `epochNanoseconds` without `bigint`.** An `i64` field
  (`epochNanosecondsI64`, ±292 years) is cheap, but under Node it would not be
  the `bigint` Temporal answers. A string (`"1705309500000000000"`) would be
  portable, but awkward to use.
- **OQ5: `RangeError` as a panic.** A program reading dates from its input
  wants a `Result`. The `...OrNull` functions answer that for parsing.
  Constructors and arithmetic panic, as an out-of-range index does.
