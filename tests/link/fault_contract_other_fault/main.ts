// The check must be the guard's own fault function: `otherFault` has the same
// shape as `limitsFault` and is stricter, but it is not the function
// `checkLimits` runs, so it proves nothing about the guard and the `fault`
// site of `new Pool(limits)` stays unproven (`fault_contract_proven`).
import { Limits, otherFault, Pool } from "./pool"

const open = (limits: Limits): i32 => {
  const fault = otherFault(limits)
  if (fault.length > 0) {
    return -1
  }
  const pool = new Pool(limits)
  return pool.slots
}

export const main = (): i32 => open(new Limits(4))
