// The check must be on the value the call passes: `open` checks `checked` and
// makes the pool from `given`, so the `fault` site of `new Pool(given)` stays
// unproven (`fault_contract_proven`).
import { Limits, limitsFault, Pool } from "./pool"

const open = (checked: Limits, given: Limits): i32 => {
  const fault = limitsFault(checked)
  if (fault.length > 0) {
    return -1
  }
  const pool = new Pool(given)
  return pool.slots
}

export const main = (): i32 => open(new Limits(4), new Limits(0))
