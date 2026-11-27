/**
 * `nish/sync/ring` — bounded lock-free queues of byte records in a shared
 * region, for handing work between processes on different cores.
 *
 *     import { createRegion, openRegion } from "nish/sync/shm"
 *     import { initSpscRing, attachSpscRing, spscRingBytes } from "nish/sync/ring"
 *
 *     const region = createRegion("jobs", spscRingBytes(65536)).expect("region")
 *     const ring = initSpscRing(region, 0, 65536, true)
 *     ring.tryPush(job, 0, toI32(job.length)) // false when full
 *
 *     // The other process opens the region by name and attaches:
 *     const view = openRegion("jobs").expect("open")
 *     const rx = attachSpscRing(view, 0).expect("ring")
 *     const n = rx.popWait(buf, 0, 1000) // the record's length, or RING_EMPTY
 *
 * **Two rings.** `SpscRing` has one producer and one consumer, and holds
 * records of any length up to its capacity back to back: a record costs its
 * length rounded up to 4, plus 4, and a record written with `reserve` may
 * leave padding at a lap's end (a skip marker, below). `MpscRing` takes any number of producers
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
 * **In place.** An `SpscRing` producer may write a record into the ring
 * itself instead of copying one in, and a consumer may read one there:
 *
 *     const w: u8[] = ring.reserve(n) // empty when there is no room now
 *     copyBytes(w, 0, body, 0, k)     // any u8[] writer, within w.length
 *     ring.commit(k)                  // publishes w[0, k) as one record
 *
 *     const r: readonly u8[] = ring.peek() // the next record, in the ring
 *     if (r.length > 0) {
 *       use(r)
 *       ring.release()                // frees it for the producer
 *     } else {
 *       ring.tryPop(buf, 0)           // none, or one peek cannot lend
 *     }
 *
 * A window is a `SharedRegion.lend` window: the ring keeps one for its producer
 * and one for its consumer and re-points them on every call, so neither path
 * allocates or makes a system call. `commit`, `abandon` and `release` give the
 * window back, which empties it: a reference kept past them indexes nothing
 * (each index panics) until the next `reserve` or `peek` re-points it, and then
 * sees that call's record.
 *
 * A reserved record is always contiguous: when the rest of the lap is too
 * short, `commit` writes a skip marker there (a length word of -1, "the rest of
 * this lap is padding") and the record starts at the next lap. Every pop steps
 * over a marker.
 *
 * A record `tryPush` wrapped across the end cannot be lent, so `peek` answers
 * an empty window for it and `tryPop` takes it, as it does for a record of
 * length 0. A reservation is at most `capacity / 2 - 4` bytes, so a ring of 8
 * can never reserve (it panics) and one of 16 allows 4. The reserved bytes are
 * not zeroed: `commit` only what was written. A consumer that polls `peek` on a
 * doorbell ring has no wait call yet (`popWait` takes records, not windows).
 *
 * **The format keeps its magic.** A ring no producer `reserve`s into is
 * byte for byte what it was, and a consumer built before the marker that
 * meets one panics with "the ring is corrupt", never reads padding as a
 * record. Both ends of a ring are normally one build, so a new magic would
 * buy a clearer panic at the cost of every attach of an existing ring.
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
 * record, the consumer's wait and the producer's wake.
 *
 *  Without the doorbell a push is a release store and `popWait` answers
 *  `SHM_UNSUPPORTED`, as it does off Linux, where the consumer polls `tryPop`.
 *  `popWait` reads the monotonic clock for its deadline, so a program that
 *  imports this module reaches the `clock` capability as well as `ffi`.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */

import { ACQUIRE, RELAXED, RELEASE, SEQ_CST, SHM_UNSUPPORTED, SharedRegion } from "nish/sync/shm"
import { monotonicNanos } from "nish:process"
import { wrappingAdd, wrappingSub } from "nish:unsafe"

/** `tryPop`, `popWait`: the ring is empty (or the wait ran out). */
export const RING_EMPTY: i32 = -1
/** `tryPop`, `popWait`: the next record is longer than the room after `off` in `dst`; it stays queued. */
export const RING_TOO_SMALL: i32 = -2
/**
 * `MpscRing.take`, `MpscRing.takeWait`: the consumer's slot holds a length no
 * producer writes, so another process scribbled on the ring. Nothing is moved
 * and the slot stays as it is; `tryPop` panics on it instead.
 */
export const RING_CORRUPT: i32 = -3
/** `MpscRing.offer`: every slot is taken now; nothing is written. */
export const RING_FULL: i32 = -4
/** `MpscRing.offer`: the record is longer than a slot, or its length is negative; nothing is written. */
export const RING_TOO_LONG: i32 = -5

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
// An SPSC length word that says the rest of the lap is padding.
const RING_SKIP: i32 = -1
// An MPSC slot: [seq i64][len i32][4 unused][payload].
const RING_SLOT_HEAD: i32 = 16
// The consumer's sleep flag at RING_SLEEP_AT.
const RING_AWAKE: i32 = 0
const RING_ASLEEP: i32 = 1

const ringIsPowerOfTwo = (n: i32): boolean => n > 0 && (n & (n - 1)) === 0

/**
 * An i64 offset or size as an i32, held at the i32 range's ends instead of
 * wrapped. A held answer is past every region (a region of 2 GiB or more is
 * refused before any ring is made in it), so an offset that ever reached one
 * would be refused by the region's own bounds check, not read at a wrapped place.
 */
const ringHeld = (n: i64): i32 => {
  if (n > toI64(2147483647)) {
    return 2147483647
  }
  return n < toI64(-2147483648) ? -2147483648 : toI32(n)
}

/**
 * An offset into the region. Every caller adds a header constant or a masked
 * index to a base `ringFits` already placed, so the sum cannot pass the
 * region's size; it is taken in i64 so it is never a panic site.
 */
const ringAdd = (a: i32, b: i32): i32 => ringHeld(toI64(a) + toI64(b))

/** `n`, or 0 for a negative one: an offset `ringAdd` held, which a ring `ringFits` placed is never below 0. */
const ringFloor = (n: i32): integer<0, 2147483647> => (n >= 0 ? n : 0)

/**
 * How many slots position `pos`'s slot is before a ring's last one: `mask -
 * index`, which is `~pos & mask` for a mask one less than a power of two.
 */
const ringBack = (pos: i64, mask: integer<0, 1073741823>): integer<0, 1073741823> => {
  const back: i32 = ~toI32(pos) & mask
  // Always true (`back` is at most `mask`); stated for the prover, and folded away.
  return back >= 0 && back <= 1073741823 ? back : 0
}

/**
 * The offset `back` slots of `stride` bytes before `last`, an MPSC slot's
 * field in the ring's last slot. `ringFits` placed every slot inside the
 * region, so the difference is never below 0; one that were answers -1, which
 * the region's bounds check refuses.
 */
