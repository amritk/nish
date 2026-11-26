// A `nish:` import between the check and the call takes only primitive
// arguments: `writeBytes` is an unbound `nish:io` import, but it is handed the
// array `bytes`, so the `fault` site of `new Pool(limits)` stays unproven
// (`fault_contract_call_between`).
import { writeBytes } from "nish:io"
import { Limits, limitsFault, Pool } from "./pool"

const open = (limits: Limits): i32 => {
  const fault = limitsFault(limits)
  if (fault.length > 0) {
    return -1
  }
  const bytes: u8[] = [104, 10]
  writeBytes(bytes, 0, 2)
  const pool = new Pool(limits)
  return pool.slots
}

export const main = (): i32 => open(new Limits(4))
