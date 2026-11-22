// The lock-free rings (std/sync/ring.ts) under an instruction count, in one
// process and one thread: an `SpscRing` and an `MpscRing` side by side in one
// shared region, each round pushing a batch of records of several lengths
// and popping them back, the SPSC ring also by `reserve` and `commit` into
// its own memory and `peek` and `release` out of it. Every access is a
// checked `SharedRegion` access, so a fix to a panic site the std/ ratchet
// counts there shows here as a count that holds or falls. It prints the sum
// of what it popped.
import {
  MpscRing,
  RING_EMPTY,
  SpscRing,
  initMpscRing,
  initSpscRing,
  mpscRingBytes,
  spscRingBytes,
} from "nish/sync/ring"
import { createRegion, unlinkRegion } from "nish/sync/shm"

/** The region's name: fixed, so that no clock or pid reaches the count. */
const NAME: string = "nish-bench-std-ring"
/** The SPSC ring's data bytes. */
const SPSC_CAPACITY: i32 = 4096
/** The MPSC ring's slots and each slot's payload. */
const MPSC_SLOTS: i32 = 64
const MPSC_SLOT_BYTES: i32 = 64
/** Records pushed and popped per ring per round. */
const BATCH: i32 = 8

/** The length of record `k` of a batch: 0 to 61 bytes, never a multiple of 4 twice running. */
const lengthOf = (k: i32): i32 => (k * 23 + 5) % 62

/** The sum of `buf[off .. off + len)`. */
const sumOf = (buf: readonly u8[], off: i32, len: i32): i64 => {
  let sum: i64 = 0
  for (let k: i32 = off; k < off + len && k < toI32(buf.length); k++) {
    sum += toI64(buf[k])
  }
  return sum
}

/** One round of `BATCH` pushes and pops through `ring`, and one in-place record. */
const spscRound = (ring: SpscRing, src: u8[], dst: u8[], round: i32): i64 => {
  let sum: i64 = 0
  for (let k: i32 = 0; k < BATCH; k++) {
    if (!ring.tryPush(src, (round + k) & 63, lengthOf(k))) {
      panic("std-ring: the SPSC ring is full")
    }
  }
  for (let k: i32 = 0; k < BATCH; k++) {
    const len: i32 = ring.tryPop(dst, 0)
    if (len !== lengthOf(k)) {
      panic(`std-ring: SPSC record ${k} popped as ${len} bytes`)
    }
    sum += toI64(len) + sumOf(dst, 0, len)
  }
  const w: u8[] = ring.reserve(48)
  if (toI32(w.length) !== 48) {
    panic("std-ring: no room to reserve")
  }
  for (let k: i32 = 0; k < 40 && k < toI32(w.length); k++) {
    const from: i32 = (round + k) & 63
    if (from < toI32(src.length)) {
      w[k] = src[from]
    }
  }
  ring.commit(40)
  const r: readonly u8[] = ring.peek()
  if (toI32(r.length) === 40) {
    sum += sumOf(r, 0, 40)
    ring.release()
  } else {
    // A record across the lap's end is not lent; tryPop takes it.
    sum += toI64(ring.tryPop(dst, 0))
  }
  return sum
}

/** One round of `BATCH` pushes and pops through `ring`. */
const mpscRound = (ring: MpscRing, src: u8[], dst: u8[], round: i32): i64 => {
  let sum: i64 = 0
  for (let k: i32 = 0; k < BATCH; k++) {
    if (!ring.tryPush(src, (round + k) & 63, lengthOf(k))) {
      panic("std-ring: the MPSC ring is full")
    }
  }
  for (let k: i32 = 0; k < BATCH; k++) {
    const len: i32 = ring.tryPop(dst, 0)
    if (len !== lengthOf(k)) {
      panic(`std-ring: MPSC record ${k} popped as ${len} bytes`)
    }
    sum += toI64(len) + sumOf(dst, 0, len)
  }
  return sum
}

export const main = (): i32 => {
  const n: i32 = 8000 // bench:n
  const mpscAt: i32 = spscRingBytes(SPSC_CAPACITY)
  const bytes: i32 = mpscAt + mpscRingBytes(MPSC_SLOTS, MPSC_SLOT_BYTES)
  const region = createRegion(NAME, bytes).expect("create")
  // The name goes at once: the mapping stays, and no run leaves a region behind.
  unlinkRegion(NAME).expect("unlink")
  const spsc = initSpscRing(region, 0, SPSC_CAPACITY, false)
  const mpsc = initMpscRing(region, mpscAt, MPSC_SLOTS, MPSC_SLOT_BYTES, false)
  const src = new Array<u8>(128)
  for (let k: i32 = 0; k < toI32(src.length); k++) {
    src[k] = toU8((k * 37 + 11) & 255)
  }
  const dst = new Array<u8>(128)
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    sum += spscRound(spsc, src, dst, round)
    sum += mpscRound(mpsc, src, dst, round)
  }
  if (spsc.tryPop(dst, 0) !== RING_EMPTY || mpsc.tryPop(dst, 0) !== RING_EMPTY) {
    panic("std-ring: a ring holds a record no push made")
  }
  console.log(`${sum}`)
  return 0
}