const ringBackAt = (
  last: integer<0, 2147483647>,
  back: integer<0, 1073741823>,
  stride: integer<0, 2147483647>
): i32 => {
  const at: i64 = toI64(last) - toI64(back) * toI64(stride)
  return at >= toI64(0) ? toI32(at) : -1
}

/** The product of two ring sizes, held like `ringAdd`'s sum; the shapes it is given were checked first. */
const ringMul = (a: i32, b: i32): i32 => ringHeld(toI64(a) * toI64(b))

/**
 * A ring position plus a count. Positions are sequence counters that the
 * producer and consumer compare only by their difference (`ringGap`), so
 * they count modulo 2^64 by design: `wrappingAdd` is the counter's answer,
 * not a hidden overflow, and they reach 2^63 only after centuries of traffic.
 */
const ringPos = (pos: i64, by: i64): i64 => wrappingAdd(pos, by)

/** `a - b`, for the same offsets `ringAdd` sums, held like its sum. */
const ringSub = (a: i32, b: i32): i32 => ringHeld(toI64(a) - toI64(b))

/** How far position `a` is past `b`: the difference of two `ringPos` counters, modulo 2^64 as they count. */
const ringGap = (a: i64, b: i64): i64 => wrappingSub(a, b)

/**
 * The bytes an SPSC record of `len` takes: its length word and the payload,
 * rounded up to 4. Its callers have checked `len` is from 0 to `capacity - 4`,
 * so the sum cannot leave i64.
 */
const ringRecordWide = (len: i32): i64 => (toI64(len) + toI64(7)) & toI64(-4)

/**
 * Whether a ring of `bytes` fits its region from `base` with its header
 * 64-aligned. Attaching answers this as an `Err`, since the size it checks
 * was read from shared memory; making a ring panics on it.
 */
const ringFits = (region: SharedRegion, base: i32, bytes: i64): boolean =>
  base >= 0 && base % 64 === 0 && bytes >= toI64(0) && bytes <= toI64(region.size()) - toI64(base)

/** Why `ringFits` refuses a place, for the `Err` or the panic that reports it. */
const ringPlaceError = (region: SharedRegion, base: i32, bytes: i64, what: string): string =>
  base < 0 || base % 64 !== 0
    ? `nish/sync/ring: ${what} at ${base}: a ring's base is a multiple of 64`
    : `nish/sync/ring: ${what} at ${base} needs ${bytes} bytes; the region has ${region.size()}`

/** `ringFits`, as the panic a ring maker's caller gets for a place it chose. */
const ringCheckPlace = (region: SharedRegion, base: i32, bytes: i64, what: string): void => {
  if (!ringFits(region, base, bytes)) {
    panic(ringPlaceError(region, base, bytes, what))
  }
}

/**
 * The bytes an `SpscRing` of `capacity` data bytes takes from its base: the
 * 256-byte header and the data. Nothing is checked here; `initSpscRing`
 * refuses a capacity that is not a power of two from 8.
 * @param capacity the ring's data bytes, as `initSpscRing` will be given them
 * @returns how many bytes from the ring's base the region must hold
 */
export const spscRingBytes = (capacity: i32): i32 => ringAdd(RING_DATA_AT, capacity)

/**
 * The bytes an `MpscRing` of `slots` slots of `slotBytes` takes from its base:
 * the 256-byte header and each slot's 16-byte head and payload. Nothing is
 * checked here; `initMpscRing` refuses a shape it cannot make.
 * @param slots how many records the ring holds at once, as `initMpscRing`
 *   will be given it
 * @param slotBytes the longest record, in bytes, as `initMpscRing` will be
 *   given it
 * @returns how many bytes from the ring's base the region must hold
 */
export const mpscRingBytes = (slots: i32, slotBytes: i32): i32 =>
  ringAdd(RING_DATA_AT, ringMul(slots, ringAdd(RING_SLOT_HEAD, slotBytes)))

/**
 * Wakes a consumer that said it is sleeping. The caller has published its
 * record with a `SEQ_CST` store, so this load and the consumer's `SEQ_CST`
 * store of the flag cannot both miss each other; the exchange makes one
 * producer of many the one that pays for the wake.
 */
const ringRing = (region: SharedRegion, base: i32): void => {
  const at: i32 = ringAdd(base, RING_SLEEP_AT)
  if (
    region.loadI32(at, SEQ_CST) !== RING_AWAKE &&
    region.exchangeI32(at, RING_AWAKE, SEQ_CST) !== RING_AWAKE
  ) {
    region.wake(at, toI32(1))
  }
}

/**
 * `monotonicNanos()` past which a wait of `timeoutMs` gives up; 0 for no limit.
 * The clock is read only through `ringLeftMs`'s difference, so the deadline
 * counts modulo 2^64 like a `ringPos` position.
 */
const ringDeadline = (timeoutMs: i32): i64 =>
  timeoutMs < 0 ? toI64(0) : wrappingAdd(monotonicNanos(), toI64(timeoutMs) * toI64(1000000))

/** The milliseconds left before `deadline`, rounded up: -1 for no limit, 0 when it has passed. */
const ringLeftMs = (deadline: i64): i32 => {
  if (deadline === toI64(0)) {
    return -1
  }
  const left: i64 = wrappingSub(deadline, monotonicNanos())
  if (left <= toI64(0)) {
    return 0
  }
  const ms: i32 = toI32(left / toI64(1000000))
  if (ms < 0 || ms > 2147483646) {
    return 2147483647
  }
  return left % toI64(1000000) === toI64(0) ? ms : ms + 1
}

/**
 * The consumer's half of the doorbell, after it has stored 1 in the flag with
 * `SEQ_CST` and looked once more (`ready` answers whether a record arrived):
 * sleep at most `waitMs` if none did. False when there is no futex here.
 */
