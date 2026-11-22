// The checked forms of `nish/sync/ring`, which answer where their twins panic:
//
//   1. `MpscRing.offer` answers RING_TOO_LONG for a length outside the slot
//      and RING_FULL for a full ring, and writes nothing for either;
//   2. `take` answers RING_CORRUPT for a slot whose length no producer
//      wrote, and leaves the slot where it was, so a second `take` answers
//      the same and a repaired length gives the record back; `takeWait`
//      answers RING_CORRUPT as `take` does, and RING_EMPTY when the wait
//      runs out with nothing offered; `offer` answers RING_CORRUPT for an
//      enqueue position written back in the header and RING_FULL for one
//      written far ahead, and `attachMpscRing` refuses a scribbled shape;
//   3. `tryInitMpscRing` answers Err for a shape no ring has and for a base
//      off a 64-byte boundary or past the region's end, and writes nothing;
//   4. `attachSpscRing` and `attachMpscRing` answer Err for a misaligned base
//      and for one outside the region;
//   5. a child pushing a record 3 bytes short of 2^31 onto an SPSC ring stops
//      with the ring's own "does not fit" panic: rounded up to a multiple of
//      8 that length wraps negative, so the length is tested before it is
//      rounded.
import { readFileSyncOrNull } from "nish:fs"
import { monotonicNanos, platform, spawnSyncTo } from "nish:process"
import {
  attachMpscRing,
  attachSpscRing,
  initSpscRing,
  RING_CORRUPT,
  RING_EMPTY,
  RING_FULL,
  RING_TOO_LONG,
  tryInitMpscRing,
} from "nish/sync/ring"
import { createRegion, openRegion, RELAXED, SHM_UNSUPPORTED, SharedRegion, unlinkRegion } from "nish/sync/shm"
import { Suite } from "nish/testing"

const BYTES: i32 = 4096
const MPSC_AT: i32 = 0 // 4 slots of 16 bytes: 256 + 4 * 32 = 384 bytes
const SPSC_AT: i32 = 1024 // 64 bytes of data: 320 bytes
// A ring's header is 256 bytes and its slots follow; each slot is the
// sequence number (i64), the length (i32) and padding, then the record.
const SLOT0_LEN_AT: i32 = MPSC_AT + 256 + 8
// The header's enqueue position (an i64) and slot count.
const TAIL_AT: i32 = MPSC_AT + 64
const SLOTS_AT: i32 = MPSC_AT + 8

const offers = (t: Suite, region: SharedRegion): void => {
  const made = tryInitMpscRing(region, MPSC_AT, 4, 16, false)
  if (made.isErr()) {
    t.fail("tryInitMpscRing makes a ring of 4 slots of 16 bytes", made.error)
    return
  }
  const ring = made.value
  const src: u8[] = new Array<u8>(32)
  for (let i: i32 = 0; i < 32; i++) {
    src[i] = toU8(i + 1)
  }
  const dst: u8[] = new Array<u8>(32)
  t.eqI32("offer answers RING_TOO_LONG for a record above the slot", ring.offer(src, 0, 17), RING_TOO_LONG)
  t.eqI32("and for a negative length", ring.offer(src, 0, -1), RING_TOO_LONG)
  t.eqI32("and queues nothing", ring.take(dst, 0), RING_EMPTY)
  for (let i: i32 = 0; i < 4; i++) {
    t.eqI32(`offer queues record ${i}`, ring.offer(src, i, 8), 0)
  }
  t.eqI32("offer answers RING_FULL for a full ring", ring.offer(src, 0, 8), RING_FULL)
  for (let i: i32 = 0; i < 4; i++) {
    t.eqI32(`take gives record ${i} back`, ring.take(dst, 0), 8)
    t.eqI32(`record ${i} reads as it was offered`, toI32(dst[0]), i + 1)
  }
  t.eqI32("leaving none", ring.take(dst, 0), RING_EMPTY)
}

const corrupt = (t: Suite, region: SharedRegion): void => {
  const made = tryInitMpscRing(region, MPSC_AT, 4, 16, false)
  if (made.isErr()) {
    t.fail("tryInitMpscRing resets the ring", made.error)
    return
  }
  const ring = made.value
  const src: u8[] = [7, 7, 7, 7, 7, 7, 7, 7]
  const dst: u8[] = new Array<u8>(16)
  t.eqI32("a record is offered", ring.offer(src, 0, 8), 0)
  region.storeI32(SLOT0_LEN_AT, 2147483645, RELAXED)
  t.eqI32("take answers RING_CORRUPT for a length no producer wrote", ring.take(dst, 0), RING_CORRUPT)
  t.eqI32("and leaves the slot, so it answers the same again", ring.take(dst, 0), RING_CORRUPT)
  t.eqI32("as does takeWait", ring.takeWait(dst, 0, 10), RING_CORRUPT)
  region.storeI32(SLOT0_LEN_AT, -4, RELAXED)
  t.eqI32("a negative length is RING_CORRUPT too", ring.take(dst, 0), RING_CORRUPT)
  region.storeI32(SLOT0_LEN_AT, 8, RELAXED)
  t.eqI32("with the length repaired, take gives the record back", ring.take(dst, 0), 8)
  t.eqI32("as it was offered", toI32(dst[7]), 7)
  t.eqI32("a ring with no doorbell answers takeWait with SHM_UNSUPPORTED", ring.takeWait(dst, 0, 10), SHM_UNSUPPORTED)
  // The header, which every producer reads: a position written back is
  // RING_CORRUPT, not a spin, and one written far ahead reads as full.
  t.eqI32("a second record is offered", ring.offer(src, 0, 8), 0)
  region.storeI64(TAIL_AT, toI64(0), RELAXED)
  t.eqI32("offer answers RING_CORRUPT for an enqueue position written back", ring.offer(src, 0, 8), RING_CORRUPT)
  region.storeI64(TAIL_AT, toI64(1000000), RELAXED)
  t.eqI32("and RING_FULL for one written far ahead", ring.offer(src, 0, 8), RING_FULL)
  region.storeI64(TAIL_AT, toI64(2), RELAXED)
  t.eqI32("with the position repaired, take gives the second record back", ring.take(dst, 0), 8)
  region.storeI32(SLOTS_AT, 3, RELAXED)
  t.ok("attachMpscRing refuses a header whose slot count was scribbled", attachMpscRing(region, MPSC_AT).isErr())
  region.storeI32(SLOTS_AT, 4, RELAXED)
  const belled = tryInitMpscRing(region, MPSC_AT, 4, 16, true)
  if (belled.isErr()) {
    t.fail("tryInitMpscRing makes a ring with a doorbell", belled.error)
    return
  }
  // The doorbell is a futex, which only Linux has; elsewhere the wait is
  // refused before it starts.
  const waited: i32 = belled.value.takeWait(dst, 0, 10)
  t.eqI32(
    "takeWait answers RING_EMPTY when the wait runs out",
    waited,
    platform === "linux" ? RING_EMPTY : SHM_UNSUPPORTED
  )
}

