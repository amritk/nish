// A program that holds a record inline and imports `nish/threads` is written
// whole, with exit 0. Whether a push copies is asked of the module the push is
// in, and `std/threads.ts` holds no record inline, so `Channel.send` is written
// as it is; were a choice ever left to an instance there, the standard
// library's body would be a stub that throws, never a refusal of the program.
import type { i32 } from "nish/runtime"
import { AtomicI32 } from "./nish/threads.ts"

interface P {
  x: i32
}

export const main = (): number => {
  const ps: P[] = [{ x: 1 }, { x: 2 }]
  const a = new AtomicI32(ps[1].x)
  console.log(`${a.load()}`)
  return 0
}
