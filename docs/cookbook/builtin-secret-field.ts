// A `Secret` held as a readonly field. The holder is an ordinary class: its
// field is one pointer to `std/secret.ts`'s `Secret`, set once in the
// constructor from `secret(...)`. Its `wipe()` calls `wipe(this.key)`, which
// is the same volatile `llvm.memset` a local key gets, and `expose` borrows the
// field as a call argument without moving it.
import { Secret, expose, secret, wipe } from "nish:secret"

const width = (k: u8[]): i32 => toI32(k.length)

class Session {
  readonly key: Secret<u8[]>
  constructor(n: i32) {
    this.key = secret(new Array<u8>(n))
  }
  size(): i32 {
    return expose(this.key, width)
  }
  wipe(): void {
    wipe(this.key)
  }
}

export const useSession = (n: i32): i32 => {
  const s = new Session(n)
  const w = s.size()
  s.wipe()
  return w
}
