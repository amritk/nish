// A ring's byte size past the i32 range is held at 2147483647, never wrapped
// to a small or negative count a caller would allocate: `spscRingBytes` of the
// largest capacity and `mpscRingBytes` of a shape whose product overflows both
// answer it, and a shape that fits answers its exact size.
import { mpscRingBytes, spscRingBytes } from "nish/sync/ring"

export const main = (): i32 => {
  console.log(`spsc 4096: ${spscRingBytes(4096)}`)
  console.log(`spsc max: ${spscRingBytes(2147483647)}`)
  console.log(`mpsc 4x8: ${mpscRingBytes(4, 8)}`)
  console.log(`mpsc 65536x65536: ${mpscRingBytes(65536, 65536)}`)
  console.log(`mpsc 2x max: ${mpscRingBytes(2, 2147483647)}`)
  return 0
}
