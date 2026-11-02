// --emit-ts refuses a module that imports nish:region (NL4015): the runtime the
// TypeScript output imports has no regions to answer it, so nothing is written.
import { Region, enter, free, region } from "nish:region"

class Box {
  n: i32 = 7
}

const make = (): Box => new Box()
const nOf = (b: Box): i32 => b.n

export const main = (): i32 => {
  const r: Region<Box> = region(make)
  const n = enter(r, nOf)
  free(r)
  console.log(n)
  return 0
}
