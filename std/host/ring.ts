/**
 * `nish/host/ring` — a single-producer, single-consumer ring of `i32` words
 * over module storage, shared by a wasm module and the page that drives it
 * (`docs/wp50-wasm-host.md` §11).
 *
 * The ring is an `Int32Array` the program declares as module storage, so the
 * page reaches the same words through the `Layout` the loader hands it:
 *
 *     import { ringShift, ringSize } from "nish/host/ring";
 *
 *     const INPUT = new Int32Array(2 + 64); // head, tail, then 64 slots
 *
 *     export function tick(): void {
 *       while (ringSize(INPUT) > 0) {
 *         steer(ringShift(INPUT));
 *       }
 *     }
 *
 * Word 0 is the **head** and word 1 the **tail**, each a count of words taken
 * and put kept modulo twice the capacity (the length less two), so neither
 * overflows and `tail - head` (modulo the same) is the number waiting: 0 is
 * empty and the capacity is full. Slot `count % capacity` holds the word put
 * at that count. One side only advances the tail and the other only the head:
 * that is the whole protocol, and it needs no atomics because the page and the
 * module run on one thread and never at once. `nish/page`'s `ringOver` is the
 * page's half, over the same layout and arithmetic.
 *
 * A zero-filled ring (what module storage starts as) is empty. A ring whose
 * counts a buggy page wrote out of protocol is still never read out of
 * bounds: each count is reduced modulo twice the capacity before it is used,
 * and a size past the capacity reads as full, so `ringPush` refuses and
 * `ringShift` takes words until the counts agree again.
 */

/** Head, tail: the two words in front of the slots. */
const RING_HEADER: i32 = 2

/** The number of slots, the ring's length less its header; 0 for a ring too short to have one. */
export const ringCapacity = (ring: Int32Array): i32 => {
  const length: i32 = toI32(ring.length)
  return length > RING_HEADER ? length - RING_HEADER : 0
}

/** `count` brought into `[0, 2 * capacity)`, whatever a page wrote there. */
const ringCount = (count: i32, capacity: i32): i32 => {
  const m: i32 = capacity * 2
  const r: i32 = count % m
  return r < 0 ? r + m : r
}

/** The number of words put and not yet taken, at most the capacity. */
export const ringSize = (ring: Int32Array): i32 => {
  const capacity: i32 = ringCapacity(ring)
  if (capacity === 0) {
    return 0
  }
  const size: i32 = ringCount(ringCount(ring[1], capacity) - ringCount(ring[0], capacity), capacity)
  return size > capacity ? capacity : size
}

/** The number of words `ringPush` would still take. */
export const ringFree = (ring: Int32Array): i32 => ringCapacity(ring) - ringSize(ring)

/** Puts `word` at the tail and answers true, or answers false and changes nothing when the ring is full. */
export const ringPush = (ring: Int32Array, word: i32): boolean => {
  const capacity: i32 = ringCapacity(ring)
  if (capacity === 0 || ringSize(ring) >= capacity) {
    return false
  }
  const tail: i32 = ringCount(ring[1], capacity)
  ring[RING_HEADER + (tail % capacity)] = word
  ring[1] = ringCount(tail + 1, capacity)
  return true
}

/**
 * Takes the word at the head. On an empty ring it answers 0 and changes
 * nothing, so a caller that cannot tell 0 from empty asks `ringSize` first.
 */
export const ringShift = (ring: Int32Array): i32 => {
  const capacity: i32 = ringCapacity(ring)
  if (capacity === 0 || ringSize(ring) === 0) {
    return 0
  }
  const head: i32 = ringCount(ring[0], capacity)
  const word: i32 = ring[RING_HEADER + (head % capacity)]
  ring[0] = ringCount(head + 1, capacity)
  return word
}

/** Empties the ring: the head catches up with the tail, and the slots keep their stale words. */
export const ringClear = (ring: Int32Array): void => {
  if (toI32(ring.length) >= RING_HEADER) {
    ring[0] = ring[1]
  }
}
