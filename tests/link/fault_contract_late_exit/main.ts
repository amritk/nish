// A branch between the check and the call must leave to be skipped: this is
// `fault_contract_early_exit` without the branch's `return`, so `shrink(limits)`
// can run before `new Pool(limits)` and its `fault` site stays unproven
// (`fault_contract_early_exit`).
import { Limits, limitsFault, Pool, shrink } from "./pool"

const open = (limits: Limits, spare: i32): i32 => {
  const fault = limitsFault(limits)
  if (fault.length > 0) {
    return -1
  }
  if (spare < 0) {
    shrink(limits)
  }
  return new Pool(limits).slots
}

export const main = (): i32 => open(new Limits(4), -1)
