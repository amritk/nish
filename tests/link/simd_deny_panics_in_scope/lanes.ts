// The unguarded loads `main.ts` calls; its header says why each is refused.
import { extract, loadI32x4, loadU8x16 } from "nish:simd"

export const firstBytes = (xs: u8[], at: i32): i32 => {
  return toI32(extract(loadU8x16(xs, at), 0))
}

export const firstWords = (ws: i32[], at: i32): i32 => {
  return extract(loadI32x4(ws, at), 0)
}

const bytes = (): u8[] => new Array<u8>(32)

export const fromCall = (at: i32): i32 => {
  return toI32(extract(loadU8x16(bytes(), at), 0))
}
