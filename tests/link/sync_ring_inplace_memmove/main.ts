// The in-place write `std/sync/ring.ts` shows, `copyBytes` into the window
// `reserve` lends, pinned as one `llvm.memmove`: `expected.once` holds that
// `nish/bytes`'s `copyBytes` makes exactly one memmove call and that `stage`
// below calls `copyBytes`, not a loop of its own. A memmove is what lets the
// source and the window overlap, so the program copies into the window
// from a separate array, then within the window both ways, and the consumer
// reads each record back where the ring holds it.
//
// The pin is here rather than in a `tests/cases` golden because that suite
// compiles one module, and `copyBytes` is compiled in `nish/bytes`'s.
import { monotonicNanos } from "nish:process"
import { copyBytes } from "nish/bytes"
import { attachSpscRing, initSpscRing, RING_EMPTY, spscRingBytes } from "nish/sync/ring"
import { createRegion, unlinkRegion } from "nish/sync/shm"
import { Suite } from "nish/testing"

const CAP: i32 = 256

/** Copies `count` bytes of `src` from `from` into `dst` at `at`: the one call `expected.once` pins. */
export const stage = (dst: u8[], at: i32, src: readonly u8[], from: i32, count: i32): void => {
  copyBytes(dst, at, src, from, count)
}

/** Whether `got` is `want`, byte for byte. */
const same = (got: readonly u8[], want: readonly u8[]): boolean => {
  if (got.length !== want.length) {
    return false
  }
  for (let i = 0; i < want.length; i++) {
    if (got[i] !== want[i]) {
      return false
    }
  }
  return true
}

export const main = (): i32 => {
  const t = new Suite("nish/sync/ring in place, copyBytes into the window")
  const name: string = `nish-test-ringm-${monotonicNanos() % toI64(1000000000)}`
  const made = createRegion(name, spscRingBytes(CAP))
  if (made.isErr()) {
    t.fail("create a region", made.error.message)
    return t.done()
  }
  const ring = initSpscRing(made.value, 0, CAP, false)
  const back = attachSpscRing(made.value, 0).expect("attach the ring")
  const body: u8[] = [1, 2, 3, 4, 5, 6, 7, 8]

  // From a separate array into the window, at an offset.
  const w: u8[] = ring.reserve(10)
  t.eqI32("the window is lent", toI32(w.length), 10)
  w[0] = 0
  w[1] = 0
  stage(w, 2, body, 0, 8)
  ring.commit(10)
  t.ok("copied in at its offset", same(back.peek(), [0, 0, 1, 2, 3, 4, 5, 6, 7, 8]))
  back.release()

  // Within the window, forward: the ranges overlap, so the source is read
  // as if before any byte of it is written.
  const f: u8[] = ring.reserve(8)
  stage(f, 0, body, 0, 8)
  stage(f, 2, f, 0, 6)
  ring.commit(8)
  t.ok("an overlapping copy forward", same(back.peek(), [1, 2, 1, 2, 3, 4, 5, 6]))
  back.release()

  // And backward.
  const b: u8[] = ring.reserve(8)
  stage(b, 0, body, 0, 8)
  stage(b, 0, b, 2, 6)
  ring.commit(8)
  t.ok("an overlapping copy backward", same(back.peek(), [3, 4, 5, 6, 7, 8, 7, 8]))
  back.release()

  // A count of zero, even at the window's end, writes nothing; the empty
  // record is taken with `tryPop`, since `peek` lends none of length 0.
  const z: u8[] = ring.reserve(4)
  stage(z, 4, body, 8, 0)
  ring.commit(0)
  t.eqI32("a zero-byte copy commits an empty record", back.tryPop(body, 0), 0)
  t.eqI32("leaving none", back.tryPop(body, 0), RING_EMPTY)

  t.ok("unlink the region", unlinkRegion(name).isOk())
  return t.done()
}
