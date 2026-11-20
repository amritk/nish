# WP64: Temporal — dates, times and time zones

**State:** In progress · **Open work:** [#1870](https://github.com/amritk/nish/issues/1870) · **Design note:** [`docs/wp64-temporal.md`](https://github.com/amritk/nish/blob/main/docs/wp64-temporal.md)

## Stages

- [x] S1: the ISO core as `nish/temporal`: `PlainDate`, `PlainTime`, `PlainDateTime`, `Duration` and `Instant` with Temporal's parsing, strings and default arithmetic, every case checked against Node's own `Temporal`

## Open work

Open stages are the sub-issues of [#1870](https://github.com/amritk/nish/issues/1870), one pull request each, specified in [`.claude/plans/wp64-temporal.plan.md`](https://github.com/amritk/nish/blob/main/.claude/plans/wp64-temporal.plan.md). What waits on a decision is labelled `needs-decision` there.

## Not planned

Non-ISO calendars and localized formatting, which need ICU's data; leap seconds, which Temporal does not model either.

[All work packages](index.md)
