// The writers of std/temporal.ts under an instruction count: `n` rounds that
// each turn 256 PlainDate, PlainTime, PlainDateTime, Duration and Instant
// values back into ISO 8601 text with toString. It reaches the digit and
// fraction writers, the year sign and the Duration designators whose index,
// slice and overflow sites the std/ ratchet counts, so a fix to one of them
// shows here as a count that holds or falls. It prints the total length of
// the text and a sum of its bytes.
import { Duration, Instant, instantFrom, PlainDate, PlainDateTime, PlainTime } from "nish/temporal"

/** How many distinct values each round writes. */
const VALUES: i32 = 256

/** The length and the bytes of `s`, folded into one sum. */
const fold = (s: string): i64 => {
  let h: i64 = toI64(s.length)
  for (let k: i32 = 0; k < s.length; k++) {
    h += toI64(s.charCodeAt(k))
  }
  return h
}

export const main = (): i32 => {
  const n: i32 = 180 // bench:n
  const dates: PlainDate[] = []
  const times: PlainTime[] = []
  const dateTimes: PlainDateTime[] = []
  const durations: Duration[] = []
  const instants: Instant[] = []
  for (let i: i32 = 0; i < VALUES; i++) {
    // Years before 0 and after 9999 take the six-digit signed form.
    let year: i32 = 1900 + ((i * 7) % 400)
    if (i % 16 === 0) {
      year = -100 - i
    } else if (i % 16 === 1) {
      year = 10000 + i
    }
    dates.push(new PlainDate(year, 1 + (i % 12), 1 + ((i * 13) % 28)))
    times.push(new PlainTime(i % 24, (i * 7) % 60, (i * 11) % 60, i % 1000, (i * 3) % 1000, (i * 7) % 1000))
    dateTimes.push(
      new PlainDateTime(year, 1 + (i % 12), 1 + ((i * 5) % 28), i % 24, (i * 7) % 60, (i * 11) % 60, i % 1000)
    )
    const k: i64 = toI64(i)
    durations.push(
      new Duration(k % 3, k % 12, k % 5, k % 28, k % 24, k % 60, k % 60, (k * 37) % 1000, k % 1000)
    )
    instants.push(instantFrom(`${2000 + (i % 50)}-0${1 + (i % 9)}-1${i % 10}T0${i % 10}:30:00.${100 + i}Z`))
  }
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    for (let i: i32 = 0; i < VALUES; i++) {
      sum += fold(dates[i].toString())
      sum += fold(times[i].toString())
      sum += fold(dateTimes[i].toString())
      sum += fold(durations[i].toString())
      sum += fold(instants[i].toString())
    }
  }
  console.log(`${sum}`)
  return 0
}
