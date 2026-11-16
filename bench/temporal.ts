// `nish/temporal` on the operations a program repeats: reading a string,
// writing one, building a value and doing arithmetic on it (WP64).
// bench/temporal.mjs builds and drives it.
//
//   temporal [scale]
//
// Each workload is timed alone, and prints `time <workload> <ns> <ops>` to
// stderr. stdout gets one line, a checksum over every answer, so an
// optimisation that changes an answer changes the line. `scale` divides every
// count (the driver's `--check` passes 100).
//
// The inputs are 1,024 distinct values made before the clock starts, and each
// turn takes the next one, so no call can be lifted out of its loop. The
// arithmetic workloads chain: each answer is the next turn's receiver.
import { monotonicNanos } from "nish:process"
import {
  Duration,
  durationFrom,
  Instant,
  instantFrom,
  PlainDate,
  PlainDateTime,
  plainDateFrom,
  plainDateTimeFrom,
} from "nish/temporal"

/** The turns each workload runs at scale 1. */
const OPS: i32 = 400000
/** How many distinct inputs each workload cycles through. */
const INPUTS: i32 = 1024

const report = (name: string, started: i64, ops: i32): void => {
  writeError(`time ${name} ${monotonicNanos() - started} ${ops}\n`)
}

/** `n` as two digits. */
const two = (n: i32): string => (n < 10 ? `0${n}` : `${n}`)

/** The i-th input date, spread over four centuries and every month and day. */
const dateText = (i: i32): string =>
  `${1900 + ((i * 7) % 400)}-${two(1 + (i % 12))}-${two(1 + ((i * 13) % 28))}`

/** The i-th input date-time, with a nine-digit fraction. */
const dateTimeText = (i: i32): string =>
  `${dateText(i)}T${two(i % 24)}:${two((i * 7) % 60)}:${two((i * 11) % 60)}.${100000000 + i * 977}`

/** The i-th input instant, with an offset. */
const instantText = (i: i32): string =>
  `${dateText(i)}T${two(i % 24)}:${two((i * 7) % 60)}:00.5+0${i % 10}:30`

/** The i-th input duration. */
const durationText = (i: i32): string =>
  `P${i % 3}Y${i % 12}M${i % 28}DT${i % 24}H${i % 60}M${i % 60}.${100 + i}S`

export const main = (): i32 => {
  const args: string[] = process.argv
  const scale: i32 = args.length > 1 ? toI32(Number(args[1])) : 1
  const ops: i32 = toI32(OPS / scale)
  let sum: i64 = 0

  const dates: string[] = []
  const dateTimes: string[] = []
  const instants: string[] = []
  const durations: string[] = []
  for (let i: i32 = 0; i < INPUTS; i++) {
    dates.push(dateText(i))
    dateTimes.push(dateTimeText(i))
    instants.push(instantText(i))
    durations.push(durationText(i))
  }
  const dateValues: PlainDate[] = []
  const dateTimeValues: PlainDateTime[] = []
  const instantValues: Instant[] = []
  const durationValues: Duration[] = []
  for (let i: i32 = 0; i < INPUTS; i++) {
    dateValues.push(plainDateFrom(dates[i]))
    dateTimeValues.push(plainDateTimeFrom(dateTimes[i]))
    instantValues.push(instantFrom(instants[i]))
    durationValues.push(durationFrom(durations[i]))
  }

  let started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    sum = sum + toI64(plainDateFrom(dates[i % INPUTS]).day)
  }
  report("parse-date", started, ops)

  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    sum = sum + toI64(plainDateTimeFrom(dateTimes[i % INPUTS]).nanosecond)
  }
  report("parse-datetime", started, ops)

  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    sum = sum + instantFrom(instants[i % INPUTS]).epochSeconds
  }
  report("parse-instant", started, ops)

  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    sum = sum + durationFrom(durations[i % INPUTS]).seconds
  }
  report("parse-duration", started, ops)

  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    sum = sum + toI64(dateValues[i % INPUTS].toString().length)
  }
  report("string-date", started, ops)

  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    sum = sum + toI64(dateTimeValues[i % INPUTS].toString().length)
  }
  report("string-datetime", started, ops)

  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    sum = sum + toI64(instantValues[i % INPUTS].toString().length)
  }
  report("string-instant", started, ops)

  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    sum = sum + toI64(durationValues[i % INPUTS].toString().length)
  }
  report("string-duration", started, ops)

  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    sum = sum + toI64(new PlainDate(1900 + (i % 400), 1 + (i % 12), 1 + (i % 28)).weekOfYear)
  }
  report("new-date", started, ops)

  const month: Duration = new Duration(0, 1)
  let d: PlainDate = new PlainDate(1970, 1, 31)
  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    d = d.add(month)
    if (d.year > 270000) {
      d = new PlainDate(1970, 1, 31)
    }
  }
  report("add-date", started, ops)
  sum = sum + d.epochDay

  const step: Duration = new Duration(0, 0, 0, 0, 1, 1, 1, 1)
  let dt: PlainDateTime = new PlainDateTime(1970, 1, 1)
  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    dt = dt.add(step)
  }
  report("add-datetime", started, ops)
  sum = sum + dt.nanoOfDay

  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    sum = sum + dateValues[i % INPUTS].until(dateValues[(i * 7) % INPUTS]).days
  }
  report("until-date", started, ops)

  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    sum = sum + dateTimeValues[i % INPUTS].until(dateTimeValues[(i * 7) % INPUTS]).hours
  }
  report("until-datetime", started, ops)

  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    sum = sum + instantValues[i % INPUTS].until(instantValues[(i * 7) % INPUTS]).seconds
  }
  report("until-instant", started, ops)

  console.log(`checksum ${sum}`)
  return 0
}
