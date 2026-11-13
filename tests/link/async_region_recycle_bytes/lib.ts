// One task of `main.ts`: what it makes must read as zero, and it leaves a
// marker behind for the next task on the same node to find.
import { sleep } from "nish:async"

class Record {
  id: i64 = 0
  flag: boolean = false
  weight: f64 = 0
}

export const dirty = new Array<i32>(1)

export async function visit(n: i32): Promise<void> {
  let seen = 0
  const words = new Array<i32>(1000)
  const bytes = new Array<u8>(2000)
  const nulls = new Array<Record | null>(100)
  for (let i = 0; i < words.length; i++) if (words[i] !== 0) seen++
  for (let i = 0; i < bytes.length; i++) if (bytes[i] !== 0) seen++
  for (let i = 0; i < nulls.length; i++) if (nulls[i] !== null) seen++
  const r = new Record()
  if (r.id !== 0 || r.flag || r.weight !== 0) seen++
  for (let i = 0; i < words.length; i++) words[i] = 0x5ec12e7 + n
  for (let i = 0; i < bytes.length; i++) bytes[i] = 0xa5
  for (let i = 0; i < nulls.length; i++) nulls[i] = r
  dirty[0] = dirty[0] + seen
  r.id = 0x5ec12e7
  r.flag = true
  r.weight = 1.5
  await sleep(0)
}
