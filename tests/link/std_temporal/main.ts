// `nish/temporal` against TC39 Temporal: each case of vectors.ts, answered by
// the module and printed as `case => answer`. expected.out is checked by the
// link loop against this program and by `check.mjs` against Node's own
// `Temporal`, wherever Node has one, so a line is the specification's answer
// and not only this module's.
import {
  Duration,
  durationCompare,
  durationFrom,
  durationFromOrNull,
  instantCompare,
  instantFrom,
  instantFromEpochMilliseconds,
  instantFromOrNull,
  PlainDate,
  PlainDateTime,
  plainDateCompare,
  plainDateFrom,
  plainDateFromOrNull,
  plainDateTimeCompare,
  plainDateTimeFrom,
  plainDateTimeFromOrNull,
  PlainTime,
  plainTimeCompare,
  plainTimeFrom,
  plainTimeFromOrNull,
} from "nish/temporal"
import { temporalVectors } from "./vectors"

/** The fields of a date, in the order check.mjs writes them. */
const dateFields = (d: PlainDate): string =>
  `${d.year} ${d.month} ${d.day} ${d.monthCode} ${d.dayOfWeek} ${d.dayOfYear} ${d.weekOfYear} ${d.yearOfWeek} ${d.daysInMonth} ${d.daysInYear} ${d.inLeapYear}`

/** The fields of a duration, in the order check.mjs writes them. */
const durationFields = (d: Duration): string =>
  `${d.years} ${d.months} ${d.weeks} ${d.days} ${d.hours} ${d.minutes} ${d.seconds} ${d.milliseconds} ${d.microseconds} ${d.nanoseconds} ${d.sign} ${d.blank}`

/** A parse's answer: the value's string, or `RangeError` when it was refused. */
const parsed = (text: string | null): string => (text === null ? "RangeError" : text)

/** What the case `op` answers for its arguments `a` and `b`. */
const answer = (op: string, a: string, b: string): string => {
  if (op === "date") {
    const d: PlainDate | null = plainDateFromOrNull(a)
    return parsed(d === null ? null : d.toString())
  }
  if (op === "date.fields") {
    return dateFields(plainDateFrom(a))
  }
  if (op === "date.add") {
    return plainDateFrom(a).add(durationFrom(b)).toString()
  }
  if (op === "date.subtract") {
    return plainDateFrom(a).subtract(durationFrom(b)).toString()
  }
  if (op === "date.until") {
    return plainDateFrom(a).until(plainDateFrom(b)).toString()
  }
  if (op === "date.since") {
    return plainDateFrom(a).since(plainDateFrom(b)).toString()
  }
  if (op === "date.compare") {
    return `${plainDateCompare(plainDateFrom(a), plainDateFrom(b))}`
  }
  if (op === "time") {
    const t: PlainTime | null = plainTimeFromOrNull(a)
    return parsed(t === null ? null : t.toString())
  }
  if (op === "time.add") {
    return plainTimeFrom(a).add(durationFrom(b)).toString()
  }
  if (op === "time.subtract") {
    return plainTimeFrom(a).subtract(durationFrom(b)).toString()
  }
  if (op === "time.until") {
    return plainTimeFrom(a).until(plainTimeFrom(b)).toString()
  }
  if (op === "time.since") {
    return plainTimeFrom(a).since(plainTimeFrom(b)).toString()
  }
  if (op === "time.compare") {
    return `${plainTimeCompare(plainTimeFrom(a), plainTimeFrom(b))}`
  }
  if (op === "datetime") {
    const dt: PlainDateTime | null = plainDateTimeFromOrNull(a)
    return parsed(dt === null ? null : dt.toString())
  }
  if (op === "datetime.add") {
    return plainDateTimeFrom(a).add(durationFrom(b)).toString()
  }
  if (op === "datetime.subtract") {
    return plainDateTimeFrom(a).subtract(durationFrom(b)).toString()
  }
  if (op === "datetime.until") {
    return plainDateTimeFrom(a).until(plainDateTimeFrom(b)).toString()
  }
  if (op === "datetime.since") {
    return plainDateTimeFrom(a).since(plainDateTimeFrom(b)).toString()
  }
  if (op === "datetime.compare") {
    return `${plainDateTimeCompare(plainDateTimeFrom(a), plainDateTimeFrom(b))}`
  }
  if (op === "duration") {
    const d: Duration | null = durationFromOrNull(a)
    return parsed(d === null ? null : d.toString())
  }
  if (op === "duration.fields") {
    return durationFields(durationFrom(a))
  }
  if (op === "duration.add") {
    return durationFrom(a).add(durationFrom(b)).toString()
  }
  if (op === "duration.subtract") {
    return durationFrom(a).subtract(durationFrom(b)).toString()
  }
  if (op === "duration.negated") {
    return durationFrom(a).negated().toString()
  }
  if (op === "duration.abs") {
    return durationFrom(a).abs().toString()
  }
  if (op === "duration.compare") {
    return `${durationCompare(durationFrom(a), durationFrom(b))}`
  }
  if (op === "instant") {
    const i = instantFromOrNull(a)
    return parsed(i === null ? null : i.toString())
  }
  if (op === "instant.ms") {
    const i = instantFromEpochMilliseconds(Number(a))
    return `${i.toString()} ${i.epochMilliseconds}`
  }
  if (op === "instant.epochMilliseconds") {
    return `${instantFrom(a).epochMilliseconds}`
  }
  if (op === "instant.add") {
    return instantFrom(a).add(durationFrom(b)).toString()
  }
  if (op === "instant.subtract") {
    return instantFrom(a).subtract(durationFrom(b)).toString()
  }
  if (op === "instant.until") {
    return instantFrom(a).until(instantFrom(b)).toString()
  }
  if (op === "instant.since") {
    return instantFrom(a).since(instantFrom(b)).toString()
  }
  if (op === "instant.compare") {
    return `${instantCompare(instantFrom(a), instantFrom(b))}`
  }
  return `unknown operation ${op}`
}

export const main = (): i32 => {
  const cases: string[] = temporalVectors()
  for (const line of cases) {
    const first: i32 = toI32(line.indexOf("|"))
    const rest: string = line.substring(first + 1, toI32(line.length))
    const second: i32 = toI32(rest.indexOf("|"))
    const op: string = line.substring(0, first)
    const a: string = second < 0 ? rest : rest.substring(0, second)
    const b: string = second < 0 ? "" : rest.substring(second + 1, toI32(rest.length))
    console.log(`${line} => ${answer(op, a, b)}`)
  }
  return 0
}
