// A branch that leaves between the check and the call (docs/LANGUAGE.md,
// "Panic sites"): `open` is `fault_contract_proven`'s with an `if` after the
// check whose branch calls `shrink(limits)` and returns. Only its test runs on
// the way to `new Pool(limits)`, so the site is listed as proven
// (`expected.panics`). `fault_contract_late_exit` is the same branch without
// the `return`, which stays refused.
import { Limits, limitsFault, Pool, shrink } from "./pool"

const open = (limits: Limits, spare: i32): i32 => {
  const fault = limitsFault(limits)
  if (fault.length > 0) {
    return -1
  }
  if (spare < 0) {
    shrink(limits)
    return -2
  }
  return new Pool(limits).slots
}

export const main = (): i32 => {
  console.log(`${open(new Limits(4), 1)}`)
  console.log(`${open(new Limits(4), -1)}`)
  console.log(`${open(new Limits(0), 1)}`)
  return 0
}
