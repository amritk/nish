// The host module of the NL2681 case: a window lends no `i64[]`.
import type { i64, u32 } from "nish"
export function fill(xs: i64[], at: u32, n: u32): void {
  xs[at] = BigInt(n)
}
