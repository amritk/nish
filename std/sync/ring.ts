/**
 * `nish/sync/ring` — bounded lock-free queues of byte records in a shared
 * region, for handing work between processes on different cores.
 *
 *     import { createRegion, unlinkRegion } from "nish/sync/shm"
 *     import { initSpscRing, attachSpscRing, spscRingBytes } from "nish/sync/ring"
 *
 *     const region = createRegion("jobs", spscRingBytes(65536)).expect("region")
 *     const ring = initSpscRing(region, 0, 65536, true)
 *     ring.tryPush(job, 0, job.length) // false when full
 *
 *     // The other process, with the region opened by name:
 *     const ring = attachSpscRing(region, 0).expect("ring")
 *     const n = ring.popWait(buf, 0, 1000) // the record's length, or RING_EMPTY
 *
 * **Two rings.** `SpscRing` has one producer and one consumer, and holds
 * records of any length up to its capacity back to back: a record costs its
 * length rounded up to 4, plus 4. `MpscRing` takes any number of producers
 * and one consumer, in fixed slots of `slotBytes` each (Vyukov's bounded
 * queue: a producer claims a slot with a compare-exchange on the enqueue
 * position, and each slot's sequence number says whose turn it is). Neither
 * takes a lock, so a push or a pop in a busy ring is a handful of loads and
 * stores and no system call.
 *
 * **A ring lives at `base` in a `SharedRegion`.** `initSpscRing` and
 * `initMpscRing` write its header there, which the process that creates the
 * region does once, before anyone attaches; `attachSpscRing` and
 * `attachMpscRing` read it in any other process (or the same one) and refuse
 * memory with no ring of that kind at `base`. `spscRingBytes` and
 * `mpscRingBytes` say how many bytes a ring takes from `base`, which is a
 * multiple of 64 so the header's counters each have a cache line. Several
 * rings may share a region at different bases.
 *
 * **Who may call what is not checked.** An `SpscRing` with two producers, or
 * either ring with two consumers, loses or repeats records; it never reads or
 * writes outside its region, because every access is a checked `SharedRegion`
 * access, and a length a broken peer wrote that cannot be a record's panics.
 * An `MpscRing` producer that dies between claiming a slot and filling it
 * stalls the consumer at that slot for good: a supervisor that restarts
 * producers makes a fresh ring.
 *
 * **The doorbell.** A ring made with `doorbell` true lets the consumer sleep
 * instead of spinning: `popWait` spins a little, then says it is sleeping in
 * the header and sleeps on Linux's futex, and a push rings it only when that
 * flag is set (one `SEQ_CST` store and load on each side, so neither can miss
 * the other). A busy ring makes no system calls; an idle one makes two per
 * record, the consumer's wait and the producer's wake. Without the doorbell a
 * push is a release store and `popWait` answers `SHM_UNSUPPORTED`, as it does
 * off Linux, where the consumer polls `tryPop`. `popWait` reads the monotonic
 * clock for its deadline, so a program that imports this module reaches the
 * `clock` capability as well as `ffi`.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */

import { ACQUIRE, RELAXED, RELEASE, SEQ_CST, SHM_UNSUPPORTED, SharedRegion } from "nish/sync/shm"
import { monotonicNanos } from "nish:process"

/** `tryPop`, `popWait`: the ring is empty (or the wait ran out). */
export const RING_EMPTY: i32 = -1
/** `tryPop`, `popWait`: the next record is longer than the room after `off` in `dst`; it stays queued. */
export const RING_TOO_SMALL: i32 = -2

// The header, from `base`. Each counter has a cache line of its own, so the
// producer's stores and the consumer's never contend for one.
const RING_MAGIC_AT: i32 = 0
const RING_SIZE_AT: i32 = 8 // SPSC: the data's bytes; MPSC: the slots
const RING_SLOT_AT: i32 = 12 // MPSC: each slot's payload bytes
const RING_BELL_AT: i32 = 16 // 1 when the ring has a doorbell
const RING_TAIL_AT: i32 = 64 // the producers' position (i64)
const RING_HEAD_AT: i32 = 128 // the consumer's position (i64)
const RING_SLEEP_AT: i32 = 192 // 1 while the consumer sleeps or is about to
const RING_DATA_AT: i32 = 256
const RING_SPSC_MAGIC: i32 = 0x6e727331 // "nrs1"
const RING_MPSC_MAGIC: i32 = 0x6e726d31 // "nrm1"
// Tries before popWait sleeps: several microseconds of polling, longer than
// the round trip a busy peer answers within, before paying for a futex wake
// of tens of microseconds. 256 put a ping-pong's p99 at 35 µs; 2048 put it at
// 1.4 µs, and 8192 bought nothing more (docs/wp47-shared-memory.md).
const RING_SPINS: i32 = 2048
// An MPSC slot: [seq i64][len i32][4 unused][payload].
const RING_SLOT_HEAD: i32 = 16

