# WP64: Temporal — dates, times and time zones

**State:** In progress · **Done:** 1 of 6 · **Design note:** [`docs/wp64-temporal.md`](https://github.com/amritk/nish/blob/main/docs/wp64-temporal.md)

## Stages

- [x] S1: the ISO core as `nish/temporal`: `PlainDate`, `PlainTime`, `PlainDateTime`, `Duration` and `Instant` with Temporal's parsing, strings and default arithmetic, every case checked against Node's own `Temporal`
- [ ] S2: the global `Temporal`: the checker binds `Temporal.X.from`, `new Temporal.X` and `Temporal.Now` to `nish/temporal`, a dotted type name, `runtime/nish.d.ts`, the differential corpus under Node's `Temporal`, and the language rule and guide page
- [ ] S3: `ZonedDateTime` and IANA time zones from the system's TZif files and their POSIX rules, `Temporal.Now.timeZoneId`, and the security record
- [ ] S4: option bags: `largestUnit`, `smallestUnit` and rounding for `until`/`since`, `round`, `total`, `with` *(open question)*
- [ ] S5: `PlainYearMonth`, `PlainMonthDay`, and `toLocaleString` as `toString`
- [ ] S6: the wasm profile and an embedded time zone database

## Next

S2: [§6](https://github.com/amritk/nish/blob/main/docs/wp64-temporal.md#6-stages). S3 does not depend on S2 and can land first.

## Open questions

How option bags get a layout (OQ1), whether the time zone database is embedded by default (OQ2), `Duration`'s field width (OQ3), `epochNanoseconds` without `bigint` (OQ4), and whether a `RangeError` stays a panic (OQ5). [§9](https://github.com/amritk/nish/blob/main/docs/wp64-temporal.md#9-open-questions).

## Not planned

Non-ISO calendars and localized formatting, which need ICU's data; leap seconds, which Temporal does not model either.

[All work packages](index.md)
