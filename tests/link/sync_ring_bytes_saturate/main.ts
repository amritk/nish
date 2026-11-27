// A ring's byte size past the i32 range is held at 2147483647, never wrapped
// to a small or negative count a caller would allocate: `spscRingBytes` of the
// largest capacity and `mpscRingBytes` of a shape whose product overflows both
// answer it, and a shape that fits answers its exact size. A valid shape that
// saturates (65536 slots of 65536 bytes) is refused by `tryInitMpscRing`,
// which writes nothing; no power-of-two SPSC capacity saturates, so
// `initSpscRing` refuses the largest one as a capacity before any size.
import { monotonicNanos } from "nish:process"
import { mpscRingBytes, spscRingBytes, tryInitMpscRing } from "nish/sync/ring"
import { createRegion, RELAXED, unlinkRegion } from "nish/sync/shm"

export const main = (): i32 => {
  console.log(`spsc 4096: ${spscRingBytes(4096)}`)
  console.log(`spsc max: ${spscRingBytes(2147483647)}`)
  console.log(`mpsc 4x8: ${mpscRingBytes(4, 8)}`)
  console.log(`mpsc 65536x65536: ${mpscRingBytes(65536, 65536)}`)
  console.log(`mpsc 2x max: ${mpscRingBytes(2, 2147483647)}`)
  const name: string = `nish-ringsat-${monotonicNanos() % toI64(1000000000)}`
  const made = createRegion(name, 4096)
  if (made.isErr()) {
    console.log(`create a region: ${made.error.message}`)
    return 1
  }
  const region = made.value
  const ring = tryInitMpscRing(region, 0, 65536, 65536, false)
  console.log(`tryInitMpscRing 65536x65536 refused: ${ring.isErr()}`)
  console.log(`and wrote no magic: ${region.loadI32(0, RELAXED) === 0}`)
  const closed = region.close().isOk()
  const unlinked = unlinkRegion(name).isOk()
  return closed && unlinked ? 0 : 1
}
