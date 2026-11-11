// WP49 stage 5, part 3: a holder of a `Secret` field is not shared with a
// task: its `wipe()` would end the key while the task still holds it.
import { sleep, spawn } from "nish:async"
import { Secret, secret, wipe } from "nish:secret"

class Holder {
  readonly key: Secret<u8[]>
  constructor(b: u8) {
    const bytes: u8[] = [b, b]
    this.key = secret(bytes)
  }
  wipe(): void {
    wipe(this.key)
  }
}

const later = async (h: Holder, ms: i32): Promise<void> => {
  await sleep(ms)
}

export const main = async (): Promise<i32> => {
  const h = new Holder(7)
  spawn(later(h, 1))
  h.wipe()
  await sleep(10)
  return 0
}
