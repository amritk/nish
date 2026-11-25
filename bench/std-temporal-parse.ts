// The readers of std/temporal.ts under an instruction count: `n` rounds that
// each read 256 dates, times, date-times, durations and instants from ISO
// 8601 text, one in eight of them malformed or out of range so the refusal
// paths run too. It reaches the reader's digit, fraction, offset and
// annotation steps and the duration fields whose overflow sites the std/
// ratchet counts, so a fix to one of them shows here as a count that holds
// or falls. It prints a sum of the fields read and of the refusals.
import {
  durationFromOrNull,
  instantFromOrNull,
  plainDateFromOrNull,
  plainDateTimeFromOrNull,
  plainTimeFromOrNull,
} from "nish/temporal"

/** How many distinct strings of each kind each round reads. */
const INPUTS: i32 = 256

/** `n` as two digits. */
const two = (n: i32): string => (n < 10 ? `0${n}` : `${n}`)

/** The i-th date text; one in eight names a day the month does not have. */
const dateText = (i: i32): string =>
  `${1900 + ((i * 7) % 400)}-${two(1 + (i % 12))}-${i % 8 === 7 ? "31" : two(1 + ((i * 13) % 28))}`

/** The i-th time text, with a fraction of one to nine digits; one in eight has hour 24. */
const timeText = (i: i32): string =>
  `${i % 8 === 7 ? "24" : two(i % 24)}:${two((i * 7) % 60)}:${two((i * 11) % 60)}.${`${100000000 + i * 977}`.slice(0, 1 + (i % 9))}`

export const main = (): i32 => {
  const n: i32 = 150 // bench:n
  const dates: string[] = []
  const times: string[] = []
  const dateTimes: string[] = []
  const durations: string[] = []
  const instants: string[] = []
  for (let i: i32 = 0; i < INPUTS; i++) {
    dates.push(dateText(i))
    times.push(timeText(i))
    dateTimes.push(
      i % 8 === 3 ? `${dateText(i)}X${timeText(i)}` : `${dateText(i)}T${timeText(i)}[u-ca=iso8601]`
    )
    durations.push(
      i % 8 === 5
        ? `P${i}Y${i}MT`
        : `${i % 4 === 0 ? "-" : ""}P${i % 3}Y${i % 12}M${i % 5}W${i % 28}DT${i % 24}H${i % 60}M${i % 60}.${100 + i}S`
    )
    // One in eight instants has no offset, which an instant needs.
    let offset: string = i % 2 === 0 ? "Z" : `+0${i % 10}:30`
    if (i % 8 === 1) {
      offset = ""
    }
    instants.push(`${dateText(i)}T${timeText(i)}${offset}`)
  }
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    for (let i: i32 = 0; i < INPUTS; i++) {
      const d = plainDateFromOrNull(dates[i])
      sum += d === null ? 1 : d.epochDay
      const t = plainTimeFromOrNull(times[i])
      sum += t === null ? 1 : t.nanoOfDay
      const dt = plainDateTimeFromOrNull(dateTimes[i])
      sum += dt === null ? 1 : dt.nanoOfDay + dt.epochDay
      const p = durationFromOrNull(durations[i])
      sum += p === null ? 1 : p.seconds + p.days + p.nanoseconds
      const at = instantFromOrNull(instants[i])
      sum += at === null ? 1 : at.epochSeconds
    }
  }
  console.log(`${sum}`)
  return 0
}