const ringIsPowerOfTwo = (n: i32): boolean => n > 0 && (n & (n - 1)) === 0

/** A ring's header is 64-aligned and the ring fits its region from `base`. */
const ringCheckPlace = (region: SharedRegion, base: i32, bytes: i64, what: string): void => {
  if (base < 0 || base % 64 !== 0) {
    panic(`nish/sync/ring: ${what} at ${base}: a ring's base is a multiple of 64`)
  }
  if (toI64(base) + bytes > toI64(region.size())) {
    panic(`nish/sync/ring: ${what} at ${base} needs ${bytes} bytes; the region has ${region.size()}`)
  }
}

/** The bytes an `SpscRing` of `capacity` data bytes takes from its base. */
export const spscRingBytes = (capacity: i32): i32 => RING_DATA_AT + capacity

/** The bytes an `MpscRing` of `slots` slots of `slotBytes` takes from its base. */
export const mpscRingBytes = (slots: i32, slotBytes: i32): i32 =>
  RING_DATA_AT + slots * (RING_SLOT_HEAD + slotBytes)

/**
 * Wakes a consumer that said it is sleeping. The caller has published its
 * record with a `SEQ_CST` store, so this load and the consumer's `SEQ_CST`
 * store of the flag cannot both miss each other; the exchange makes one
 * producer of many the one that pays for the wake.
 */
const ringRing = (region: SharedRegion, base: i32): void => {
  const at: i32 = base + RING_SLEEP_AT
  if (region.loadI32(at, SEQ_CST) !== 0 && region.exchangeI32(at, 0, SEQ_CST) !== 0) {
    region.wake(at, 1)
  }
}

/** `monotonicNanos()` past which a wait of `timeoutMs` gives up; 0 for no limit. */
const ringDeadline = (timeoutMs: i32): i64 =>
  timeoutMs < 0 ? toI64(0) : monotonicNanos() + toI64(timeoutMs) * 1000000

/** The milliseconds left before `deadline`, rounded up: -1 for no limit, 0 when it has passed. */
const ringLeftMs = (deadline: i64): i32 => {
  if (deadline === toI64(0)) {
    return -1
  }
  const left: i64 = deadline - monotonicNanos()
  return left <= toI64(0) ? 0 : toI32((left + 999999) / 1000000)
}

/**
 * The consumer's half of the doorbell, after it has stored 1 in the flag with
 * `SEQ_CST` and looked once more (`ready` answers whether a record arrived):
 * sleep at most `waitMs` if none did. False when there is no futex here.
 */
const ringSleep = (region: SharedRegion, base: i32, ready: boolean, waitMs: i32): boolean => {
  const at: i32 = base + RING_SLEEP_AT
  if (ready) {
    region.storeI32(at, 0, RELAXED)
    return true
  }
  const rc: i32 = region.waitI32(at, 1, waitMs)
  region.storeI32(at, 0, RELAXED)
  return rc !== SHM_UNSUPPORTED
}

/**
 * One producer, one consumer, records of any length. Make it with
 * `initSpscRing` or `attachSpscRing`; each object keeps its own copy of the
 * position it owns and a cache of the other side's, so a push reads the
 * consumer's counter only when the ring looks full, and a pop the producer's
 * only when it looks empty.
 */
export class SpscRing {
  /** The region the ring lives in. */
  region: SharedRegion
  /** Its header's offset in the region. */
  base: i32
  /** Data bytes, a power of two. */
  capacity: i32
  /** Whether a push rings the consumer's doorbell. */
  doorbell: boolean
  /** The producer's position: bytes ever pushed (this object's, as a producer). */
  tail: i64
  /** The consumer's position: bytes ever popped (this object's, as a consumer). */
  head: i64
  /** The other side's position, as last loaded. */
  seenHead: i64
  seenTail: i64

