// `nish/sync/ring` end to end. With no arguments this program is the driver;
// it runs itself again (`child <name> <what> [n]`) as the other end of a ring:
//
//   1. one process: an SPSC ring wraps with records of every length from 0 to
//      40, refuses a push when full, answers RING_TOO_SMALL without losing the
//      record, and pops a batch; an MPSC ring keeps order, refuses a push when
//      full and wraps; attaching refuses the wrong kind of ring, and a ring
//      without a doorbell answers SHM_UNSUPPORTED from popWait;
//   2. a child consumer takes 200000 records from an SPSC ring in order;
//   3. three child producers share one MPSC ring, and each one's records
//      arrive in its order, none lost;
//   4. (Linux) a consumer asleep in popWait is woken by a later push, long
//      before its timeout;
//   5. a ring placed off a 64-byte boundary, one that does not fit, a record
//      too long for the ring, and a length a lying producer wrote are each a
//      checked panic in a child.
import { getI32LE, setI32LE } from "nish/bytes"
import { readFileSyncOrNull } from "nish:fs"
import { monotonicNanos, platform, spawn, spawnSyncTo, waitPid } from "nish:process"
import {
  attachMpscRing,
  attachSpscRing,
  initMpscRing,
  initSpscRing,
  mpscRingBytes,
  RING_EMPTY,
  RING_TOO_SMALL,
  spscRingBytes,
} from "nish/sync/ring"
import {
  createRegion,
  openRegion,
  RELAXED,
  SEQ_CST,
  SHM_UNSUPPORTED,
  SharedRegion,
  unlinkRegion,
} from "nish/sync/shm"
import { Suite } from "nish/testing"

// The region: a result slot, then the rings at 64-byte boundaries.
const RESULT_AT: i32 = 0 // i32: a child's verdict, 1 for good
const COUNT_AT: i32 = 8 // i64: records a child consumed
const SMALL_AT: i32 = 64 // an SPSC ring of 64, for the one-process checks
const SLOTS_AT: i32 = SMALL_AT + 320 // an MPSC ring of 4 slots of 8
const BIG_AT: i32 = 512 // an SPSC ring of 4096 with a doorbell
const SHARED_AT: i32 = BIG_AT + 4096 + 256 // an MPSC ring of 64 slots of 8, with a doorbell
const PLAIN_AT: i32 = SHARED_AT + 256 + 64 * 24 // an SPSC ring of 64 without one
const BYTES: i32 = PLAIN_AT + 320
const RECORDS: i32 = 200000
const PRODUCERS: i32 = 3
const EACH: i32 = 50000

/** Writes `len` bytes from `at`: `seed`, `seed + 1`, ... */
const fill = (buf: u8[], at: i32, len: i32, seed: i32): void => {
  for (let i = 0; i < len; i++) {
    const k: i32 = at + i
    if (k >= 0 && k < buf.length) {
      buf[k] = toU8((seed + i) & 255)
    }
  }
}

/** Whether the `len` bytes from `at` are what `fill` wrote. */
const filled = (buf: u8[], at: i32, len: i32, seed: i32): boolean => {
  for (let i = 0; i < len; i++) {
    const k: i32 = at + i
    if (k < 0 || k >= buf.length || buf[k] !== toU8((seed + i) & 255)) {
      return false
    }
  }
  return true
}

/** The driver's end of a child: its exit status, after at most ten seconds. */
const reap = (pid: i32): i32 => {
  const st = waitPid(pid, 0)
  return st[0] === pid ? st[1] : -1
}

/** The SPSC consumer: every record in order, then its count and verdict. */
const consume = (region: SharedRegion): i32 => {
  const ring = attachSpscRing(region, BIG_AT).expect("attach the big ring")
  const buf: u8[] = new Array<u8>(64)
  let ok = true
  let n = 0
  while (n < RECORDS) {
    let len: i32 = ring.popWait(buf, 0, 5000)
    if (len === SHM_UNSUPPORTED) {
      len = ring.tryPop(buf, 0)
      if (len === RING_EMPTY) {
        continue
      }
    }
    if (len === RING_EMPTY) {
      break
    }
    if (len !== 4 + (n % 29) || getI32LE(buf, 0) !== n || !filled(buf, 4, len - 4, n)) {
      ok = false
    }
    n = n + 1
  }
  region.storeI64(COUNT_AT, toI64(n), RELAXED)
  region.storeI32(RESULT_AT, ok ? 1 : 2, SEQ_CST)
  return 0
}

