// Only a `nish:` import may run between the check and the call: `toI32` is a
// builtin, unbound and handed a primitive name, and still not one, so the
// `fault` site of `new Pool(limits)` stays unproven
// (`fault_contract_call_between`).
import { Limits, limitsFault, Pool } from "./pool"

const open = (limits: Limits): i32 => {
  const fault = limitsFault(limits)
  if (fault.length > 0) {
    return -1
  }
  const x: f64 = 1.5
  const n: i32 = toI32(x)
  const pool = new Pool(limits)
  return pool.slots + n
}

export const main = (): i32 => open(new Limits(4))
