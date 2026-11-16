// The Node half of tests/link/std_temporal: `judge` answers every case of
// vectors.ts with the JavaScript engine's own `Temporal` and compares each with
// its line of expected.out, which the link loop holds the native program to.
// tests/run.js calls it, and skips it when the Node it runs under has no
// `Temporal` (Node 26 ships one; CI's does).
import fs from "node:fs"

/** The cases of vectors.ts, read from its source: every string in its array. */
const cases = () => {
  const text = fs.readFileSync(new URL("vectors.ts", import.meta.url), "utf8")
  const body = text.slice(text.indexOf("=> ["))
  return [...body.matchAll(/^ {2}"([^"]*)",$/gm)].map((m) => m[1])
}

/** What the case answers under `Temporal`, written as main.ts writes it. */
const answer = (T, op, a, b) => {
  const date = (s) => T.PlainDate.from(s)
  const time = (s) => T.PlainTime.from(s)
  const dateTime = (s) => T.PlainDateTime.from(s)
  const duration = (s) => T.Duration.from(s)
  const instant = (s) => T.Instant.from(s)
  const parse = (f) => {
    try {
      return f().toString()
    } catch (e) {
      if (e instanceof RangeError) {
        return "RangeError"
      }
      throw e
    }
  }
  switch (op) {
    case "date":
      return parse(() => date(a))
    case "date.fields": {
      const d = date(a)
      return `${d.year} ${d.month} ${d.day} ${d.monthCode} ${d.dayOfWeek} ${d.dayOfYear} ${d.weekOfYear} ${d.yearOfWeek} ${d.daysInMonth} ${d.daysInYear} ${d.inLeapYear}`
    }
    case "date.add":
      return date(a).add(duration(b)).toString()
    case "date.subtract":
      return date(a).subtract(duration(b)).toString()
    case "date.until":
      return date(a).until(date(b)).toString()
    case "date.since":
      return date(a).since(date(b)).toString()
    case "date.compare":
      return `${T.PlainDate.compare(date(a), date(b))}`
    case "time":
      return parse(() => time(a))
    case "time.add":
      return time(a).add(duration(b)).toString()
    case "time.subtract":
      return time(a).subtract(duration(b)).toString()
    case "time.until":
      return time(a).until(time(b)).toString()
    case "time.since":
      return time(a).since(time(b)).toString()
    case "time.compare":
      return `${T.PlainTime.compare(time(a), time(b))}`
    case "datetime":
      return parse(() => dateTime(a))
    case "datetime.add":
      return dateTime(a).add(duration(b)).toString()
    case "datetime.subtract":
      return dateTime(a).subtract(duration(b)).toString()
    case "datetime.until":
      return dateTime(a).until(dateTime(b)).toString()
    case "datetime.since":
      return dateTime(a).since(dateTime(b)).toString()
    case "datetime.compare":
      return `${T.PlainDateTime.compare(dateTime(a), dateTime(b))}`
    case "duration":
      return parse(() => duration(a))
    case "duration.fields": {
      const d = duration(a)
      return `${d.years} ${d.months} ${d.weeks} ${d.days} ${d.hours} ${d.minutes} ${d.seconds} ${d.milliseconds} ${d.microseconds} ${d.nanoseconds} ${d.sign} ${d.blank}`
    }
    case "duration.add":
      return duration(a).add(duration(b)).toString()
    case "duration.subtract":
      return duration(a).subtract(duration(b)).toString()
    case "duration.negated":
      return duration(a).negated().toString()
    case "duration.abs":
      return duration(a).abs().toString()
    case "duration.compare":
      return `${T.Duration.compare(duration(a), duration(b))}`
    case "instant":
      return parse(() => instant(a))
    case "instant.ms": {
      const i = T.Instant.fromEpochMilliseconds(Number(a))
      return `${i.toString()} ${i.epochMilliseconds}`
    }
    case "instant.epochMilliseconds":
      return `${instant(a).epochMilliseconds}`
    case "instant.add":
      return instant(a).add(duration(b)).toString()
    case "instant.subtract":
      return instant(a).subtract(duration(b)).toString()
    case "instant.until":
      return instant(a).until(instant(b)).toString()
    case "instant.since":
      return instant(a).since(instant(b)).toString()
    case "instant.compare":
      return `${T.Instant.compare(instant(a), instant(b))}`
    default:
      return `unknown operation ${op}`
  }
}

/**
 * The cases where the engine's `Temporal` is known to answer otherwise than
 * this module, each with the engine's answer and why. A case here is held to
 * that answer instead of expected.out's, so when the engine changes (a fix
 * in V8, or Node moving to another parser) the check fails and names it, and
 * the entry is reconsidered rather than left behind.
 */
const ENGINE_DIFFERENCES = new Map([
  [
    "date|2024-01-15[foo=x]",
    {
      engine: "RangeError",
      why: "the grammar's AnnotationValueComponent is one or more letters or digits, and ixdtf (the parser temporal_rs uses) accepts `x`; Node 26.13.1 refuses it",
    },
  ],
  [
    "date|2024-01-15[foo=a--b]",
    {
      engine: "2024-01-15",
      why: "the grammar joins AnnotationValueComponents with single `-`, and ixdtf refuses `a--b`; Node 26.13.1 accepts it",
    },
  ],
  [
    "date|2024-01-15[u-ca=japanese]",
    {
      engine: "2024-01-15[u-ca=japanese]",
      why: "nish/temporal has only the iso8601 calendar (docs/wp64-temporal.md §8); Node has ECMA-402's calendars",
    },
  ],
])

/**
 * The cases whose `Temporal` answer differs from expected.out, as
 * `case: Temporal says X, expected.out says Y`; empty when every one agrees,
 * the known differences above by the engine's recorded answer. `T` is the
 * engine's `Temporal`.
 */
export const judge = (T) => {
  const want = fs
    .readFileSync(new URL("expected.out", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.length > 0)
  const all = cases()
  const problems = []
  if (want.length !== all.length) {
    problems.push(`vectors.ts has ${all.length} cases and expected.out ${want.length} lines`)
  }
  for (const c of ENGINE_DIFFERENCES.keys()) {
    if (!all.includes(c)) {
      problems.push(`${c}: ENGINE_DIFFERENCES names a case vectors.ts no longer has`)
    }
  }
  all.forEach((c, i) => {
    const [op, a = "", b = ""] = c.split("|")
    let got
    try {
      got = answer(T, op, a, b)
    } catch (e) {
      got = `threw ${e}`
    }
    const known = ENGINE_DIFFERENCES.get(c)
    if (known !== undefined) {
      if (got !== known.engine) {
        problems.push(
          `${c}: Temporal says ${got}, not the ${known.engine} ENGINE_DIFFERENCES records (${known.why}); reconsider the entry`
        )
      }
      return
    }
    const line = `${c} => ${got}`
    if (want[i] !== line) {
      problems.push(`${c}: Temporal says ${got}, expected.out says ${(want[i] ?? "").slice(c.length + 4)}`)
    }
  })
  return { count: all.length, problems }
}
