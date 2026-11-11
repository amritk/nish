// `SpscRing.reserve` against a ring that is partly full, in one process: the
// consumer's position is not 0 and records are queued when each reservation
// is made, so every answer depends on where the consumer is, not only on
// where the producer is. One ring of 64 bytes (a reservation is at most 28):
//
//   1. a reservation that fits the rest of the lap is lent where the
//      producer is, and the records queued before it keep their order;
//   2. one that has to wrap answers empty while the bytes free, though
//      enough in total, are not contiguous behind a skip marker, and is lent
//      at the lap's start, behind a marker, once the consumer has moved;
//   3. one that does not fit the bytes free answers empty, one that fills
//      them exactly is lent, and a full ring answers empty;
//   4. everything drains in order, the marker stepped over, and an empty
//      ring then has room for the largest reservation even where it must
//      wrap, as `reserve`'s doc comment says.
//
// `tests/link/sync_ring_inplace` covers the rest of the in-place surface
// and the cross-process run.
import { monotonicNanos } from "nish:process"
import { attachSpscRing, initSpscRing, RING_EMPTY, spscRingBytes } from "nish/sync/ring"
import { createRegion, RELAXED, unlinkRegion } from "nish/sync/shm"
import { Suite } from "nish/testing"

const CAP: i32 = 64
/** Where the ring's data starts in the region: after its 256-byte header. */
const DATA_AT: i32 = 256

/** Writes `len` bytes from 0: `seed`, `seed + 1`, ... */
const fill = (buf: u8[], len: i32, seed: i32): void => {
  for (let i = 0; i < len && i < buf.length; i++) {
    buf[i] = toU8((seed + i) & 255)
  }
}

/** Whether the first `len` bytes of `buf` are what `fill` wrote, and `buf` holds at least that many. */
const filled = (buf: readonly u8[], len: i32, seed: i32): boolean => {
  if (len > buf.length) {
    return false
  }
  for (let i = 0; i < len; i++) {
    if (buf[i] !== toU8((seed + i) & 255)) {
      return false
    }
  }
  return true
}

export const main = (): i32 => {
  const t = new Suite("nish/sync/ring in place, partly full")
  const name: string = `nish-test-ringp-${monotonicNanos() % toI64(1000000000)}`
  const made = createRegion(name, spscRingBytes(CAP))
  if (made.isErr()) {
    t.fail("create a region", made.error.message)
    return t.done()
  }
  const region = made.value
  const ring = initSpscRing(region, 0, CAP, false)
  const back = attachSpscRing(region, 0).expect("attach the ring")
  t.eqI32("the ring's data follows its header", spscRingBytes(CAP), DATA_AT + CAP)
  const src: u8[] = new Array<u8>(8)
  const dst: u8[] = new Array<u8>(CAP)

  // Three records of 8 bytes (12 each) at 0, 12 and 24; the first is taken,
  // so the consumer is at 12 and 24 bytes are queued, up to 36.
  for (let k = 0; k < 3; k++) {
    fill(src, 8, 10 + k)
    t.ok(`record ${k + 1} of 8 bytes is pushed`, ring.tryPush(src, 0, 8))
  }
  t.eqI32("the consumer takes the first record", back.tryPop(dst, 0), 8)

  // 1. 28 bytes are left in the lap: a reservation of 12 (16 bytes) fits there.
  const w: u8[] = ring.reserve(12)
  t.eqI32("a reservation that fits the rest of the lap is lent", toI32(w.length), 12)
  fill(w, 12, 20)
  t.ok("its window is the ring's bytes where the producer is", region.loadI32(DATA_AT + 40, RELAXED) === 0x17161514)
  ring.commit(12) // 36..52

  // 2. 24 bytes are free, 12 at the lap's end and 12 at its start: a
  // reservation of 12 would need the 12 for a skip marker and 16 more.
  t.eqI32("one that must wrap answers empty while the free bytes are not contiguous", toI32(ring.reserve(12).length), 0)
  t.eqI32("the consumer takes the second record", back.tryPop(dst, 0), 8)
  t.ok("whole", filled(dst, 8, 11))
  // The consumer is at 24: the 12 at the end and 24 at the start are free.
  const wrapped: u8[] = ring.reserve(12)
  t.eqI32("and is lent once the consumer has moved", toI32(wrapped.length), 12)
  fill(wrapped, 12, 21)
  t.ok("at the start of the lap", region.loadI32(DATA_AT + 4, RELAXED) === 0x18171615)
  ring.commit(12)
  t.eqI32("behind a skip marker at the end of the last", region.loadI32(DATA_AT + 52, RELAXED), -1)
  t.eqI32("its length word at 0", region.loadI32(DATA_AT, RELAXED), 12)

  // 3. The producer is at 16 in the lap and the consumer at 24: 8 bytes free.
  t.eqI32("a reservation of 5 (12 bytes) does not fit the 8 free", toI32(ring.reserve(5).length), 0)
  const last: u8[] = ring.reserve(4)
  t.eqI32("one of 4 (8 bytes) fills them exactly", toI32(last.length), 4)
  fill(last, 4, 22)
  ring.commit(4) // 16..24
  t.eqI32("a full ring answers empty", toI32(ring.reserve(1).length), 0)

  // 4. Every record, in order: the third pushed, then the three reserved.
  const third: readonly u8[] = back.peek()
  t.ok("peek lends the third record pushed", third.length === 8 && filled(third, 8, 12))
  back.release()
  const fitted: readonly u8[] = back.peek()
  t.ok("then the one reserved in the rest of the lap", fitted.length === 12 && filled(fitted, 12, 20))
  back.release()
  const after: readonly u8[] = back.peek()
  t.ok("then steps over the skip marker to the one that wrapped", after.length === 12 && filled(after, 12, 21))
  back.release()
  t.eqI32("tryPop takes the one that filled the ring", back.tryPop(dst, 0), 4)
  t.ok("whole", filled(dst, 4, 22))
  t.eqI32("leaving none", back.tryPop(dst, 0), RING_EMPTY)

  // The ring is empty with both at 24 in the lap; one more record of 8 moves
  // them to 36, where the largest reservation, 28 (32 bytes), does not fit
  // the 28 left and must wrap behind a marker.
  t.ok("a record of 8 is pushed into the empty ring", ring.tryPush(src, 0, 8))
  t.eqI32("and taken", back.tryPop(dst, 0), 8)
  const most: u8[] = ring.reserve(28)
  t.eqI32("an empty ring has room for the largest reservation where it must wrap", toI32(most.length), 28)
  fill(most, 28, 30)
  ring.commit(28)
  t.eqI32("behind a skip marker", region.loadI32(DATA_AT + 36, RELAXED), -1)
  t.eqI32("which tryPop steps over", back.tryPop(dst, 0), 28)
  t.ok("to the record", filled(dst, 28, 30))

  t.ok("unlink the region", unlinkRegion(name).isOk())
  return t.done()
}