const ringSleep = (region: SharedRegion, base: i32, ready: boolean, waitMs: i32): boolean => {
  const at: i32 = ringAdd(base, RING_SLEEP_AT)
  if (ready) {
    region.storeI32(at, RING_AWAKE, RELAXED)
    return true
  }
  const rc: i32 = region.waitI32(at, RING_ASLEEP, waitMs)
  region.storeI32(at, RING_AWAKE, RELAXED)
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
  private region: SharedRegion
  /** Its header's offset in the region. */
  private base: i32
  /** Data bytes, a power of two. */
  capacity: i32
  /** Whether a push rings the consumer's doorbell. */
  private doorbell: boolean
  /** The producer's position: bytes ever pushed (this object's, as a producer). */
  private tail: i64
  /** The consumer's position: bytes ever popped (this object's, as a consumer). */
  head: i64
  /** The other side's position, as last loaded. */
  private seenHead: i64
  /**
   * The producer's position as this object, consuming, last loaded it: the
   * cache a pop compares `head` with before it loads the producer's counter
   * again. A snapshot, possibly behind the shared counter.
   */
  seenTail: i64
  /** `reserve`'s window, re-pointed by each call; null until the first. */
  private wnd: u8[] | null = null
  /** `peek`'s window, likewise. */
  private view: u8[] | null = null
  /** The open reservation's bytes, or -1 for none. */
  private reserved: i32 = -1
  /** The padding the open reservation skips at the tail. */
  private reservedPad: i32 = 0
  /** The position past the record `peek` lent, or -1 for none. */
  private peekedEnd: i64 = -1
  /** The position of the record `lengthAt` last read, past any skip marker. */
  private found: i64 = 0
  /** `capacity - 1`, which turns a position into an index; 0 for a capacity no ring has. */
  private mask: integer<0, 1073741823> = 0
  /** The data's offset in the region. */
  private dataAt: integer<0, 2147483647> = 0
  /**
   * The offset of the data's last byte. An index is reached counting back
   * from it by `mask - index`, which `~pos & mask` gives: an i32 difference
   * of a place `ringFits` checked and a masked count, so it needs no hold.
   */
  private lastAt: integer<0, 2147483647> = 0
  /** The producer's position's offset in the region. */
  private tailAt: i32 = 0
  /** The consumer's position's offset in the region. */
  private headAt: i32 = 0

  /**
   * Reads the header of the ring at `base`: its capacity and doorbell, and
   * both positions (each an `ACQUIRE` load). It checks nothing; a program
   * gets its ring from `initSpscRing` or `attachSpscRing`, which check the
   * place and the magic first.
   * @param region the region the ring lives in
   * @param base the byte offset of the ring's header in `region`
   */
  constructor(region: SharedRegion, base: i32) {
    this.region = region
    this.base = base
    this.capacity = region.loadI32(ringAdd(base, RING_SIZE_AT), RELAXED)
    const mask: i32 = ringSub(this.capacity, 1)
    this.mask = mask >= 0 && mask <= 1073741823 ? mask : 0
    this.dataAt = ringFloor(ringAdd(base, RING_DATA_AT))
    this.lastAt = ringFloor(ringAdd(this.dataAt, this.mask))
    this.tailAt = ringAdd(base, RING_TAIL_AT)
    this.headAt = ringAdd(base, RING_HEAD_AT)
    this.doorbell = region.loadI32(ringAdd(base, RING_BELL_AT), RELAXED) !== 0
    this.tail = region.loadI64(this.tailAt, ACQUIRE)
    this.head = region.loadI64(this.headAt, ACQUIRE)
    this.seenHead = this.head
    this.seenTail = this.tail
  }

  /**
   * Appends `src[off, off + len)` as one record: false when the ring has no
   * room for it now. A record longer than the ring could ever hold panics,
   * and so does a call while a reservation is open. The bytes are plain
   * copies, published to the consumer by one store of the producer's position:
   * `RELEASE`, or `SEQ_CST` followed by the doorbell check on a doorbell ring.
   * @param src the bytes to queue
   * @param off where in `src` the record starts
   * @param len the record's length in bytes, from 0; its length rounded up to
   *   4, plus 4, may not exceed `capacity`. A range outside `src` panics
   * @returns true when the record is queued, false when the ring is too full
   *   for it now (nothing is written)
   */
  tryPush(src: readonly u8[], off: i32, len: i32): boolean {
    if (this.reserved >= 0) {
      panic("nish/sync/ring: tryPush while a reservation is open; commit or abandon it first")
    }
    const mask: integer<0, 1073741823> = this.mask
    // A length past `capacity - 4` (`mask - 3`) needs more than `capacity` bytes.
    if (len < 0 || len > mask - 3) {
      panic(`nish/sync/ring: a record of ${len} bytes does not fit a ring of ${this.capacity}`)
    }
    const end: i64 = ringPos(this.tail, ringRecordWide(len))
    if (ringGap(end, this.seenHead) > toI64(this.capacity)) {
      this.seenHead = this.region.loadI64(this.headAt, ACQUIRE)
      if (ringGap(end, this.seenHead) > toI64(this.capacity)) {
        return false
      }
    }
    const last: integer<0, 2147483647> = this.lastAt
    const back: i32 = ~toI32(this.tail) & mask
    this.region.storeI32(last - back, len, RELAXED)
    // The payload starts 4 past the length word: 4 fewer to count back, mod the lap.
    const fromBack: i32 = (back - 4) & mask
    const room: i32 = fromBack + 1
    const first: i32 = len < room ? len : room
    this.region.write(last - fromBack, src, off, first)
    if (first < len) {
      this.region.write(this.dataAt, src, ringAdd(off, first), ringSub(len, first))
    }
    this.publish(end)
    return true
  }

  /** Moves the producer's position to `end`, which hands the consumer every byte before it. */
  private publish(end: i64): void {
    this.tail = end
    if (this.doorbell) {
      this.region.storeI64(this.tailAt, end, SEQ_CST)
      ringRing(this.region, this.base)
    } else {
      this.region.storeI64(this.tailAt, end, RELEASE)
    }
  }

  /** `window` re-pointed at no bytes: length 0, no allocation once it exists. */
  private emptyWindow(window: u8[] | null): u8[] {
    if (window !== null && window.length === 0) {
      return window
    }
    const none: i32 = 0
    const w: u8[] = this.region.lend(this.dataAt, none, window)
    this.region.giveBack(w)
    return w
  }

  /**
   * A window of `n` bytes of the ring's own memory to write a record into,
   * contiguous, without blocking: empty (length 0) when the ring has no room
   * for it now. Nothing is published until `commit`; `abandon` drops it. `n`
   * is from 1 (a window of 0 could not be told from no room; `tryPush` takes
   * an empty record) to `capacity / 2 - 4`, so an empty ring always has room
   * for one; outside that, or while a reservation is open, it panics. A ring
   * of 8 has no such `n` and always panics; one of 16 allows 4. The bytes
   * are not zeroed: they hold whatever the ring last held there.
   * @param n the most bytes the record may have; `commit` may publish fewer
   * @returns the producer's window, the same array on every call after the
   *   first and re-pointed by each: its bytes are the ring's own memory, so
   *   what is written into it lands in the region, which the consumer may
   *   read once `commit` publishes it. Length `n`, or 0 when there is no room
   */
  reserve(n: i32): u8[] {
    if (this.reserved >= 0) {
      panic("nish/sync/ring: reserve while a reservation is open; commit or abandon it first")
    }
    const most: i32 = ringSub(this.capacity / 2, 4)
    if (most < 1) {
      panic(
        `nish/sync/ring: an SPSC ring of ${this.capacity} bytes cannot reserve; a reservation is at most half the ring less 4`
      )
    }
    if (n < 1 || n > most) {
      panic(`nish/sync/ring: a reservation of ${n} bytes is not from 1 to ${most}, half the ring less 4`)
    }
    const need: i64 = ringRecordWide(n)
    const mask: integer<0, 1073741823> = this.mask
    const back: i32 = ~toI32(this.tail) & mask
    // The rest of the lap, `back + 1` bytes, is padding when the record would cross the end.
    const rest: i32 = back + 1
    const pad: i32 = need <= toI64(rest) ? 0 : rest
    const end: i64 = ringPos(ringPos(this.tail, toI64(pad)), need)
    if (ringGap(end, this.seenHead) > toI64(this.capacity)) {
      this.seenHead = this.region.loadI64(this.headAt, ACQUIRE)
      if (ringGap(end, this.seenHead) > toI64(this.capacity)) {
        const none: u8[] = this.emptyWindow(this.wnd)
        this.wnd = none
        return none
      }
    }
    const last: integer<0, 2147483647> = this.lastAt
    const lengthWord: i32 = pad > 0 ? this.dataAt : last - back
    const w: u8[] = this.region.lend(ringAdd(lengthWord, 4), n, this.wnd)
    this.wnd = w
    this.reserved = n
    this.reservedPad = pad
    return w
  }

  /** Ends the open reservation, giving its window back; panics without one. */
  private endReservation(what: string): void {
    const w: u8[] | null = this.wnd
    if (this.reserved < 0 || w === null) {
      panic(`nish/sync/ring: ${what} without a reservation`)
    }
    this.region.giveBack(w)
    this.reserved = -1
  }

  /**
   * Publishes the reserved window's first `len` bytes as one record, the
   * store `tryPush` makes. The window is given back, so it is empty after.
   * Panics without a reservation, for `len` outside `[0, n]`, or when a
   * `push` moved the window out of the ring.
   * @param len how many of the window's bytes, from its start, make the
   *   record: from 0 to the `n` that `reserve` was given
   */
  commit(len: i32): void {
    const n: i32 = this.reserved
    if (n >= 0 && (len < 0 || len > n)) {
      panic(`nish/sync/ring: commit of ${len} bytes from a reservation of ${n}`)
    }
    this.endReservation("commit")
    const last: integer<0, 2147483647> = this.lastAt
    const mask: integer<0, 1073741823> = this.mask
    const here: i32 = last - (~toI32(this.tail) & mask)
    if (this.reservedPad > 0) {
      this.region.storeI32(here, RING_SKIP, RELAXED)
    }
    this.region.storeI32(this.reservedPad > 0 ? this.dataAt : here, len, RELAXED)
    this.publish(ringPos(ringPos(this.tail, toI64(this.reservedPad)), ringRecordWide(len)))
  }

  /** Drops the open reservation, publishing nothing; panics without one. */
  abandon(): void {
    this.endReservation("abandon")
  }

  /** Whether a record is queued, loading the producer's position if the cache says none. */
  private ready(order: i32): boolean {
    if (this.head !== this.seenTail) {
      return true
    }
    this.seenTail = this.region.loadI64(this.tailAt, order)
    return this.head !== this.seenTail
  }

  /**
   * The length of the record at `pos`, or at the next lap when a skip marker
   * is at `pos`, checked against the ring and the producer's position `end`.
   * `found` is set to where that record is.
   */
  private lengthAt(pos: i64, end: i64): i32 {
    const mask: integer<0, 1073741823> = this.mask
    const last: integer<0, 2147483647> = this.lastAt
    let at: i64 = pos
    const back: i32 = ~toI32(pos) & mask
    let len: i32 = this.region.loadI32(last - back, RELAXED)
    if (len === RING_SKIP) {
      // The rest of the lap, `back + 1` bytes, is padding.
      at = ringPos(pos, toI64(back + 1))
      len = this.region.loadI32(this.dataAt, RELAXED)
    }
    // A length past `capacity - 4` (`mask - 3`) needs more than `capacity` bytes.
    if (len < 0 || len > mask - 3 || ringRecordWide(len) > ringGap(end, at)) {
      panic(`nish/sync/ring: a record of length ${len} at position ${at}: the ring is corrupt`)
    }
    this.found = at
    return len
  }

  /** Panics while `peek` has a record lent, which a pop would take from under it. */
  private notPeeked(what: string): void {
    if (this.peekedEnd >= toI64(0)) {
      panic(`nish/sync/ring: ${what} while peek has a record lent; release it first`)
    }
  }

  /** Copies the record at `pos`, `len` bytes, into `dst` at `off`. */
  private copyOut(pos: i64, len: i32, dst: u8[], off: i32): void {
    const mask: integer<0, 1073741823> = this.mask
    const fromBack: i32 = ((~toI32(pos) & mask) - 4) & mask
    const room: i32 = fromBack + 1
    const first: i32 = len < room ? len : room
    const last: integer<0, 2147483647> = this.lastAt
    this.region.read(last - fromBack, dst, off, first)
    if (first < len) {
      this.region.read(this.dataAt, dst, ringAdd(off, first), ringSub(len, first))
    }
  }

  /**
   * Moves the next record into `dst` from `off` and answers its length:
   * `RING_EMPTY` when there is none, `RING_TOO_SMALL` (keeping it queued)
   * when it is longer than `dst.length - off`. Panics while `peek` has a
   * record lent. The producer's position is loaded `ACQUIRE` (only when the
   * cache says the ring is empty), and the freed space is handed back with a
   * `RELEASE` store of the consumer's position.
   * @param dst the buffer the record is copied into
   * @param off where in `dst` the record's first byte goes
   * @returns the record's length in bytes, or `RING_EMPTY`, or
   *   `RING_TOO_SMALL`
   */
  tryPop(dst: u8[], off: i32): i32 {
    this.notPeeked("tryPop")
    if (!this.ready(ACQUIRE)) {
      return RING_EMPTY
    }
    const len: i32 = this.lengthAt(this.head, this.seenTail)
    if (toI64(len) + toI64(off) > toI64(dst.length)) {
      return RING_TOO_SMALL
    }
    this.copyOut(this.found, len, dst, off)
    this.head = ringPos(this.found, ringRecordWide(len))
    this.region.storeI64(this.headAt, this.head, RELEASE)
    return len
  }

  /**
   * Moves up to `lens.length` records into `dst`, back to back from 0, while
   * they fit, and sets `lens[i]` to each one's length: how many it moved. One
   * load of the producer's position and one store of the consumer's, however
   * many records it moves. Panics while `peek` has a record lent. The load is
   * `ACQUIRE` and the store, made only when a record moved, is `RELEASE`.
   * @param dst the buffer the records are copied into, with no gap between
   *   them; the first record that does not fit the room left ends the batch
   *   and stays queued
   * @param lens where each moved record's length is written, from index 0;
   *   its length is the most records one call moves
   * @returns how many records it moved, 0 when the ring is empty or the next
   *   record does not fit `dst`; `lens[0, count)` holds their lengths
   */
  popBatch(dst: u8[], lens: i32[]): i32 {
    this.notPeeked("popBatch")
    // Always the producer's position now, not the cache: a cache that still
    // holds a record would hide every one pushed since it was loaded.
    this.seenTail = this.region.loadI64(this.tailAt, ACQUIRE)
    let count: i32 = 0
    let used: i32 = 0
    let pos: i64 = this.head
    while (count < toI32(lens.length) && pos !== this.seenTail) {
      const len: i32 = this.lengthAt(pos, this.seenTail)
      if (toI64(len) + toI64(used) > toI64(dst.length)) {
        break
      }
      this.copyOut(this.found, len, dst, used)
      if (count >= 0 && count < toI32(lens.length)) {
        lens[count] = len
      }
      count = count + 1
      used = ringAdd(used, len)
      pos = ringPos(this.found, ringRecordWide(len))
    }
    if (count > 0) {
      this.head = pos
      this.region.storeI64(this.headAt, pos, RELEASE)
    }
    return count
  }

  /**
   * `tryPop`, but on an empty ring it polls briefly and then sleeps until a
   * push rings the doorbell, for at most `timeoutMs` in all (negative: no
   * limit): `RING_EMPTY` only once that has passed. `SHM_UNSUPPORTED` for a
   * ring without a doorbell, or off Linux, where the caller polls `tryPop`.
   * Panics while `peek` has a record lent, from `tryPop`, so the message
   * names `tryPop`. The deadline is checked between rounds of polling, so a
   * wait can run past it by one round; a ring without a doorbell still polls
   * one round before it answers `SHM_UNSUPPORTED`.
   * @param dst the buffer the record is copied into
   * @param off where in `dst` the record's first byte goes
   * @param timeoutMs the longest wait in milliseconds, from the call; 0 polls
   *   one round, negative waits with no limit
   * @returns what `tryPop` answers for the record (its length, or
   *   `RING_TOO_SMALL`), `RING_EMPTY` when the time ran out, or
   *   `SHM_UNSUPPORTED`
   */
  popWait(dst: u8[], off: i32, timeoutMs: i32): i32 {
    const deadline: i64 = ringDeadline(timeoutMs)
    while (true) {
      for (let i: i32 = 0; i < RING_SPINS; i++) {
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
      this.region.storeI32(ringAdd(this.base, RING_SLEEP_AT), RING_ASLEEP, SEQ_CST)
      if (!ringSleep(this.region, this.base, this.ready(SEQ_CST), waitMs)) {
        return SHM_UNSUPPORTED
      }
    }
  }

  /**
   * The next record, lent in place as the ring's own bytes, without copying
   * or blocking; `release` frees it for the producer. Empty (length 0) when
   * there is none, and also for a record peek cannot lend: one `tryPush`
   * wrapped across the end of the ring, or one of length 0. On an empty
   * answer nothing is lent, and `tryPop` takes the record if there is one.
   * Panics while a record is lent. The producer's position is loaded
   * `ACQUIRE` when the cache says the ring is empty.
   * @returns the consumer's window, the same array on every call after the
   *   first and re-pointed by each: its bytes are the ring's own memory, not a
   *   copy, and stay the record's until `release`, which empties the window.
   *   Length 0 when nothing is lent
   */
  peek(): readonly u8[] {
    this.notPeeked("peek")
    if (!this.ready(ACQUIRE)) {
      const none: u8[] = this.emptyWindow(this.view)
      this.view = none
      return none
    }
    const len: i32 = this.lengthAt(this.head, this.seenTail)
    const mask: integer<0, 1073741823> = this.mask
    const fromBack: i32 = ((~toI32(this.found) & mask) - 4) & mask
    if (len === 0 || len > fromBack + 1) {
      const none: u8[] = this.emptyWindow(this.view)
      this.view = none
      return none
    }
    const last: integer<0, 2147483647> = this.lastAt
    const r: u8[] = this.region.lend(last - fromBack, len, this.view)
    this.view = r
    this.peekedEnd = ringPos(this.found, ringRecordWide(len))
    return r
  }

  /**
   * Frees the record `peek` lent, the store `tryPop` makes, and gives the
   * window back, so it is empty after. Panics when no record is lent.
   */
  release(): void {
    const r: u8[] | null = this.view
    if (this.peekedEnd < toI64(0) || r === null) {
      panic("nish/sync/ring: release without a record peek lent")
    }
    this.region.giveBack(r)
    this.head = this.peekedEnd
    this.peekedEnd = -1
    this.region.storeI64(this.headAt, this.head, RELEASE)
  }
}

/**
 * Writes an `SpscRing`'s header at `base` and answers the ring: `capacity`
 * data bytes, a power of two from 8, and `doorbell` for `popWait`. The
 * memory is the creator's to give; a ring already there is reset. The header
 * is stored `RELAXED` and its magic last with `RELEASE`, so an attach whose
 * `ACQUIRE` load reads that store sees the header stored before it. A reset
 * ring had the magic already, so an attach racing a reset has no such
 * promise.
 * @param region the region the ring lives in
 * @param base the byte offset of the ring's header, a multiple of 64 with
 *   `spscRingBytes(capacity)` bytes of the region from it; anything else
 *   panics
 * @param capacity the ring's data bytes, a power of two from 8 (anything else
 *   panics); a record costs its length rounded up to 4, plus 4
 * @param doorbell whether a consumer's `popWait` may sleep on Linux's futex,
 *   at the cost of a `SEQ_CST` store and load on every push
 * @returns a new `SpscRing` on the empty ring, for this process's producer
 *   or consumer
 */
export const initSpscRing = (region: SharedRegion, base: i32, capacity: i32, doorbell: boolean): SpscRing => {
  if (capacity < 8 || !ringIsPowerOfTwo(capacity)) {
    panic(`nish/sync/ring: an SPSC ring's capacity is a power of two from 8, not ${capacity}`)
  }
  ringCheckPlace(region, base, toI64(spscRingBytes(capacity)), "an SPSC ring")
  region.storeI32(ringAdd(base, RING_SIZE_AT), capacity, RELAXED)
  region.storeI32(ringAdd(base, RING_BELL_AT), doorbell ? toI32(1) : toI32(0), RELAXED)
  region.storeI64(ringAdd(base, RING_TAIL_AT), toI64(0), RELAXED)
  region.storeI64(ringAdd(base, RING_HEAD_AT), toI64(0), RELAXED)
  region.storeI32(ringAdd(base, RING_SLEEP_AT), RING_AWAKE, RELAXED)
  region.storeI32(ringAdd(base, RING_MAGIC_AT), RING_SPSC_MAGIC, RELEASE)
  return new SpscRing(region, base)
}

/**
 * The `SpscRing` an `initSpscRing` wrote at `base`; an error when there is
 * none. The magic is loaded `ACQUIRE`, which pairs with the `RELEASE` store
 * of it that the init function makes last.
 * @param region the region the ring lives in, as this process mapped it
 * @param base the byte offset of the ring's header, a multiple of 64 inside
 *   the region
 * @returns a new `SpscRing` that starts from both positions as the header
 *   holds them now, or the reason there is no ring at `base`: a base that is
 *   not a multiple of 64 in the region, no SPSC magic, a capacity no
 *   `initSpscRing` writes, or data that would run past the region's end
 */
export const attachSpscRing = (region: SharedRegion, base: i32): Result<SpscRing, string> => {
  if (!ringFits(region, base, toI64(RING_DATA_AT))) {
    return Err(ringPlaceError(region, base, toI64(RING_DATA_AT), "an SPSC ring"))
  }
  if (region.loadI32(ringAdd(base, RING_MAGIC_AT), ACQUIRE) !== RING_SPSC_MAGIC) {
    return Err(`no SPSC ring at ${base}`)
  }
  const capacity: i32 = region.loadI32(ringAdd(base, RING_SIZE_AT), RELAXED)
  if (capacity < 8 || !ringIsPowerOfTwo(capacity)) {
    return Err(`the SPSC ring at ${base} has capacity ${capacity}`)
  }
  const bytes: i64 = toI64(RING_DATA_AT) + toI64(capacity)
  if (!ringFits(region, base, bytes)) {
    return Err(ringPlaceError(region, base, bytes, "an SPSC ring"))
  }
  return Ok(new SpscRing(region, base))
}

/**
 * Any number of producers, one consumer, records of at most `slotBytes`.
 * Make it with `initMpscRing` or `attachMpscRing`.
 */
export class MpscRing {
  /** The region the ring lives in. */
  private region: SharedRegion
  /** Its header's offset in the region. */
  private base: i32
  /** Slots, a power of two. */
  private slots: i32
  /** Each slot's payload bytes, a multiple of 8. */
  private slotBytes: i32
  /** Whether a push rings the consumer's doorbell. */
  private doorbell: boolean
  /** The consumer's position: records ever popped (this object's, as the consumer). */
  head: i64
  /** `slots - 1`, which turns a position into a slot's index; 0 for a count no ring has. */
  private mask: integer<0, 1073741823> = 0
  /** The bytes from one slot to the next: its head and its payload. */
  private stride: integer<0, 2147483647> = 0
  /**
   * The offsets of the last slot's sequence number, length word and payload.
   * A slot is reached counting back from them by `(mask - index) * stride`
   * bytes, with `ringBack` and `ringBackAt`.
   */
  private lastSeqAt: integer<0, 2147483647> = 0
  private lastLenAt: integer<0, 2147483647> = 0
  private lastPayloadAt: integer<0, 2147483647> = 0
  /** The producers' position's offset in the region. */
  private tailAt: i32 = 0
  /** The consumer's position's offset in the region. */
  private headAt: i32 = 0

  /**
   * Reads the header of the ring at `base`: its shape, its doorbell and the
   * consumer's position (an `ACQUIRE` load). It checks nothing; a program
   * gets its ring from `initMpscRing` or `attachMpscRing`, which check the
   * place and the magic first.
   * @param region the region the ring lives in
   * @param base the byte offset of the ring's header in `region`
   */
  constructor(region: SharedRegion, base: i32) {
    this.region = region
    this.base = base
    this.slots = region.loadI32(ringAdd(base, RING_SIZE_AT), RELAXED)
    this.slotBytes = region.loadI32(ringAdd(base, RING_SLOT_AT), RELAXED)
    const mask: i32 = ringSub(this.slots, 1)
    this.mask = mask >= 0 && mask <= 1073741823 ? mask : 0
    this.stride = ringFloor(ringAdd(RING_SLOT_HEAD, this.slotBytes))
    this.lastSeqAt = ringFloor(ringAdd(ringAdd(base, RING_DATA_AT), ringMul(this.mask, this.stride)))
    this.lastLenAt = ringFloor(ringAdd(this.lastSeqAt, 8))
    this.lastPayloadAt = ringFloor(ringAdd(this.lastSeqAt, RING_SLOT_HEAD))
    this.tailAt = ringAdd(base, RING_TAIL_AT)
    this.headAt = ringAdd(base, RING_HEAD_AT)
    this.doorbell = region.loadI32(ringAdd(base, RING_BELL_AT), RELAXED) !== 0
    this.head = region.loadI64(this.headAt, ACQUIRE)
  }

  /**
   * Queues `src[off, off + len)` as one record: false when every slot is
   * taken now. A record longer than a slot panics, and so does an enqueue
   * position a peer wrote back; `offer` answers them as `RING_TOO_LONG` and
   * `RING_CORRUPT` instead. The producer claims a slot with a `RELAXED`
   * compare-exchange on the enqueue position, after an `ACQUIRE` load of the
   * slot's sequence number; it copies the record in and publishes it with one
   * store of that number, `RELEASE`, or `SEQ_CST` followed by the doorbell
   * check on a doorbell ring.
   * @param src the bytes to queue
   * @param off where in `src` the record starts
   * @param len the record's length in bytes, from 0 to `slotBytes`; a range
   *   outside `src` panics
   * @returns true when the record is queued, false when the slot it would
   *   take has not been freed by the consumer yet (nothing is written)
   */
  tryPush(src: readonly u8[], off: i32, len: i32): boolean {
    const rc: i32 = this.offer(src, off, len)
    if (rc === RING_TOO_LONG) {
      panic(`nish/sync/ring: a record of ${len} bytes does not fit a slot of ${this.slotBytes}`)
    }
    if (rc === RING_CORRUPT) {
      panic("nish/sync/ring: the enqueue position went backwards: the ring is corrupt")
    }
    return rc === 0
  }

  /**
   * `tryPush`, with a record too long for a slot answered rather than a
   * panic, for a caller built with `--deny-panics` or one whose lengths come
   * from outside. It claims and publishes the slot exactly as `tryPush` does.
   * @param src the bytes to queue
   * @param off where in `src` the record starts
   * @param len the record's length in bytes, from 0 to `slotBytes`; a range
   *   outside `src` panics, in `SharedRegion.write`
   * @returns 0 when the record is queued, `RING_FULL` when the slot it would
   *   take has not been freed by the consumer yet, `RING_TOO_LONG` for a
   *   length outside `[0, slotBytes]`, or `RING_CORRUPT` when the enqueue
   *   position in the header went backwards, which no producer does; nothing
   *   is written unless it is 0
   */
  offer(src: readonly u8[], off: i32, len: i32): i32 {
    if (len < 0 || len > this.slotBytes) {
      return RING_TOO_LONG
    }
    const tailAt: i32 = this.tailAt
    let pos: i64 = this.region.loadI64(tailAt, RELAXED)
    while (true) {
      const seq: i64 = this.region.loadI64(
        ringBackAt(this.lastSeqAt, ringBack(pos, this.mask), this.stride),
        ACQUIRE
      )
      if (seq === pos) {
        const seen: i64 = this.region.compareExchangeI64(tailAt, pos, ringPos(pos, toI64(1)), RELAXED)
        if (seen === pos) {
          break
        }
        pos = seen
      } else if (seq < pos) {
        return RING_FULL
      } else {
        // A slot one lap on means some producer moved the position past
        // `pos`, and producers only move it forward: one that reads `pos`
        // again was written back by something that is no producer.
        const again: i64 = this.region.loadI64(tailAt, RELAXED)
        if (again === pos) {
          return RING_CORRUPT
        }
        pos = again
      }
    }
    const by: integer<0, 1073741823> = ringBack(pos, this.mask)
    const slot: i32 = ringBackAt(this.lastSeqAt, by, this.stride)
    this.region.storeI32(ringBackAt(this.lastLenAt, by, this.stride), len, RELAXED)
    this.region.write(ringBackAt(this.lastPayloadAt, by, this.stride), src, off, len)
    if (this.doorbell) {
      this.region.storeI64(slot, ringPos(pos, toI64(1)), SEQ_CST)
      ringRing(this.region, this.base)
    } else {
      this.region.storeI64(slot, ringPos(pos, toI64(1)), RELEASE)
    }
    return 0
  }

  /** Whether the slot at the consumer's position is filled. */
  private ready(order: i32): boolean {
    return (
      this.region.loadI64(ringBackAt(this.lastSeqAt, ringBack(this.head, this.mask), this.stride), order) ===
      ringPos(this.head, toI64(1))
    )
  }

  /** Empties the consumer's slot for the producer one lap on. */
  private release(slot: i32): void {
    this.region.storeI64(slot, ringPos(this.head, toI64(this.slots)), RELEASE)
    this.head = ringPos(this.head, toI64(1))
    this.region.storeI64(this.headAt, this.head, RELAXED)
  }

  /** The length in the consumer's slot, whose length word is at `at`, or `RING_CORRUPT` for one no producer writes. */
  private lengthAt(at: i32): i32 {
    const len: i32 = this.region.loadI32(at, RELAXED)
    return len < 0 || len > this.slotBytes ? RING_CORRUPT : len
  }

  /** The panic `tryPop` and `popWait` give for a slot `take` found corrupt. */
  private corrupt(): void {
    const len: i32 = this.region.loadI32(
      ringBackAt(this.lastLenAt, ringBack(this.head, this.mask), this.stride),
      RELAXED
    )
    panic(`nish/sync/ring: a record of length ${len} at position ${this.head}: the ring is corrupt`)
  }

  /**
   * Moves the next record into `dst` from `off` and answers its length:
   * `RING_EMPTY` when there is none, `RING_TOO_SMALL` (keeping it queued)
   * when it is longer than `dst.length - off`. The slot's sequence number is
   * loaded `ACQUIRE`, and the slot is freed for the producers with a
   * `RELEASE` store of it.
   * @param dst the buffer the record is copied into
   * @param off where in `dst` the record's first byte goes
   * @returns the record's length in bytes, or `RING_EMPTY`, or
   *   `RING_TOO_SMALL`
   */
  tryPop(dst: u8[], off: i32): i32 {
    const n: i32 = this.take(dst, off)
    if (n === RING_CORRUPT) {
      this.corrupt()
    }
    return n
  }

  /**
   * `tryPop`, with a slot another process scribbled on answered as
   * `RING_CORRUPT` rather than a panic, for a caller built with
   * `--deny-panics`. The loads and stores are `tryPop`'s.
   * @param dst the buffer the record is copied into
   * @param off where in `dst` the record's first byte goes
   * @returns the record's length in bytes, or `RING_EMPTY`,
   *   `RING_TOO_SMALL` (it stays queued) or `RING_CORRUPT` (nothing moves)
   */
  take(dst: u8[], off: i32): i32 {
    if (!this.ready(ACQUIRE)) {
      return RING_EMPTY
    }
    const by: integer<0, 1073741823> = ringBack(this.head, this.mask)
    const len: i32 = this.lengthAt(ringBackAt(this.lastLenAt, by, this.stride))
    if (len === RING_CORRUPT) {
      return RING_CORRUPT
    }
    if (toI64(len) + toI64(off) > toI64(dst.length)) {
      return RING_TOO_SMALL
    }
    this.region.read(ringBackAt(this.lastPayloadAt, by, this.stride), dst, off, len)
    this.release(ringBackAt(this.lastSeqAt, by, this.stride))
    return len
  }

  /**
   * Moves up to `lens.length` records into `dst`, back to back from 0, while
   * they fit, and sets `lens[i]` to each one's length: how many it moved.
   * Unlike `SpscRing.popBatch` it costs what as many `tryPop`s would: an
   * `ACQUIRE` load and a `RELEASE` store per record.
   * @param dst the buffer the records are copied into, with no gap between
   *   them; the first record that does not fit the room left ends the batch
   *   and stays queued
   * @param lens where each moved record's length is written, from index 0;
   *   its length is the most records one call moves
   * @returns how many records it moved, 0 when the ring is empty or the next
   *   record does not fit `dst`; `lens[0, count)` holds their lengths
   */
  popBatch(dst: u8[], lens: i32[]): i32 {
    let count: i32 = 0
    let used: i32 = 0
    while (count < toI32(lens.length) && this.ready(ACQUIRE)) {
      const by: integer<0, 1073741823> = ringBack(this.head, this.mask)
      const len: i32 = this.lengthAt(ringBackAt(this.lastLenAt, by, this.stride))
      if (len === RING_CORRUPT) {
        this.corrupt()
      }
      if (toI64(len) + toI64(used) > toI64(dst.length)) {
        break
      }
      this.region.read(ringBackAt(this.lastPayloadAt, by, this.stride), dst, used, len)
      this.release(ringBackAt(this.lastSeqAt, by, this.stride))
      if (count >= 0 && count < toI32(lens.length)) {
        lens[count] = len
      }
      count = count + 1
      used = ringAdd(used, len)
    }
    return count
  }

  /**
   * `SpscRing.popWait`, for this ring: `tryPop`, but on an empty ring it polls
   * briefly and then sleeps until a push rings the doorbell, for at most
   * `timeoutMs`, checked between rounds of polling. A ring without a doorbell,
   * or one off Linux, answers `SHM_UNSUPPORTED` after a round that finds
   * nothing.
   * @param dst the buffer the record is copied into
   * @param off where in `dst` the record's first byte goes
   * @param timeoutMs the longest wait in milliseconds, from the call; 0 polls
   *   one round, negative waits with no limit
   * @returns what `tryPop` answers for the record (its length, or
   *   `RING_TOO_SMALL`), `RING_EMPTY` when the time ran out, or
   *   `SHM_UNSUPPORTED`
   */
  popWait(dst: u8[], off: i32, timeoutMs: i32): i32 {
    const n: i32 = this.takeWait(dst, off, timeoutMs)
    if (n === RING_CORRUPT) {
      this.corrupt()
    }
    return n
  }

  /**
   * `popWait` on `take`: a slot another process scribbled on ends the wait
   * as `RING_CORRUPT` rather than a panic, for a caller built with
   * `--deny-panics`. It polls and sleeps exactly as `popWait` does.
   * @param dst the buffer the record is copied into
   * @param off where in `dst` the record's first byte goes
   * @param timeoutMs the longest wait in milliseconds, from the call; 0 polls
   *   one round, negative waits with no limit
   * @returns what `take` answers for the record (its length,
   *   `RING_TOO_SMALL` or `RING_CORRUPT`), `RING_EMPTY` when the time ran
   *   out, or `SHM_UNSUPPORTED`
   */
  takeWait(dst: u8[], off: i32, timeoutMs: i32): i32 {
    const deadline: i64 = ringDeadline(timeoutMs)
    while (true) {
      for (let i: i32 = 0; i < RING_SPINS; i++) {
        const n: i32 = this.take(dst, off)
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
      this.region.storeI32(ringAdd(this.base, RING_SLEEP_AT), RING_ASLEEP, SEQ_CST)
      if (!ringSleep(this.region, this.base, this.ready(SEQ_CST), waitMs)) {
        return SHM_UNSUPPORTED
      }
    }
  }
}

/**
 * Writes an `MpscRing`'s header at `base` and answers the ring: `slots`
 * slots, a power of two from 2, of `slotBytes` each, a multiple of 8 from 8,
 * and `doorbell` for `popWait`. A ring already there is reset. The header and
 * every slot's sequence number are stored `RELAXED` and the magic last with
 * `RELEASE`, so an attach whose `ACQUIRE` load reads that store sees them
 * all. A reset ring had the magic already, so an attach racing a reset has
 * no such promise.
 * @param region the region the ring lives in
 * @param base the byte offset of the ring's header, a multiple of 64 with
 *   `mpscRingBytes(slots, slotBytes)` bytes of the region from it; anything
 *   else panics
 * @param slots how many records the ring holds at once, a power of two from
 *   2; anything else panics
 * @param slotBytes the longest record, in bytes, a multiple of 8 from 8;
 *   anything else panics
 * @param doorbell whether a consumer's `popWait` may sleep on Linux's futex,
 *   at the cost of a `SEQ_CST` store and load on every push
 * @returns a new `MpscRing` on the empty ring, for this process's producer
 *   or consumer
 */
export const initMpscRing = (
  region: SharedRegion,
  base: i32,
  slots: i32,
  slotBytes: i32,
  doorbell: boolean
): MpscRing => {
  const made: Result<MpscRing, string> = tryInitMpscRing(region, base, slots, slotBytes, doorbell)
  if (made.isErr()) {
    panic(made.error)
  }
  return made.value
}

/** `mpscRingBytes` in i64, where the most any i32 shape takes is far below 2^63. */
const mpscRingBytesWide = (slots: i32, slotBytes: i32): i64 =>
  toI64(RING_DATA_AT) + toI64(slots) * toI64(RING_SLOT_HEAD) + toI64(slots) * toI64(slotBytes)

/**
 * `initMpscRing`, with a shape or a place it cannot use answered as an `Err`
 * rather than a panic, for a caller built with `--deny-panics` or one whose
 * shape comes from outside. It writes the header exactly as `initMpscRing`
 * does, and writes nothing when it answers an `Err`.
 * @param region the region the ring lives in
 * @param base the byte offset of the ring's header, a multiple of 64 with
 *   `mpscRingBytes(slots, slotBytes)` bytes of the region from it
 * @param slots how many records the ring holds at once, a power of two from 2
 * @param slotBytes the longest record, in bytes, a multiple of 8 from 8
 * @param doorbell whether a consumer's `popWait` may sleep on Linux's futex,
 *   at the cost of a `SEQ_CST` store and load on every push
 * @returns a new `MpscRing` on the empty ring, or the message
 *   `initMpscRing` would panic with
 */
export const tryInitMpscRing = (
  region: SharedRegion,
  base: i32,
  slots: i32,
  slotBytes: i32,
  doorbell: boolean
): Result<MpscRing, string> => {
  if (slots < 2 || !ringIsPowerOfTwo(slots) || slotBytes < 8 || slotBytes % 8 !== 0) {
    return Err(
      `nish/sync/ring: an MPSC ring has a power of two from 2 slots of a multiple of 8 bytes, not ${slots} of ${slotBytes}`
    )
  }
  const bytes: i64 = mpscRingBytesWide(slots, slotBytes)
  if (!ringFits(region, base, bytes)) {
    return Err(ringPlaceError(region, base, bytes, "an MPSC ring"))
  }
  region.storeI32(ringAdd(base, RING_SIZE_AT), slots, RELAXED)
  region.storeI32(ringAdd(base, RING_SLOT_AT), slotBytes, RELAXED)
  region.storeI32(ringAdd(base, RING_BELL_AT), doorbell ? toI32(1) : toI32(0), RELAXED)
  region.storeI64(ringAdd(base, RING_TAIL_AT), toI64(0), RELAXED)
  region.storeI64(ringAdd(base, RING_HEAD_AT), toI64(0), RELAXED)
  region.storeI32(ringAdd(base, RING_SLEEP_AT), RING_AWAKE, RELAXED)
  const stride: i32 = ringAdd(RING_SLOT_HEAD, slotBytes)
  const data: i32 = ringAdd(base, RING_DATA_AT)
  for (let i: i32 = 0; i < slots; i++) {
    region.storeI64(ringAdd(data, ringMul(i, stride)), toI64(i), RELAXED)
  }
  region.storeI32(ringAdd(base, RING_MAGIC_AT), RING_MPSC_MAGIC, RELEASE)
  return Ok(new MpscRing(region, base))
}

/**
 * The `MpscRing` an `initMpscRing` wrote at `base`; an error when there is
 * none. The magic is loaded `ACQUIRE`, which pairs with the `RELEASE` store
 * of it that the init function makes last.
 * @param region the region the ring lives in, as this process mapped it
 * @param base the byte offset of the ring's header, a multiple of 64 inside
 *   the region
 * @returns a new `MpscRing` that starts from the consumer's position as the
 *   header holds it now, or the reason there is no ring at `base`: a base
 *   that is not a multiple of 64 in the region, no MPSC magic, a shape no
 *   `initMpscRing` writes, or slots that would run past the region's end
 */
export const attachMpscRing = (region: SharedRegion, base: i32): Result<MpscRing, string> => {
  if (!ringFits(region, base, toI64(RING_DATA_AT))) {
    return Err(ringPlaceError(region, base, toI64(RING_DATA_AT), "an MPSC ring"))
  }
  if (region.loadI32(ringAdd(base, RING_MAGIC_AT), ACQUIRE) !== RING_MPSC_MAGIC) {
    return Err(`no MPSC ring at ${base}`)
  }
  const slots: i32 = region.loadI32(ringAdd(base, RING_SIZE_AT), RELAXED)
  const slotBytes: i32 = region.loadI32(ringAdd(base, RING_SLOT_AT), RELAXED)
  if (slots < 2 || !ringIsPowerOfTwo(slots) || slotBytes < 8 || slotBytes % 8 !== 0) {
    return Err(`the MPSC ring at ${base} has ${slots} slots of ${slotBytes} bytes`)
  }
  const bytes: i64 = mpscRingBytesWide(slots, slotBytes)
  if (!ringFits(region, base, bytes)) {
    return Err(ringPlaceError(region, base, bytes, "an MPSC ring"))
  }
  return Ok(new MpscRing(region, base))
}
