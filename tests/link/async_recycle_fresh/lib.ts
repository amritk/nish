// The two tasks of `main.ts`: one dirties its region, the next reads what the
// language promises fresh.
import { sleep } from "nish:async"

export class Seen {
  dirty: i32 = 0
  wrote: i32 = 0
  rounds: i32 = 0
}

export async function fill(seen: Seen, n: i32): Promise<void> {
  const a: i32[] = []
  for (let i = 0; i < n; i++) {
    a.push(-1)
  }
  let s = ""
  for (let i = 0; i < n; i++) {
    s = `${s}z`
  }
  await sleep(0)
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += a[i]
  }
  seen.wrote += s.length - sum
}

export async function fresh(seen: Seen, n: i32): Promise<void> {
  const ints = new Array<i32>(n)
  const floats = new Array<f64>(n)
  const maybe = new Array<string | null>(n)
  for (let i = 0; i < n; i++) {
    if (ints[i] !== 0 || floats[i] !== 0 || maybe[i] !== null) {
      seen.dirty += 1
    }
  }
  let s = ""
  for (let i = 0; i < 26; i++) {
    s = `${s}a`
  }
  await sleep(0)
  for (let i = 0; i < n; i++) {
    if (ints[i] !== 0 || floats[i] !== 0 || maybe[i] !== null) {
      seen.dirty += 1
    }
  }
  if (s !== "aaaaaaaaaaaaaaaaaaaaaaaaaa") {
    seen.dirty += 1
  }
  seen.rounds += 1
}
