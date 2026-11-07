// `nish/host/ring`: an empty ring, filling to capacity and refusing one more,
// first in first out across the wrap of the slot index and of the counts, a
// ring too short to hold a slot, and a ring whose counts a page wrote out of
// protocol still read inside its slots. The ring is module storage lent to
// the ring's `Int32Array` parameters, as a wasm module holds it.
import { ringCapacity, ringClear, ringFree, ringPush, ringShift, ringSize } from "nish/host/ring"
import { Suite } from "nish/testing"

const RING = new Int32Array(2 + 4)

export const main = (): number => {
  const t = new Suite("ring")

  t.eqI32("empty: capacity is the length less two", ringCapacity(RING), 4)
  t.eqI32("empty: nothing waits", ringSize(RING), 0)
  t.eqI32("empty: shift answers 0", ringShift(RING), 0)
  t.eqI32("empty: shift leaves the head", RING[0], 0)

  t.ok("fill: 1", ringPush(RING, 11))
  t.ok("fill: 2", ringPush(RING, 12))
  t.ok("fill: 3", ringPush(RING, 13))
  t.ok("fill: 4", ringPush(RING, -14))
  t.eqBool("fill: a fifth is refused", ringPush(RING, 15), false)
  t.eqI32("fill: the tail did not move", RING[1], 4)
  t.eqI32("fill: no room", ringFree(RING), 0)

  t.eqI32("order: first in", ringShift(RING), 11)
  t.eqI32("order: second", ringShift(RING), 12)
  t.ok("wrap: a push after a shift lands in slot 0", ringPush(RING, 15))
  t.eqI32("wrap: slot 0 holds it", RING[2], 15)
  t.eqI32("wrap: 13", ringShift(RING), 13)
  t.eqI32("wrap: a negative word", ringShift(RING), -14)
  t.eqI32("wrap: 15", ringShift(RING), 15)
  t.eqI32("wrap: empty again", ringSize(RING), 0)

  // The counts run modulo twice the capacity: 5 + 9 moves is 14, which is 6.
  for (let i = 0; i < 9; i++) {
    ringPush(RING, i)
    ringShift(RING)
  }
  t.eqI32("counts: the head wrapped to 6", RING[0], 6)
  t.eqI32("counts: the tail wrapped to 6", RING[1], 6)
  t.ok("counts: a push across the wrap", ringPush(RING, 21))
  t.eqI32("counts: one waits", ringSize(RING), 1)
  t.eqI32("counts: 21", ringShift(RING), 21)

  ringPush(RING, 31)
  ringClear(RING)
  t.eqI32("clear: nothing waits", ringSize(RING), 0)

  // A page that wrote counts out of protocol: they are reduced before use, a
  // size past the capacity reads as full, and every slot read is in the ring.
  RING[0] = 0
  RING[1] = 7
  t.eqI32("forged: the size is capped at the capacity", ringSize(RING), 4)
  t.eqBool("forged: a push is refused", ringPush(RING, 41), false)
  ringShift(RING)
  t.eqI32("forged: a shift advanced the head", RING[0], 1)
  RING[0] = -2147483648
  RING[1] = 2147483647
  t.ok("forged: extreme counts still answer a size in range", ringSize(RING) <= 4)
  ringShift(RING)
  t.ok("forged: and a shift stays in the ring", RING[0] >= 0 && RING[0] < 8)

  const short = new Int32Array(2)
  t.eqI32("short: no slots", ringCapacity(short), 0)
  t.eqBool("short: a push is refused", ringPush(short, 1), false)
  t.eqI32("short: a shift answers 0", ringShift(short), 0)
  return t.done()
}
