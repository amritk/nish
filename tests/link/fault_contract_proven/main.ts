// A fault the caller rules out (docs/LANGUAGE.md, "Panic sites"). `checkLimits`
// panics exactly when `limitsFault(limits)` finds a fault, `limitsFault` reads
// only its parameter, and `Pool`'s constructor hands its own `limits` to the
// guard first, so `new Pool(limits)` is a `fault` site of its caller. `open`
// runs the same `limitsFault` on the same `limits` just before and leaves on a
// fault, so the site is listed as proven, and so is the guard's `panic`
// (`expected.panics`). The `fault_contract_*` negatives each break one link.
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
  console.log(`${open(new Limits(0))}`)
  return 0
}
