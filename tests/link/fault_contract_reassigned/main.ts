// The checked name must hold one value: `current` is a `let` that `open`
// points at another `Limits` after the check, so the `fault` site of
// `new Pool(current)` stays unproven (`fault_contract_proven`).
import { Limits, limitsFault, Pool } from "./pool"

const open = (limits: Limits, other: Limits): i32 => {
  let current = limits
  const fault = limitsFault(current)
  if (fault.length > 0) {
    return -1
  }
  current = other
  const pool = new Pool(current)
  return pool.slots
}

export const main = (): i32 => open(new Limits(4), new Limits(0))
