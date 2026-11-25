// Date arithmetic of std/temporal.ts under an instruction count: `n` rounds
// that each walk PlainDate.add, PlainDate.until and since, PlainDateTime.add
// and until, Duration.add and negated, and Instant.add and until over 256
// values spread across four centuries. It reaches the epoch-day and civil
// conversions, the span balancing and the i64 sums whose overflow sites the
// std/ ratchet counts, so a fix to one of them shows here as a count that
// holds or falls. It prints a sum of the answers.
import { Duration, Instant, instantFrom, PlainDate, PlainDateTime } from "nish/temporal"

/** How many distinct values each round walks. */
const VALUES: i32 = 256

export const main = (): i32 => {
  const n: i32 = 160 // bench:n
  const dates: PlainDate[] = []
  const dateTimes: PlainDateTime[] = []
  const instants: Instant[] = []
  const steps: Duration[] = []
  for (let i: i32 = 0; i < VALUES; i++) {
    dates.push(new PlainDate(1900 + ((i * 7) % 400), 1 + (i % 12), 1 + ((i * 13) % 28)))
    dateTimes.push(
      new PlainDateTime(
        1900 + ((i * 11) % 400),
        1 + (i % 12),
        1 + ((i * 5) % 28),
        i % 24,
        (i * 7) % 60,
        (i * 11) % 60
      )
    )
    instants.push(instantFrom(`${2000 + (i % 50)}-0${1 + (i % 9)}-1${i % 10}T0${i % 10}:30:00Z`))
    const k: i64 = toI64(i)
    steps.push(new Duration(k % 3, k % 12, k % 5, k % 28, k % 24, k % 60, k % 60, (k * 37) % 1000))
  }
  const hours: Duration = new Duration(0, 0, 0, 0, 36, 15, 30, 250)
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    let total: Duration = new Duration()
    for (let i: i32 = 0; i < dates.length; i++) {
      const j: i32 = (i * 31 + round) % VALUES
      const d: PlainDate = dates[i].add(steps[j])
      sum += d.epochDay + d.until(dates[j]).days + dates[j].since(d).days
      const dt: PlainDateTime = dateTimes[i].add(steps[j])
      sum += dt.nanoOfDay + dt.until(dateTimes[j]).hours
      const at: Instant = instants[i].add(hours)
      sum += at.epochSeconds + at.until(instants[j]).seconds
      total = total.add(hours).negated()
    }
    sum += total.seconds + total.milliseconds
  }
  console.log(`${sum}`)
  return 0
}
