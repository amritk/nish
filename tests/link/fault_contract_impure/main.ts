// The fault function must read only its parameter: `limitsFault` here reads
// the process's `POOL_STRICT`, which can change between a caller's check
// and the guard's, so `checkLimits` is no fault guard. Its `panic` is then
// followed as any call's is: `expected.panics` lists the `new Pool` call
// reaching it, and no `fault` site
// (`fault_contract_proven` is the same program with a pure `limitsFault`).
import { Limits, limitsFault, Pool } from "./pool"

const open = (limits: Limits): i32 => {
  const fault = limitsFault(limits)
  if (fault.length > 0) {
    return -1
  }
  const pool = new Pool(limits)
  return pool.slots
}

export const main = (): i32 => {
  console.log(`${open(new Limits(4))}`)
  return 0
}