/** An MPSC producer: `[me][seq]` for seq 0 to EACH - 1. */
const produce = (region: SharedRegion, me: i32): i32 => {
  const ring = attachMpscRing(region, SHARED_AT).expect("attach the shared ring")
  const rec: u8[] = new Array<u8>(8)
  setI32LE(rec, 0, me)
  const start: i64 = monotonicNanos()
  for (let seq = 0; seq < EACH; seq++) {
    setI32LE(rec, 4, seq)
    while (!ring.tryPush(rec, 0, 8)) {
      if (monotonicNanos() - start > toI64(30000) * toI64(1000000)) {
        return 3 // the driver stopped taking records
      }
    }
  }
  return 0
}

/** A consumer that sleeps until the driver's one late push wakes it. */
const sleeper = (region: SharedRegion): i32 => {
  const ring = attachSpscRing(region, BIG_AT).expect("attach the big ring")
  const buf: u8[] = new Array<u8>(8)
  region.storeI32(RESULT_AT, 1, SEQ_CST) // attached: the driver may push
  const len: i32 = ring.popWait(buf, 0, 10000)
  return len === 4 && getI32LE(buf, 0) === 77 ? 0 : 4
}

const child = (name: string, what: string, arg: i32): i32 => {
  const region = openRegion(name).expect("the child opens the region")
  if (what === "consume") {
    return consume(region)
  }
  if (what === "produce") {
    return produce(region, arg)
  }
  if (what === "sleep") {
    return sleeper(region)
  }
  const buf: u8[] = new Array<u8>(128)
  if (what === "misplaced") {
    initSpscRing(region, SMALL_AT + 8, 64, false)
  } else if (what === "too-big") {
    initSpscRing(region, PLAIN_AT, 65536, false)
  } else if (what === "long-record") {
    attachSpscRing(region, PLAIN_AT).expect("attach the plain ring").tryPush(buf, 0, 61)
  } else if (what === "long-slot") {
    attachMpscRing(region, SLOTS_AT).expect("attach the slot ring").tryPush(buf, 0, 9)
  } else if (what === "corrupt") {
    // A producer that lies: a length whose rounding up would overflow an i32.
    const ring = initSpscRing(region, PLAIN_AT, 64, false)
    ring.tryPush(buf, 0, 4)
    region.storeI32(PLAIN_AT + 256, 2147483645, RELAXED)
    ring.tryPop(buf, 0)
  }
  return 0 // not reached: each call above panics
}