const places = (t: Suite, region: SharedRegion): void => {
  const at = "nish/sync/ring: an MPSC ring at"
  const shape = tryInitMpscRing(region, MPSC_AT, 3, 16, false)
  t.ok("tryInitMpscRing refuses 3 slots", shape.isErr())
  if (shape.isErr()) {
    t.contains("saying why", shape.error, "not 3 of 16")
  }
  t.ok("and a slot of 12 bytes", tryInitMpscRing(region, MPSC_AT, 4, 12, false).isErr())
  t.ok("and a slot of 0 bytes", tryInitMpscRing(region, MPSC_AT, 4, 0, false).isErr())
  const odd = tryInitMpscRing(region, 72, 4, 16, false)
  t.ok("and a base off a 64-byte boundary", odd.isErr())
  if (odd.isErr()) {
    t.eqStr("saying why", odd.error, `${at} 72: a ring's base is a multiple of 64`)
  }
  const past = tryInitMpscRing(region, 3840, 4, 16, false)
  t.ok("and a ring that runs past the region", past.isErr())
  if (past.isErr()) {
    t.eqStr("saying why", past.error, `${at} 3840 needs 384 bytes; the region has ${BYTES}`)
  }
  t.ok("and a negative base", tryInitMpscRing(region, -64, 4, 16, false).isErr())
  const there = attachMpscRing(region, MPSC_AT)
  t.ok("none of which wrote over the ring that was there", there.isOk())
  t.ok("attachMpscRing refuses a misaligned base", attachMpscRing(region, MPSC_AT + 8).isErr())
  const beyond = attachMpscRing(region, BYTES)
  t.ok("and a base at the region's end", beyond.isErr())
  if (beyond.isErr()) {
    t.eqStr("saying why", beyond.error, `${at} ${BYTES} needs 256 bytes; the region has ${BYTES}`)
  }
  t.ok("and a negative base", attachMpscRing(region, -64).isErr())
  initSpscRing(region, SPSC_AT, 64, false)
  t.ok("attachSpscRing finds the SPSC ring", attachSpscRing(region, SPSC_AT).isOk())
  const misplaced = attachSpscRing(region, SPSC_AT + 4)
  t.ok("and refuses a misaligned base", misplaced.isErr())
  if (misplaced.isErr()) {
    t.eqStr(
      "saying why",
      misplaced.error,
      `nish/sync/ring: an SPSC ring at ${SPSC_AT + 4}: a ring's base is a multiple of 64`
    )
  }
  t.ok("and a base past the region's end", attachSpscRing(region, BYTES + 64).isErr())
  t.ok("and a negative base", attachSpscRing(region, -64).isErr())
}

/** The child: pushes a record 3 bytes short of 2^31, which must panic. */
const child = (name: string): i32 => {
  const opened = openRegion(name)
  if (opened.isErr()) {
    return 2
  }
  const ring = attachSpscRing(opened.value, SPSC_AT)
  if (ring.isErr()) {
    return 2
  }
  const src: u8[] = new Array<u8>(8)
  ring.value.tryPush(src, 0, 2147483645)
  return 0
}

export const main = (): i32 => {
  if (process.argv.length > 2 && process.argv[1] === "child") {
    return child(process.argv[2])
  }
  const t = new Suite("nish/sync/ring checked")
  const name: string = `nish-ringchk-${monotonicNanos() % toI64(1000000000)}`
  const made = createRegion(name, BYTES)
  if (made.isErr()) {
    t.fail("create a region", made.error.message)
    return t.done()
  }
  const region = made.value
  offers(t, region)
  corrupt(t, region)
  places(t, region)
  const err: string = "build/sync-ring-checked-wrap.err"
  t.eqI32("a record 3 bytes short of 2^31 stops the child", spawnSyncTo([process.argv[0], "child", name], "", err), 1)
  const text: string | null = readFileSyncOrNull(err)
  t.contains(
    "with the ring's own panic",
    text === null ? "" : text,
    "a record of 2147483645 bytes does not fit a ring of 64"
  )
  t.ok("unlink the region", unlinkRegion(name).isOk())
  return t.done()
}
