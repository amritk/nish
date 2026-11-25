// The check must run before each pass: `open` checks once and makes a pool
// on every pass of a loop, and `new Pool(limits)` empties `limits` once it has
// read it, so the second pass makes one from a faulty value. Nothing between
// the check and the call writes, so only the loop keeps the `fault` site of
// `new Pool(limits)` unproven (`fault_contract_proven`).
import { Limits, limitsFault, Pool } from "./pool"

const open = (limits: Limits): i32 => {
  const fault = limitsFault(limits)
  if (fault.length > 0) {
    return -1
  }
  let last = 0
  for (const _pass of [0, 1]) {
    last = new Pool(limits).slots
  }
  return last
}

export const main = (): i32 => open(new Limits(4))
