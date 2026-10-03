// `nish:secret`: a key wrapped, read through `expose`, and wiped. The instance
// of `wipe` is one `llvm.memset` with its volatile flag set, over the array's
// whole capacity, and it is copied into this module rather than linked from
// `std/secret.ts`, which writes no `.ll` of its own.
import { Secret, expose, secret, wipe } from "nish:secret"

const width = (k: u8[]): i32 => toI32(k.length)

export const useKey = (n: i32): i32 => {
  const k: Secret<u8[]> = secret(new Array<u8>(n))
  const w: i32 = expose(k, width)
  wipe(k)
  return w
}