  constructor(region: SharedRegion, base: i32) {
    this.region = region
    this.base = base
    this.capacity = region.loadI32(base + RING_SIZE_AT, RELAXED)
    this.doorbell = region.loadI32(base + RING_BELL_AT, RELAXED) !== 0
    this.tail = region.loadI64(base + RING_TAIL_AT, ACQUIRE)
    this.head = region.loadI64(base + RING_HEAD_AT, ACQUIRE)
    this.seenHead = this.head
    this.seenTail = this.tail
  }

  /**
   * Appends `src[off, off + len)` as one record: false when the ring has no
   * room for it now. A record longer than the ring could ever hold panics.
   */
  tryPush(src: readonly u8[], off: i32, len: i32): boolean {
    const need: i32 = 4 + ((len + 3) & ~3)
    if (len < 0 || need > this.capacity) {
      panic(`nish/sync/ring: a record of ${len} bytes does not fit a ring of ${this.capacity}`)
    }
    const end: i64 = this.tail + toI64(need)
    if (end - this.seenHead > toI64(this.capacity)) {
      this.seenHead = this.region.loadI64(this.base + RING_HEAD_AT, ACQUIRE)
      if (end - this.seenHead > toI64(this.capacity)) {
        return false
      }
    }
    const mask: i32 = this.capacity - 1
    const data: i32 = this.base + RING_DATA_AT
    const at: i32 = toI32(this.tail & toI64(mask))
    this.region.storeI32(data + at, len, RELAXED)
    const from: i32 = (at + 4) & mask
    const first: i32 = len < this.capacity - from ? len : this.capacity - from
    this.region.write(data + from, src, off, first)
    if (first < len) {
      this.region.write(data, src, off + first, len - first)
    }
    this.tail = end
    if (this.doorbell) {
      this.region.storeI64(this.base + RING_TAIL_AT, end, SEQ_CST)
      ringRing(this.region, this.base)
    } else {
      this.region.storeI64(this.base + RING_TAIL_AT, end, RELEASE)
    }
    return true
  }

  /** Whether a record is queued, loading the producer's position if the cache says none. */
  private ready(order: i32): boolean {
    if (this.head !== this.seenTail) {
      return true
    }
    this.seenTail = this.region.loadI64(this.base + RING_TAIL_AT, order)
    return this.head !== this.seenTail
  }

  /** The length of the record at the consumer's position, checked against the ring. */
  private lengthAt(pos: i64, avail: i64): i32 {
    const mask: i32 = this.capacity - 1
    const len: i32 = this.region.loadI32(this.base + RING_DATA_AT + toI32(pos & toI64(mask)), RELAXED)
    // The capacity first: a length a broken producer wrote near 2^31 would
    // overflow the rounding below and panic with the wrong reason.
    if (len < 0 || len > this.capacity - 4 || toI64(4 + ((len + 3) & ~3)) > avail) {
      panic(`nish/sync/ring: a record of length ${len} at position ${pos}: the ring is corrupt`)
    }
    return len
  }

  /** Copies the record at `pos`, `len` bytes, into `dst` at `off`. */
  private copyOut(pos: i64, len: i32, dst: u8[], off: i32): void {
    const mask: i32 = this.capacity - 1
    const data: i32 = this.base + RING_DATA_AT
    const from: i32 = toI32((pos + 4) & toI64(mask))
    const first: i32 = len < this.capacity - from ? len : this.capacity - from
    this.region.read(data + from, dst, off, first)
    if (first < len) {
      this.region.read(data, dst, off + first, len - first)
    }
  }

  /**
   * Moves the next record into `dst` from `off` and answers its length:
   * `RING_EMPTY` when there is none, `RING_TOO_SMALL` (keeping it queued)
   * when it is longer than `dst.length - off`.
   */
  tryPop(dst: u8[], off: i32): i32 {
    if (!this.ready(ACQUIRE)) {
      return RING_EMPTY
    }
    const len: i32 = this.lengthAt(this.head, this.seenTail - this.head)
    if (len > dst.length - off) {
      return RING_TOO_SMALL
    }
    this.copyOut(this.head, len, dst, off)
    this.head = this.head + toI64(4 + ((len + 3) & ~3))
    this.region.storeI64(this.base + RING_HEAD_AT, this.head, RELEASE)
    return len
  }

