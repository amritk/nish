// WP49 stage 5, part 8: a spawn arrow may capture an object only when it holds
// nothing a task may not share; `h` holds a `Secret`, which its holder wipes,
// perhaps while the task still reads it. The arrow-capture rule for a
// `Secret` refuses it before the spawn's does (NL2588).
import { sleep, spawn } from "nish:async"
import { Secret, secret, wipe } from "nish:secret"

class Holder {
  hits: i32 = 0
  readonly key: Secret<u8[]>
  constructor(b: u8) {
    const bytes: u8[] = [b, b]
    this.key = secret(bytes)
  }
  wipe(): void {
    wipe(this.key)
  }
}

async function each(f: (n: i32) => void, ms: i32): Promise<void> {
  await sleep(ms)
  f(ms)
}

export async function main(): Promise<i32> {
  const h = new Holder(7)
  spawn(each((n: i32): void => {
    h.hits = h.hits + n
  }, 1))
  h.wipe()
  await sleep(10)
  return 0
}
