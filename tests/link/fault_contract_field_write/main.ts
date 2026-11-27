// Nothing between the check and the call may write the object: `open` sets
// `limits.slots` itself after the check, so the `fault` site of
// `new Pool(limits)` stays unproven (`fault_contract_proven`).
import { Limits, limitsFault, Pool } from "./pool"

const open = (limits: Limits): i32 => {
  const fault = limitsFault(limits)
  if (fault.length > 0) {
    return -1
  }
  limits.slots = 0
  const pool = new Pool(limits)
  return pool.slots
}

export const main = (): i32 => open(new Limits(4))