  /**
   * Moves up to `lens.length` records into `dst`, back to back from 0, while
   * they fit, and sets `lens[i]` to each one's length: how many it moved. One
   * load of the producer's position and one store of the consumer's, however
   * many records it moves.
   */
  popBatch(dst: u8[], lens: i32[]): i32 {
    // Always the producer's position now, not the cache: a cache that still
    // holds a record would hide every one pushed since it was loaded.
    this.seenTail = this.region.loadI64(this.base + RING_TAIL_AT, ACQUIRE)
    let count = 0
    let used = 0
    let pos: i64 = this.head
    while (count < lens.length && pos !== this.seenTail) {
      const len: i32 = this.lengthAt(pos, this.seenTail - pos)
      if (len > dst.length - used) {
        break
      }
      this.copyOut(pos, len, dst, used)
      if (count >= 0 && count < lens.length) {
        lens[count] = len
      }
      count = count + 1
      used = used + len
      pos = pos + toI64(4 + ((len + 3) & ~3))
    }
    if (count > 0) {
      this.head = pos
      this.region.storeI64(this.base + RING_HEAD_AT, pos, RELEASE)
    }
    return count
  }

  /**
   * `tryPop`, but on an empty ring it polls briefly and then sleeps until a
   * push rings the doorbell, for at most `timeoutMs` in all (negative: no
   * limit): `RING_EMPTY` only once that has passed. `SHM_UNSUPPORTED` for a
   * ring without a doorbell, or off Linux, where the caller polls `tryPop`.
   */
  popWait(dst: u8[], off: i32, timeoutMs: i32): i32 {
    const deadline: i64 = ringDeadline(timeoutMs)
    while (true) {
      for (let i = 0; i < RING_SPINS; i++) {
        const n: i32 = this.tryPop(dst, off)
        if (n !== RING_EMPTY) {
          return n
        }
      }
      if (!this.doorbell) {
        return SHM_UNSUPPORTED
      }
      const waitMs: i32 = ringLeftMs(deadline)
      if (waitMs === 0) {
        return RING_EMPTY
      }
      this.region.storeI32(this.base + RING_SLEEP_AT, 1, SEQ_CST)
      if (!ringSleep(this.region, this.base, this.ready(SEQ_CST), waitMs)) {
        return SHM_UNSUPPORTED
      }
    }
  }
}

/**
 * Writes an `SpscRing`'s header at `base` and answers the ring: `capacity`
 * data bytes, a power of two from 8, and `doorbell` for `popWait`. The
 * memory is the creator's to give; a ring already there is reset.
 */
export const initSpscRing = (region: SharedRegion, base: i32, capacity: i32, doorbell: boolean): SpscRing => {
  if (capacity < 8 || !ringIsPowerOfTwo(capacity)) {
    panic(`nish/sync/ring: an SPSC ring's capacity is a power of two from 8, not ${capacity}`)
  }
  ringCheckPlace(region, base, toI64(spscRingBytes(capacity)), "an SPSC ring")
  region.storeI32(base + RING_SIZE_AT, capacity, RELAXED)
  region.storeI32(base + RING_BELL_AT, doorbell ? 1 : 0, RELAXED)
  region.storeI64(base + RING_TAIL_AT, toI64(0), RELAXED)
  region.storeI64(base + RING_HEAD_AT, toI64(0), RELAXED)
  region.storeI32(base + RING_SLEEP_AT, 0, RELAXED)
  region.storeI32(base + RING_MAGIC_AT, RING_SPSC_MAGIC, RELEASE)
  return new SpscRing(region, base)
}

/** The `SpscRing` an `initSpscRing` wrote at `base`; an error when there is none. */
export const attachSpscRing = (region: SharedRegion, base: i32): Result<SpscRing, string> => {
  ringCheckPlace(region, base, toI64(RING_DATA_AT), "an SPSC ring")
  if (region.loadI32(base + RING_MAGIC_AT, ACQUIRE) !== RING_SPSC_MAGIC) {
    return Err(`no SPSC ring at ${base}`)
  }
  const capacity: i32 = region.loadI32(base + RING_SIZE_AT, RELAXED)
  if (capacity < 8 || !ringIsPowerOfTwo(capacity)) {
    return Err(`the SPSC ring at ${base} has capacity ${capacity}`)
  }
  ringCheckPlace(region, base, toI64(spscRingBytes(capacity)), "an SPSC ring")
  return Ok(new SpscRing(region, base))
}