/** One process: an SPSC ring of 64 and an MPSC ring of 4 slots of 8. */
const alone = (t: Suite, region: SharedRegion): void => {
  const ring = initSpscRing(region, SMALL_AT, 64, false)
  const back = attachSpscRing(region, SMALL_AT).expect("attach the small ring")
  const src: u8[] = new Array<u8>(64)
  const dst: u8[] = new Array<u8>(64)
  let ok = true
  for (let i = 0; i < 300; i++) {
    const len: i32 = i % 41
    fill(src, 0, len, i)
    if (!ring.tryPush(src, 0, len)) {
      ok = false
      break
    }
    const got: i32 = back.tryPop(dst, 0)
    if (got !== len || !filled(dst, 0, len, i)) {
      ok = false
      break
    }
  }
  t.ok("an SPSC ring wraps, with records of 0 to 40 bytes", ok)
  t.eqI32("an empty ring answers RING_EMPTY", back.tryPop(dst, 0), RING_EMPTY)
  fill(src, 0, 20, 9)
  let pushed = 0
  while (pushed < 10 && ring.tryPush(src, 0, 20)) {
    pushed = pushed + 1
  }
  t.eqI32("a ring of 64 holds two 24-byte records", pushed, 2)
  const small: u8[] = new Array<u8>(10)
  t.eqI32("a buffer too small is RING_TOO_SMALL", back.tryPop(small, 0), RING_TOO_SMALL)
  t.eqI32("which leaves the record", back.tryPop(dst, 30), 20)
  t.ok("at the offset asked for", filled(dst, 30, 20, 9))
  t.ok("so a push fits again", ring.tryPush(src, 0, 20))
  t.ok("and a short one beside it", ring.tryPush(src, 0, 4))
  const lens: i32[] = new Array<i32>(4)
  const count: i32 = back.popBatch(dst, lens)
  t.eqI32("a batch takes every record", count, 3)
  t.eqStr("of the lengths pushed", `${lens[0]} ${lens[1]} ${lens[2]}`, "20 20 4")
  t.ok("back to back in the buffer", filled(dst, 0, 20, 9) && filled(dst, 20, 20, 9) && filled(dst, 40, 4, 9))
  t.eqI32("leaving none", back.tryPop(dst, 0), RING_EMPTY)
  t.ok("attaching an SPSC ring as MPSC is refused", attachMpscRing(region, SMALL_AT).isErr())
  t.ok("as is attaching where no ring was made", attachSpscRing(region, BIG_AT + 4096 + 256 + 64).isErr())

  const slots = initMpscRing(region, SLOTS_AT, 4, 8, false)
  t.eqI32("an MPSC ring of 4 slots takes", mpscRingBytes(4, 8), 256 + 4 * 24)
  for (let i = 1; i <= 4; i++) {
    setI32LE(src, 0, i)
    slots.tryPush(src, 0, 4)
  }
  t.ok("a full MPSC ring refuses a push", !slots.tryPush(src, 0, 4))
  const order: string[] = []
  const n: i32 = slots.popBatch(dst, lens)
  for (let i = 0; i < n; i++) {
    order.push(`${getI32LE(dst, i * 4)}`)
  }
  t.eqStr("and gives its records back in order", order.join(" "), "1 2 3 4")
  let wraps = true
  for (let i = 0; i < 50; i++) {
    setI32LE(src, 0, i)
    if (!slots.tryPush(src, 0, 4) || slots.tryPop(dst, 0) !== 4 || getI32LE(dst, 0) !== i) {
      wraps = false
    }
  }
  t.ok("an MPSC ring wraps", wraps)
  t.ok("attaching an MPSC ring as SPSC is refused", attachSpscRing(region, SLOTS_AT).isErr())

  const plain = initSpscRing(region, PLAIN_AT, 64, false)
  t.eqI32("a ring without a doorbell refuses popWait", plain.popWait(dst, 0, 10), SHM_UNSUPPORTED)
}

/** A child consumes RECORDS records of 4 to 32 bytes, in order. */
const across = (t: Suite, name: string, region: SharedRegion): void => {
  const ring = initSpscRing(region, BIG_AT, 4096, true)
  region.storeI32(RESULT_AT, 0, SEQ_CST)
  const pid: i32 = spawn([process.argv[0], "child", name, "consume", "0"])
  if (!t.ok("the consumer starts", pid > 0)) {
    return
  }
  const rec: u8[] = new Array<u8>(64)
  const start: i64 = monotonicNanos()
  let n = 0
  while (n < RECORDS && monotonicNanos() - start < toI64(30000) * toI64(1000000)) {
    const len: i32 = 4 + (n % 29)
    setI32LE(rec, 0, n)
    fill(rec, 4, len - 4, n)
    if (ring.tryPush(rec, 0, len)) {
      n = n + 1
    }
  }
  t.eqI32("the producer pushed every record", n, RECORDS)
  t.eqI32("the consumer exits 0", reap(pid), 0)
  t.eqI64("the consumer took every record", region.loadI64(COUNT_AT, SEQ_CST), toI64(RECORDS))
  t.eqI32("in order, each its length", region.loadI32(RESULT_AT, SEQ_CST), 1)
}

