import { scale } from "./host/scale.ts"

const DATA = new Float32Array(64)

export const run = (at: u32): f32 => {
  scale(DATA, at, 8)
  return DATA[at]
}
