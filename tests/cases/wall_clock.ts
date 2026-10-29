// `wallClockNanos`: the wall clock in nanoseconds since the Unix epoch, an
// i64. A golden cannot hold a timestamp, so this pins what every run has: the
// reading is after 2020-01-01, and it agrees with `Date.now`, the same clock
// at a millisecond's grain, to within a minute.
import { wallClockNanos } from "nish:process";

export const main = (): number => {
  const nanos = wallClockNanos();
  const millis = Date.now();
  console.log(`after 2020: ${nanos / 1000000000 > 1577836800}`);
  const apart = toF64(nanos / 1000000) - millis;
  console.log(`agrees with Date.now: ${apart > -60000 && apart < 60000}`);
  return 0;
};
