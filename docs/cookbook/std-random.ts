import { Rng } from "nish/random"

export const roll = (seed: i32): i32 => {
  const r = new Rng(seed)
  return 1 + ((r.nextI32() >>> 1) % 6)
}
