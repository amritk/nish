// WP48: `Compact` asks for 32-bit links and `Wide` for full pointers, so one
// class cannot write both.
import { Compact, Wide } from "nish:compact"

class Both implements Compact, Wide {
  val: i32
  next: Both | null = null
  constructor(val: i32) {
    this.val = val
  }
}

export const main = (): i32 => {
  const b = new Both(1)
  return b.val - 1
}
