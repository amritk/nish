// A parameter named like a `nish:` import is not that import: `write` here is
// the closure `main` hands `open`, which sets `limits.slots` to 0, so the
// `fault` site of `new Pool(limits)` stays unproven. The call matches the
// import `write` by name and passes a literal, so only its bound callee (the
// closure, in `open`'s instance) refuses it (`fault_contract_call_between`).
import { write } from "nish:io"
import { Limits, limitsFault, Pool, shrinkTo } from "./pool"

const open = (limits: Limits, write: (slots: i32) => void): i32 => {
  const fault = limitsFault(limits)
  if (fault.length > 0) {
    return -1
  }
  write(0)
  const pool = new Pool(limits)
  return pool.slots
}

export const main = (): i32 => {
  const limits = new Limits(4)
  return open(limits, (slots: i32): void => {
    shrinkTo(limits, slots)
  })
}
