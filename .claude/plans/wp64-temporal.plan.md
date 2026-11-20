---
name: WP64 — Temporal, dates, times and time zones
overview: The ISO core ships as nish/temporal and is checked against Node's own Temporal. Left are the global Temporal, ZonedDateTime with IANA zones, option bags, PlainYearMonth and PlainMonthDay, and the wasm profile with an embedded time zone database.
roadmap: docs/roadmap/wp64-temporal.md
spec: docs/wp64-temporal.md
priority: 40
issue: 1870
stages:
  - id: s2-global
    title: WP64 S2 — the global Temporal bound to nish/temporal
    goal: Temporal.X.from, new Temporal.X and Temporal.Now resolve to nish/temporal, a dotted type name Temporal.PlainDate is accepted, and the differential corpus runs under Node's Temporal.
    verification: node tests/run.js temporal && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint
    status: pending
    issue: 1881
    todos:
      - id: s2-checker
        content: Bind the Temporal global to nish/temporal as Math.atan2 is bound and accept a dotted type reference in src/ — see WP64 S2 — the global Temporal bound to nish/temporal
        status: pending
      - id: s2-dts
        content: Declare the subset in runtime/nish.d.ts and diagnose calls outside it (an option bag, an object argument) naming the supported spelling — see WP64 S2 — the global Temporal bound to nish/temporal
        status: pending
      - id: s2-docs
        content: Add differential programs under Node's Temporal, the LANGUAGE.md rule, the cookbook entry and the guide page — see WP64 S2 — the global Temporal bound to nish/temporal
        status: pending
  - id: s3-zoned
    title: WP64 S3 — ZonedDateTime and IANA time zones with a security record
    goal: ZonedDateTime reads TZif v1 to v4 files and their POSIX footer rules, Temporal.Now.timeZoneId reads TZ or /etc/localtime, and the stage lands with its docs/security record and a malformed-TZif fuzz corpus.
    verification: node tests/run.js temporal && node scripts/security-scope.mjs && npm run lint
    status: pending
    todos:
      - id: s3-tzif
        content: Add a TZif v1 to v4 reader over TZDIR or /usr/share/zoneinfo with the POSIX footer rule and offset zones in std/temporal — see WP64 S3 — ZonedDateTime and IANA time zones with a security record
        status: pending
      - id: s3-zdt
        content: Add ZonedDateTime with disambiguation and offset resolution, Temporal.Now.timeZoneId and the fs.read and env capabilities — see WP64 S3 — ZonedDateTime and IANA time zones with a security record
        status: pending
      - id: s3-security
        content: Write the docs/security record and index row and the malformed-TZif fuzz corpus — see WP64 S3 — ZonedDateTime and IANA time zones with a security record
        status: pending
  - id: s4-option-bags
    title: WP64 S4 — option bags for until, since, round, total and with
    goal: largestUnit, smallestUnit and rounding options work for until, since, round, total and with, in a spelling the owner chose for option-bag layout.
    verification: node tests/run.js temporal && npm run check && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: s4-layout
        content: Implement the chosen option-bag layout and the units and rounding in std/temporal — see WP64 S4 — option bags for until, since, round, total and with
        status: pending
      - id: s4-tests
        content: Add differential cases under Node's Temporal for each option and the docs — see WP64 S4 — option bags for until, since, round, total and with
        status: pending
  - id: s5-yearmonth
    title: WP64 S5 — PlainYearMonth, PlainMonthDay and toLocaleString as toString
    goal: PlainYearMonth and PlainMonthDay exist with Temporal's parsing and arithmetic, and toLocaleString answers as toString.
    verification: node tests/run.js temporal && npm run lint
    status: pending
    todos:
      - id: s5-types
        content: Add PlainYearMonth and PlainMonthDay and toLocaleString as toString in std/temporal — see WP64 S5 — PlainYearMonth, PlainMonthDay and toLocaleString as toString
        status: pending
  - id: s6-wasm-tzdb
    title: WP64 S6 — the wasm profile and an embedded time zone database
    goal: Temporal works under the wasm profile with an embedded time zone database, with deterministic builds either embedding or refusing IANA zones.
    verification: node tests/run.js temporal && node tests/run.js wasi && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: s6-embed
        content: Embed the time zone database for the wasm profile and decide the default for native builds in std/temporal — see WP64 S6 — the wasm profile and an embedded time zone database
        status: pending