/** Three child producers share an MPSC ring; this process consumes. */
const many = (t: Suite, name: string, region: SharedRegion): void => {
  const ring = initMpscRing(region, SHARED_AT, 64, 8, true)
  const pids: i32[] = []
  for (let p = 0; p < PRODUCERS; p++) {
    pids.push(spawn([process.argv[0], "child", name, "produce", `${p}`]))
  }
  const next: i32[] = new Array<i32>(PRODUCERS)
  const buf: u8[] = new Array<u8>(8)
  let total = 0
  let inOrder = true
  while (total < PRODUCERS * EACH) {
    let len: i32 = ring.popWait(buf, 0, 5000)
    if (len === SHM_UNSUPPORTED) {
      len = ring.tryPop(buf, 0)
      if (len === RING_EMPTY) {
        continue
      }
    }
    if (len !== 8) {
      break
    }
    const who: i32 = getI32LE(buf, 0)
    if (who < 0 || who >= next.length || getI32LE(buf, 4) !== next[who]) {
      inOrder = false
      break
    }
    next[who] = next[who] + 1
    total = total + 1
  }
  for (const pid of pids) {
    t.eqI32("a producer exits 0", pid > 0 ? reap(pid) : -1, 0)
  }
  t.eqI32("every record arrives", total, PRODUCERS * EACH)
  t.ok("each producer's in its order", inOrder)
}

/** A consumer asleep on the doorbell wakes for one late push. */
const doorbell = (t: Suite, name: string, region: SharedRegion): void => {
  if (platform !== "linux") {
    t.skip("a sleeping consumer is woken by a push", "the doorbell is Linux's futex")
    return
  }
  const ring = initSpscRing(region, BIG_AT, 4096, true)
  region.storeI32(RESULT_AT, 0, SEQ_CST)
  const pid: i32 = spawn([process.argv[0], "child", name, "sleep", "0"])
  if (!t.ok("the sleeper starts", pid > 0)) {
    return
  }
  const start: i64 = monotonicNanos()
  while (region.loadI32(RESULT_AT, SEQ_CST) === 0 && monotonicNanos() - start < toI64(5000) * toI64(1000000)) {}
  // Long enough for it to be asleep, not polling, when the push comes.
  region.waitI32(COUNT_AT + 4, 0, 100)
  const rec: u8[] = new Array<u8>(4)
  setI32LE(rec, 0, 77)
  t.ok("the late push fits", ring.tryPush(rec, 0, 4))
  t.eqI32("the sleeper wakes with it", reap(pid), 0)
  t.ok("long before its ten-second timeout", monotonicNanos() - start < toI64(5000) * toI64(1000000))
}

/** A child that panics on `what`, and the message it gives. */
const panics = (t: Suite, name: string, what: string, needle: string): void => {
  const err: string = `build/sync-ring-${what}.err`
  const rc: i32 = spawnSyncTo([process.argv[0], "child", name, what, "0"], "", err)
  t.eqI32(`${what}: the child exits 1`, rc, 1)
  const text: string | null = readFileSyncOrNull(err)
  t.contains(`${what}: and says why`, text === null ? "" : text, needle)
}

export const main = (): i32 => {
  if (process.argv.length > 4 && process.argv[1] === "child") {
    return child(process.argv[2], process.argv[3], toI32(Number(process.argv[4])))
  }
  const t = new Suite("nish/sync/ring")
  const name: string = `nish-test-ring-${monotonicNanos() % toI64(1000000000)}`
  const made = createRegion(name, BYTES)
  if (made.isErr()) {
    t.fail("create a region", made.error.message)
    return t.done()
  }
  const region = made.value
  t.eqI32("an SPSC ring of 4096 takes", spscRingBytes(4096), 4096 + 256)
  alone(t, region)
  across(t, name, region)
  many(t, name, region)
  doorbell(t, name, region)
  const at = "nish/sync/ring: an SPSC ring at"
  panics(t, name, "misplaced", `${at} 72: a ring's base is a multiple of 64`)
  panics(t, name, "too-big", `${at} ${PLAIN_AT} needs ${65536 + 256} bytes; the region has ${BYTES}`)
  panics(t, name, "long-record", "a record of 61 bytes does not fit a ring of 64")
  panics(t, name, "long-slot", "a record of 9 bytes does not fit a slot of 8")
  panics(t, name, "corrupt", "a record of length 2147483645 at position 0: the ring is corrupt")
  t.ok("unlink the region", unlinkRegion(name).isOk())
  return t.done()
}