/**
 * Any number of producers, one consumer, records of at most `slotBytes`.
 * Make it with `initMpscRing` or `attachMpscRing`.
 */
export class MpscRing {
  /** The region the ring lives in. */
  region: SharedRegion
  /** Its header's offset in the region. */
  base: i32
  /** Slots, a power of two. */
  slots: i32
  /** Each slot's payload bytes, a multiple of 8. */
  slotBytes: i32
  /** Whether a push rings the consumer's doorbell. */
  doorbell: boolean
  /** The consumer's position: records ever popped (this object's, as the consumer). */
  head: i64

  constructor(region: SharedRegion, base: i32) {
    this.region = region
    this.base = base
    this.slots = region.loadI32(base + RING_SIZE_AT, RELAXED)
    this.slotBytes = region.loadI32(base + RING_SLOT_AT, RELAXED)
    this.doorbell = region.loadI32(base + RING_BELL_AT, RELAXED) !== 0
    this.head = region.loadI64(base + RING_HEAD_AT, ACQUIRE)
  }

  /** The offset of position `pos`'s slot. */
  private slotAt(pos: i64): i32 {
    const index: i32 = toI32(pos & toI64(this.slots - 1))
    return this.base + RING_DATA_AT + index * (RING_SLOT_HEAD + this.slotBytes)
  }

  /**
   * Queues `src[off, off + len)` as one record: false when every slot is
   * taken now. A record longer than a slot panics.
   */
  tryPush(src: readonly u8[], off: i32, len: i32): boolean {
    if (len < 0 || len > this.slotBytes) {
      panic(`nish/sync/ring: a record of ${len} bytes does not fit a slot of ${this.slotBytes}`)
    }
    const tailAt: i32 = this.base + RING_TAIL_AT
    let pos: i64 = this.region.loadI64(tailAt, RELAXED)
    while (true) {
      const seq: i64 = this.region.loadI64(this.slotAt(pos), ACQUIRE)
      if (seq === pos) {
        const seen: i64 = this.region.compareExchangeI64(tailAt, pos, pos + 1, RELAXED)
        if (seen === pos) {
          break
        }
        pos = seen
      } else if (seq < pos) {
        return false
      } else {
        pos = this.region.loadI64(tailAt, RELAXED)
      }
    }
    const slot: i32 = this.slotAt(pos)
    this.region.storeI32(slot + 8, len, RELAXED)
    this.region.write(slot + RING_SLOT_HEAD, src, off, len)
    if (this.doorbell) {
      this.region.storeI64(slot, pos + 1, SEQ_CST)
      ringRing(this.region, this.base)
    } else {
      this.region.storeI64(slot, pos + 1, RELEASE)
    }
    return true
  }

  /** Whether the slot at the consumer's position is filled. */
  private ready(order: i32): boolean {
    return this.region.loadI64(this.slotAt(this.head), order) === this.head + 1
  }

  /** Empties the consumer's slot for the producer one lap on. */
  private release(slot: i32): void {
    this.region.storeI64(slot, this.head + toI64(this.slots), RELEASE)
    this.head = this.head + 1
    this.region.storeI64(this.base + RING_HEAD_AT, this.head, RELAXED)
  }

  /** The length in the consumer's slot, checked against the slot. */
  private lengthAt(slot: i32): i32 {
    const len: i32 = this.region.loadI32(slot + 8, RELAXED)
    if (len < 0 || len > this.slotBytes) {
      panic(`nish/sync/ring: a record of length ${len} at position ${this.head}: the ring is corrupt`)
    }
    return len
  }

  /**
   * Moves the next record into `dst` from `off` and answers its length:
   * `RING_EMPTY` when there is none, `RING_TOO_SMALL` (keeping it queued)
   * when it is longer than `dst.length - off`.
   */
  tryPop(dst: u8[], off: i32): i32 {
    if (!this.ready(ACQUIRE)) {
      return RING_EMPTY
    }
    const slot: i32 = this.slotAt(this.head)
    const len: i32 = this.lengthAt(slot)
    if (len > dst.length - off) {
      return RING_TOO_SMALL
    }
    this.region.read(slot + RING_SLOT_HEAD, dst, off, len)
    this.release(slot)
    return len
  }