---

# WP64 — Temporal, dates, times and time zones

## Context
S1 landed: the ISO core as `nish/temporal` (`PlainDate`, `PlainTime`, `PlainDateTime`, `Duration`, `Instant`), 214 cases in `tests/link/std_temporal` checked natively and against Node's `Temporal`; see [the roadmap page](../../docs/roadmap/wp64-temporal.md). Spec: [design note §6](../../docs/wp64-temporal.md#6-stages). S3 does not depend on S2 and can land first. Non-ISO calendars, localized formatting and leap seconds are not planned.

## WP64 S2 — the global Temporal bound to nish/temporal
The checker binds `Temporal.PlainDate.from(...)`, `new Temporal.PlainDate(...)`, `Temporal.Now.instant()` and the rest to `nish/temporal`, as it binds `Math.atan2`; a dotted type reference is accepted where only an enum member may be named with a dot today; `runtime/nish.d.ts` declares the subset; a call outside the subset gets a diagnostic naming the supported spelling; the differential corpus runs under Node's real `Temporal`. Ships the LANGUAGE.md rule, cookbook entry and guide page. Run `wasi` and `performance` since it touches `src/`.
Likely files: `src/` builtin binding, `runtime/nish.d.ts`, `docs/LANGUAGE.md`, `docs/guide/`.

## WP64 S3 — ZonedDateTime and IANA time zones with a security record
A TZif v1 to v4 reader (RFC 9636) over `$TZDIR` or `/usr/share/zoneinfo`, the POSIX TZ footer rule past the last transition, offset zones, `Temporal.Now.timeZoneId()` from `$TZ` or the `/etc/localtime` link (fallback `UTC`), and `disambiguation`/`offset` as `DisambiguatePossibleEpochNanoseconds` does. Reading a file named by `$TZ` is attacker-facing, so it lands with its `docs/security/` record, index row and a fuzz corpus of malformed TZif files. Adds the `fs.read` and `env` capabilities to programs that name a zone.
Likely files: `std/temporal*.ts`, `docs/security/`.

## WP64 S4 — option bags for until, since, round, total and with
`largestUnit`, `smallestUnit` and rounding. Depends on OQ1 ([§9](../../docs/wp64-temporal.md#9-open-questions)).

### Decision needed
How option bags get a layout (OQ1). Options: let an interface field with an initializer be left out of an object literal, giving Temporal's `{ largestUnit: "year" }` a layout (a language change with its own LANGUAGE.md rule that would serve every `std/` options type); or a Nish-only spelling such as `untilIn(other, "year")`, which is not portable. The note does not recommend one. OQ3 (`Duration`'s field width, `i64` is exact and simple) and OQ5 (`RangeError` stays a panic, with `...OrNull` for parsing) are also open.

## WP64 S5 — PlainYearMonth, PlainMonthDay and toLocaleString as toString
The two remaining plain types, and `toLocaleString` answering as `toString` since localization needs ICU data.

## WP64 S6 — the wasm profile and an embedded time zone database
The wasm profile and an embedded database.

### Decision needed
OQ2: embed the tz database by default? Go and Jiff embed only on request and temporal_rs makes it a feature; a `--deterministic` build cannot read host files and stay deterministic, so it must embed or refuse IANA zones. Also OQ4: `epochNanoseconds` without `bigint` (an `i64` field is cheap but not the `bigint` Node answers; a string is portable but awkward).
