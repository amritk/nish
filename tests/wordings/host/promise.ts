// The host module of the NL2663 case: a host function that returns a Promise.
import type { i32 } from "nish"
export async function later(x: i32): Promise<i32> {
  return x
}
