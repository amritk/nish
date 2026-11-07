// `nish/host/ring`: an empty ring, filling to capacity and refusing one more,
// first in first out across the wrap of the slot index, the counts wrapping
// at 2^32, a ring too short to hold a slot, and a ring whose counts a page
// wrote out of protocol still read inside its slots.
import { ringCapacity, ringClear, ringFree, ringPush, ringShift, ringSize } from "nish/host/ring"
import { Suite } from "nish/testing"

const RING = new Array<u32>(2 + 4)

export const main = (): number => {
  const t = new Suite("ring")

  t.eqI32("empty: capacity is the length less two", toI32(ringCapacity(RING)), 4)
  t.eqI32("empty: nothing waits", toI32(ringSize(RING)), 0)
  t.eqI32("empty: shift answers 0", toI32(ringShift(RING)), 0)
  t.eqI32("empty: shift leaves the head", toI32(RING[0]), 0)

  t.ok("fill: 1", ringPush(RING, 11))
  t.ok("fill: 2", ringPush(RING, 12))
  t.ok("fill: 3", ringPush(RING, 13))
  t.ok("fill: 4", ringPush(RING, 14))
  t.eqBool("fill: a fifth is refused", ringPush(RING, 15), false)
  t.eqI32("fill: the tail did not move", toI32(RING[1]), 4)
  t.eqI32("fill: no room", toI32(ringFree(RING)), 0)

  t.eqI32("order: first in", toI32(ringShift(RING)), 11)
  t.eqI32("order: second", toI32(ringShift(RING)), 12)
  t.ok("wrap: a push after a shift lands in slot 0", ringPush(RING, 15))
  t.eqI32("wrap: slot 0 holds it", toI32(RING[2]), 15)
  t.eqI32("wrap: 13", toI32(ringShift(RING)), 13)
  t.eqI32("wrap: 14", toI32(ringShift(RING)), 14)
  t.eqI32("wrap: 15", toI32(ringShift(RING)), 15)
  t.eqI32("wrap: empty again", toI32(ringSize(RING)), 0)

  // The counts only grow; at 2^32 they wrap, and the size is still their difference.
  RING[0] = 4294967294
  RING[1] = 4294967294
  t.ok("counts: push at 2^32 - 2", ringPush(RING, 21))
  t.ok("counts: push at 2^32 - 1", ringPush(RING, 22))
  t.ok("counts: push at 0", ringPush(RING, 23))
  t.eqI32("counts: the tail wrapped", toI32(RING[1]), 1)
  t.eqI32("counts: three wait", toI32(ringSize(RING)), 3)
  t.eqI32("counts: 21", toI32(ringShift(RING)), 21)
  t.eqI32("counts: 22", toI32(ringShift(RING)), 22)
  t.eqI32("counts: 23", toI32(ringShift(RING)), 23)

  ringPush(RING, 31)
  ringClear(RING)
  t.eqI32("clear: nothing waits", toI32(ringSize(RING)), 0)

  // A page that wrote a tail far past the head: the size reads as full, a push
  // is refused, and a shift reads a slot inside the ring.
  RING[0] = 0
  RING[1] = 1000
  t.eqI32("forged: the size is capped at the capacity", toI32(ringSize(RING)), 4)
  t.eqBool("forged: a push is refused", ringPush(RING, 41), false)
  ringShift(RING)
  t.eqI32("forged: a shift advanced the head", toI32(RING[0]), 1)

  const short: u32[] = [7, 7]
  t.eqI32("short: no slots", toI32(ringCapacity(short)), 0)
  t.eqBool("short: a push is refused", ringPush(short, 1), false)
  t.eqI32("short: a shift answers 0", toI32(ringShift(short)), 0)
  return t.done()
}
