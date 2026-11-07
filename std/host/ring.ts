/**
 * `nish/host/ring` — a single-producer, single-consumer ring of `u32` words
 * over module storage, shared by a wasm module and the page that drives it
 * (`docs/wp50-wasm-host.md` §11).
 *
 * The ring is a `u32[]` the program declares as module storage, so the page
 * reaches the same words through the `Layout` the loader hands it:
 *
 *     import { ringPush, ringShift, ringSize } from "nish/host/ring";
 *
 *     const INPUT = new Array<u32>(2 + 64); // head, tail, then 64 slots
 *
 *     export function tick(): void {
 *       while (ringSize(INPUT) > 0) {
 *         steer(ringShift(INPUT));
 *       }
 *     }
 *
 * Word 0 is the **head**, the count of words ever taken; word 1 is the
 * **tail**, the count of words ever put. Both only grow, wrapping at 2^32, so
 * `tail - head` (wrapping) is the number waiting and is never more than the
 * capacity, the length less two. Slot `count % capacity` holds the word put
 * at that count. One side only advances the tail and the other only the head:
 * that is the whole protocol, and it needs no atomics because the page and the
 * module run on one thread and never at once. `nish/page`'s `ringOver` is the
 * page's half, over the same three-part layout.
 *
 * A zero-filled ring (what module storage starts as) is empty. A ring whose
 * words a buggy page wrote out of protocol is still never read out of bounds:
 * each slot index is reduced modulo the capacity, and a size larger than the
 * capacity reads as full, so `ringPush` refuses and `ringShift` takes words
 * until the counts agree again.
 */

/** Head, tail: the two words in front of the slots. */
const RING_HEADER: i32 = 2

/** The number of slots, the ring's length less its header; 0 for a ring too short to have one. */
export const ringCapacity = (ring: readonly u32[]): u32 => {
  const n: i32 = toI32(ring.length)
  return n > RING_HEADER ? toU32(n - RING_HEADER) : 0
}

/** The number of words put and not yet taken, at most the capacity. */
export const ringSize = (ring: readonly u32[]): u32 => {
  const capacity: u32 = ringCapacity(ring)
  if (capacity === 0) {
    return 0
  }
  const size: u32 = ring[1] - ring[0]
  return size > capacity ? capacity : size
}

/** The number of words `ringPush` would still take. */
export const ringFree = (ring: readonly u32[]): u32 => ringCapacity(ring) - ringSize(ring)

/** Puts `word` at the tail and answers true, or answers false and changes nothing when the ring is full. */
export const ringPush = (ring: u32[], word: u32): boolean => {
  const capacity: u32 = ringCapacity(ring)
  if (capacity === 0 || ring[1] - ring[0] >= capacity) {
    return false
  }
  const tail: u32 = ring[1]
  ring[RING_HEADER + toI32(tail % capacity)] = word
  ring[1] = tail + 1
  return true
}

/**
 * Takes the word at the head. On an empty ring it answers 0 and changes
 * nothing, so a caller that cannot tell 0 from empty asks `ringSize` first.
 */
export const ringShift = (ring: u32[]): u32 => {
  const capacity: u32 = ringCapacity(ring)
  if (capacity === 0 || ring[1] === ring[0]) {
    return 0
  }
  const head: u32 = ring[0]
  const word: u32 = ring[RING_HEADER + toI32(head % capacity)]
  ring[0] = head + 1
  return word
}

/** Empties the ring: the head catches up with the tail, and the slots keep their stale words. */
export const ringClear = (ring: u32[]): void => {
  if (ring.length >= RING_HEADER) {
    ring[0] = ring[1]
  }
}