  /**
   * Moves up to `lens.length` records into `dst`, back to back from 0, while
   * they fit, and sets `lens[i]` to each one's length: how many it moved.
   */
  popBatch(dst: u8[], lens: i32[]): i32 {
    let count = 0
    let used = 0
    while (count < lens.length && this.ready(ACQUIRE)) {
      const slot: i32 = this.slotAt(this.head)
      const len: i32 = this.lengthAt(slot)
      if (len > dst.length - used) {
        break
      }
      this.region.read(slot + RING_SLOT_HEAD, dst, used, len)
      this.release(slot)
      if (count >= 0 && count < lens.length) {
        lens[count] = len
      }
      count = count + 1
      used = used + len
    }
    return count
  }

  /** `SpscRing.popWait`, for this ring. */
  popWait(dst: u8[], off: i32, timeoutMs: i32): i32 {
    const deadline: i64 = ringDeadline(timeoutMs)
    while (true) {
      for (let i = 0; i < RING_SPINS; i++) {
        const n: i32 = this.tryPop(dst, off)
        if (n !== RING_EMPTY) {
          return n
        }
      }
      if (!this.doorbell) {
        return SHM_UNSUPPORTED
      }
      const waitMs: i32 = ringLeftMs(deadline)
      if (waitMs === 0) {
        return RING_EMPTY
      }
      this.region.storeI32(this.base + RING_SLEEP_AT, 1, SEQ_CST)
      if (!ringSleep(this.region, this.base, this.ready(SEQ_CST), waitMs)) {
        return SHM_UNSUPPORTED
      }
    }
  }
}

/**
 * Writes an `MpscRing`'s header at `base` and answers the ring: `slots`
 * slots, a power of two from 2, of `slotBytes` each, a multiple of 8 from 8,
 * and `doorbell` for `popWait`. A ring already there is reset.
 */
export const initMpscRing = (
  region: SharedRegion,
  base: i32,
  slots: i32,
  slotBytes: i32,
  doorbell: boolean
): MpscRing => {
  if (slots < 2 || !ringIsPowerOfTwo(slots) || slotBytes < 8 || slotBytes % 8 !== 0) {
    panic(
      `nish/sync/ring: an MPSC ring has a power of two from 2 slots of a multiple of 8 bytes, not ${slots} of ${slotBytes}`
    )
  }
  ringCheckPlace(
    region,
    base,
    toI64(RING_DATA_AT) + toI64(slots) * toI64(RING_SLOT_HEAD + slotBytes),
    "an MPSC ring"
  )
  region.storeI32(base + RING_SIZE_AT, slots, RELAXED)
  region.storeI32(base + RING_SLOT_AT, slotBytes, RELAXED)
  region.storeI32(base + RING_BELL_AT, doorbell ? 1 : 0, RELAXED)
  region.storeI64(base + RING_TAIL_AT, toI64(0), RELAXED)
  region.storeI64(base + RING_HEAD_AT, toI64(0), RELAXED)
  region.storeI32(base + RING_SLEEP_AT, 0, RELAXED)
  const stride: i32 = RING_SLOT_HEAD + slotBytes
  for (let i = 0; i < slots; i++) {
    region.storeI64(base + RING_DATA_AT + i * stride, toI64(i), RELAXED)
  }
  region.storeI32(base + RING_MAGIC_AT, RING_MPSC_MAGIC, RELEASE)
  return new MpscRing(region, base)
}

/** The `MpscRing` an `initMpscRing` wrote at `base`; an error when there is none. */
export const attachMpscRing = (region: SharedRegion, base: i32): Result<MpscRing, string> => {
  ringCheckPlace(region, base, toI64(RING_DATA_AT), "an MPSC ring")
  if (region.loadI32(base + RING_MAGIC_AT, ACQUIRE) !== RING_MPSC_MAGIC) {
    return Err(`no MPSC ring at ${base}`)
  }
  const slots: i32 = region.loadI32(base + RING_SIZE_AT, RELAXED)
  const slotBytes: i32 = region.loadI32(base + RING_SLOT_AT, RELAXED)
  if (slots < 2 || !ringIsPowerOfTwo(slots) || slotBytes < 8 || slotBytes % 8 !== 0) {
    return Err(`the MPSC ring at ${base} has ${slots} slots of ${slotBytes} bytes`)
  }
  ringCheckPlace(
    region,
    base,
    toI64(RING_DATA_AT) + toI64(slots) * toI64(RING_SLOT_HEAD + slotBytes),
    "an MPSC ring"
  )
  return Ok(new MpscRing(region, base))
}
