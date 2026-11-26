// The fault branch must leave: `open` logs the fault and carries on to the
// call, so the `fault` site of `new Pool(limits)` stays unproven
// (`fault_contract_proven`).
import { Limits, limitsFault, Pool } from "./pool"

const open = (limits: Limits): i32 => {
  const fault = limitsFault(limits)
  if (fault.length > 0) {
    console.log(fault)
  }
  const pool = new Pool(limits)
  return pool.slots
}

export const main = (): i32 => open(new Limits(0))
