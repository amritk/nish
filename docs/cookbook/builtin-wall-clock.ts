// `wallClockNanos`, `CLOCK_REALTIME` in nanoseconds since the epoch: the same
// one call as `monotonicNanos`, on the other clock.
import { wallClockNanos } from "nish:process"

export const seconds = (): i64 => wallClockNanos() / 1000000000
