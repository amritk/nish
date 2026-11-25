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
 *     export const tick = (): void => {
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

/**
 * The most slots a ring uses, 2^30 - 1: its counts run modulo twice the
 * capacity, and twice the capacity must fit an `i32`. Wasm memory cannot hold
 * a longer ring; a longer native one leaves the slots past that unused.
 */
type RingSlots = integer<0, 1073741823>

/** A count reduced modulo twice the capacity. */
type RingCount = integer<0, 2147483645>

/** The slot count of `ring`: its length less the head and tail, at most `RingSlots`' end. */
const ringSlots = (ring: Int32Array): RingSlots => {
  const length: i32 = toI32(ring.length)
  if (length <= 2) {
    return 0
  }
  if (length > 1073741825) {
    return 1073741823
  }
  const slots: i32 = length - 2
  return slots
}

/**
 * The number of slots, the ring's length less its header, at most 2^30 - 1.
 *
 * @param ring - the ring's storage: head, tail, then its slots
 * @returns the slot count, or 0 for a ring too short to have one
 */
export const ringCapacity = (ring: Int32Array): i32 => ringSlots(ring)

/** `count` brought into `[0, 2 * capacity)`, whatever a page wrote there. */
const ringCount = (count: i32, capacity: RingSlots): RingCount => {
  const span: i32 = capacity * 2
  // 0 for a ring with no slots. The second test is never true, the capacity
  // being at most 2^30 - 1, and is the bound on `span` the last test reads.
  if (span <= 0 || span > 2147483646) {
    return 0
  }
  let r: i32 = count % span
  if (r < 0) {
    r = r + span
  }
  // Never true: `%` leaves `r` above `-span` and the step above lifts a
  // negative one into `[0, span)`. A `%` by a variable gives the prover no
  // range, so the test restates it where the ranged return reads it.
  if (r < 0 || r >= span) {
    return 0
  }
  return r
}

/** The words waiting in `ring` of `capacity` slots: a size past it reads as full. */
const ringWaiting = (ring: Int32Array, capacity: RingSlots): RingSlots => {
  if (capacity === 0 || toI32(ring.length) < 2) {
    return 0
  }
  const tail: RingCount = ringCount(ring[1], capacity)
  const head: RingCount = ringCount(ring[0], capacity)
  const size: RingCount = ringCount(tail - head, capacity)
  if (size > capacity) {
    return capacity
  }
  return size
}

/**
 * The number of words put and not yet taken.
 *
 * @param ring - the ring's storage: head, tail, then its slots
 * @returns the words waiting, at most the capacity
 */
export const ringSize = (ring: Int32Array): i32 => ringWaiting(ring, ringSlots(ring))

/**
 * The number of words `ringPush` would still take.
 *
 * @param ring - the ring's storage: head, tail, then its slots
 * @returns the free slots
 */
export const ringFree = (ring: Int32Array): i32 => {
  const capacity: RingSlots = ringSlots(ring)
  const waiting: RingSlots = ringWaiting(ring, capacity)
  return capacity - waiting
}

/**
 * Puts `word` at the tail, or changes nothing when the ring is full.
 *
 * @param ring - the ring's storage: head, tail, then its slots
 * @param word - the word to put
 * @returns true when the word was put, false when the ring was full
 */
export const ringPush = (ring: Int32Array, word: i32): boolean => {
  const capacity: RingSlots = ringSlots(ring)
  if (capacity === 0 || ringWaiting(ring, capacity) >= capacity) {
    return false
  }
  if (toI32(ring.length) < 2) {
    return false
  }
  const length: i32 = toI32(ring.length)
  const tail: RingCount = ringCount(ring[1], capacity)
  // The tail is `base + at`: `base` is 0 or the capacity, `at` the slot.
  let base: i32 = 0
  let at: i32 = tail
  if (at >= capacity) {
    base = capacity
    at = at - capacity
  }
  // Never true: the tail is below twice the capacity, and the capacity is at
  // most the length less two. The prover reads neither through the calls, so
  // the test is what proves the store and the next count.
  if (at < 0 || at >= capacity || at >= length - 2) {
    return false
  }
  ring[2 + at] = word
  let next: i32 = at + 1
  if (next === capacity) {
    next = 0
    base = capacity - base
  }
  ring[1] = base + next
  return true
}

/**
 * Takes the word at the head. On an empty ring it answers 0 and changes
 * nothing, so a caller that cannot tell 0 from empty asks `ringSize` first.
 *
 * @param ring - the ring's storage: head, tail, then its slots
 * @returns the word taken, or 0 on an empty ring
 */
export const ringShift = (ring: Int32Array): i32 => {
  const capacity: RingSlots = ringSlots(ring)
  if (capacity === 0 || ringWaiting(ring, capacity) === 0) {
    return 0
  }
  if (toI32(ring.length) < 2) {
    return 0
  }
  const length: i32 = toI32(ring.length)
  const head: RingCount = ringCount(ring[0], capacity)
  // The head is `base + at`, as the tail is in `ringPush`.
  let base: i32 = 0
  let at: i32 = head
  if (at >= capacity) {
    base = capacity
    at = at - capacity
  }
  // Never true, for the reasons `ringPush` gives; the test proves the read.
  if (at < 0 || at >= capacity || at >= length - 2) {
    return 0
  }
  const word: i32 = ring[2 + at]
  let next: i32 = at + 1
  if (next === capacity) {
    next = 0
    base = capacity - base
  }
  ring[0] = base + next
  return word
}

/**
 * Empties the ring: the head catches up with the tail, and the slots keep their stale words.
 *
 * @param ring - the ring's storage: head, tail, then its slots
 */
export const ringClear = (ring: Int32Array): void => {
  if (toI32(ring.length) >= 2) {
    ring[0] = ring[1]
  }
}
