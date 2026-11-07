// `SpscRing.reserve`/`commit`/`abandon` and `peek`/`release` end to end. With
// no arguments this program is the driver; it runs itself again
// (`child <name> <what>`) as the other end of a ring and for each panic:
//
//   1. one process: a reserved window is the ring's bytes and `commit`
//      publishes its first `len` of them; `abandon` publishes nothing; a full
//      ring answers an empty window; a reservation that does not fit the rest
//      of the lap starts at the next one behind a skip marker, which tryPop,
//      popBatch and peek each step over; peek answers an empty window for a
//      record tryPush wrapped and for one of length 0, and tryPop takes them;
//      both windows are one header each, re-pointed, and empty in between;
//   2. tryPush and reserve mixed over many laps of a small ring;
//   3. across processes, both ways, records of 1 to 10 KB over hundreds of
//      laps of a 64 KB ring: the driver reserves (and sometimes pushes) and a
//      child peeks (and pops what peek cannot lend); then a child reserves
//      and the driver takes them with popBatch and popWait;
//   4. every misuse is a checked panic that names it, in a child of its own,
//      among them a window indexed in a loop past a `commit` or a `release`
//      in the same body, which must not keep the length it had.
import { readFileSyncOrNull } from "nish:fs"
import { monotonicNanos, spawn, spawnSyncTo, waitPid } from "nish:process"
import { attachSpscRing, initSpscRing, RING_EMPTY, SpscRing } from "nish/sync/ring"
import { createRegion, openRegion, RELAXED, SEQ_CST, SHM_UNSUPPORTED, SharedRegion, unlinkRegion } from "nish/sync/shm"
import { Suite } from "nish/testing"

// The region: a child's verdict and counts, then the rings at 64-byte boundaries.
const RESULT_AT: i32 = 0 // i32: 1 for good
const COUNT_AT: i32 = 8 // i64: records a child consumed
const PEEKED_AT: i32 = 16 // i64: of them, the ones peek lent
const SMALL_AT: i32 = 64 // an SPSC ring of 64
const MIXED_AT: i32 = SMALL_AT + 320 // an SPSC ring of 256
const BIG_AT: i32 = MIXED_AT + 512 // an SPSC ring of 64 KB with a doorbell
const BIG: i32 = 65536
const BYTES: i32 = BIG_AT + 256 + BIG
const RECORDS: i32 = 3000

/** The length of cross-process record `seq`: 1 to 10 KB. */
const lengthOf = (seq: i32): i32 => 1024 + ((seq * 7919) % 9217)

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
const filled = (buf: readonly u8[], at: i32, len: i32, seed: i32): boolean => {
  for (let i = 0; i < len; i++) {
    const k: i32 = at + i
    if (k < 0 || k >= buf.length || buf[k] !== toU8((seed + i) & 255)) {
      return false
    }
  }
  return true
}

/** A cross-process record: `seq` in its first 4 bytes, little-endian, then `fill` from 4. */
const write = (buf: u8[], at: i32, seq: i32, len: i32): void => {
  for (let i = 0; i < 4; i++) {
    if (at + i >= 0 && at + i < buf.length) {
      buf[at + i] = toU8((seq >> (8 * i)) & 255)
    }
  }
  fill(buf, at + 4, len - 4, seq)
}

/** Whether `buf[at, at + len)` is record `seq`, of its length. */
const isRecord = (buf: readonly u8[], at: i32, len: i32, seq: i32): boolean => {
  if (len !== lengthOf(seq) || at < 0 || at + 4 > buf.length) {
    return false
  }
  let got: i32 = 0
  for (let i = 0; i < 4; i++) {
    got = got | (toI32(buf[at + i]) << (8 * i))
  }
  return got === seq && filled(buf, at + 4, len - 4, seq)
}

/** The driver's end of a child: its exit status. */
const reap = (pid: i32): i32 => {
  const st = waitPid(pid, 0)
  return st[0] === pid ? st[1] : -1
}

/** Whether 30 seconds have passed since `start`: a peer that stopped. */
const late = (start: i64): boolean => monotonicNanos() - start > toI64(30000) * toI64(1000000)

/**
 * Sends record `seq`: every third by `tryPush` from `buf`, the rest by
 * `reserve`, some reserving more than they commit and some abandoning a
 * first reservation. False when the peer stopped taking them.
 */
const send = (ring: SpscRing, buf: u8[], seq: i32, start: i64): boolean => {
  const len: i32 = lengthOf(seq)
  if (seq % 3 === 2) {
    write(buf, 0, seq, len)
    while (!ring.tryPush(buf, 0, len)) {
      if (late(start)) {
        return false
      }
    }
    return true
  }
  const extra: i32 = seq % 5 === 0 ? 100 : 0
  let abandon: boolean = seq % 7 === 0
  while (true) {
    const w: u8[] = ring.reserve(len + extra)
    if (w.length > 0) {
      if (abandon) {
        w[0] = 0xff
        ring.abandon()
        abandon = false
        continue
      }
      write(w, 0, seq, len)
      ring.commit(len)
      return true
    }
    if (late(start)) {
      return false
    }
  }
}

/** The child consumer: peek what it can, tryPop the rest, every record in order. */
const consume = (region: SharedRegion): i32 => {
  const ring = attachSpscRing(region, BIG_AT).expect("attach the big ring")
  const buf: u8[] = new Array<u8>(10240)
  const start: i64 = monotonicNanos()
  let ok = true
  let n: i32 = 0
  let peeked: i32 = 0
  while (n < RECORDS && !late(start)) {
    const r: readonly u8[] = ring.peek()
    if (r.length > 0) {
      if (!isRecord(r, 0, toI32(r.length), n)) {
        ok = false
      }
      ring.release()
      peeked = peeked + 1
      n = n + 1
      continue
    }
    const len: i32 = ring.tryPop(buf, 0)
    if (len === RING_EMPTY) {
      continue
    }
    if (!isRecord(buf, 0, len, n)) {
      ok = false
    }
    n = n + 1
  }
  region.storeI64(COUNT_AT, toI64(n), RELAXED)
  region.storeI64(PEEKED_AT, toI64(peeked), RELAXED)
  region.storeI32(RESULT_AT, ok ? 1 : 2, SEQ_CST)
  return 0
}

/** The child producer: every record, through `send`. */
const produce = (region: SharedRegion): i32 => {
  const ring = attachSpscRing(region, BIG_AT).expect("attach the big ring")
  const buf: u8[] = new Array<u8>(10240)
  const start: i64 = monotonicNanos()
  for (let seq = 0; seq < RECORDS; seq++) {
    if (!send(ring, buf, seq, start)) {
      return 3
    }
  }
  return 0
}

const child = (name: string, what: string): i32 => {
  const region = openRegion(name).expect("the child opens the region")
  if (what === "consume") {
    return consume(region)
  }
  if (what === "produce") {
    return produce(region)
  }
  const ring = initSpscRing(region, SMALL_AT, 64, false)
  const buf: u8[] = new Array<u8>(64)
  if (what === "reserve-twice") {
    ring.reserve(4)
    ring.reserve(4)
  } else if (what === "reserve-none") {
    ring.reserve(0)
  } else if (what === "reserve-long") {
    ring.reserve(29)
  } else if (what === "commit-none") {
    ring.commit(0)
  } else if (what === "commit-long") {
    ring.reserve(8)
    ring.commit(9)
  } else if (what === "abandon-none") {
    ring.abandon()
  } else if (what === "push-reserved") {
    ring.reserve(8)
    ring.tryPush(buf, 0, 4)
  } else if (what === "pushed") {
    ring.reserve(8).push(toU8(1))
    ring.commit(8)
  } else if (what === "peek-twice" || what === "pop-peeked" || what === "batch-peeked") {
    ring.tryPush(buf, 0, 4)
    ring.tryPush(buf, 0, 4)
    ring.peek()
    if (what === "peek-twice") {
      ring.peek()
    } else if (what === "pop-peeked") {
      ring.tryPop(buf, 0)
    } else {
      ring.popBatch(buf, new Array<i32>(2))
    }
  } else if (what === "popwait-peeked") {
    ring.tryPush(buf, 0, 4)
    ring.peek()
    ring.popWait(buf, 0, 0)
  } else if (what === "release-none") {
    ring.release()
  } else if (what === "lone-marker") {
    // A producer that lies: a skip marker with no record after it.
    ring.tryPush(buf, 0, 4)
    region.storeI32(SMALL_AT + 256, -1, RELAXED)
    ring.tryPop(buf, 0)
  } else if (what === "forged-pop" || what === "forged-batch" || what === "forged-peek") {
    // A marker in the middle of a lap (the data starts at SMALL_AT + 256, so
    // +8 is the second record): the record after it would be at the
    // next lap, 64, which is past the published tail. The word there is a
    // plausible length (4), so only the tail check can refuse it.
    ring.tryPush(buf, 0, 4)
    ring.tryPush(buf, 0, 4)
    ring.tryPop(buf, 0)
    region.storeI32(SMALL_AT + 256 + 8, -1, RELAXED)
    if (what === "forged-pop") {
      ring.tryPop(buf, 0)
    } else if (what === "forged-batch") {
      ring.popBatch(buf, new Array<i32>(2))
    } else {
      ring.peek()
    }
  } else if (what === "tiny") {
    const eight = initSpscRing(region, SMALL_AT, 8, false)
    eight.reserve(1)
  } else if (what === "sixteen") {
    const sixteen = initSpscRing(region, SMALL_AT, 16, false)
    sixteen.reserve(5)
  } else if (what === "loop-commit" || what === "loop-release") {
    let w: readonly u8[] = ring.reserve(16)
    if (what === "loop-release") {
      ring.commit(16)
      w = ring.peek()
    }
    let sum: i32 = 0
    for (let i: i32 = 0; i < w.length; i++) {
      if (i === 2) {
        if (what === "loop-commit") {
          ring.commit(16)
        } else {
          ring.release()
        }
      }
      sum = sum + toI32(w[i])
    }
    console.log(`${sum}`)
  }
  return 0 // not reached: each misuse above panics
}

/** One process: an SPSC ring of 64, so the edges of a lap come quickly. */
const alone = (t: Suite, region: SharedRegion): void => {
  const ring = initSpscRing(region, SMALL_AT, 64, false)
  const back = attachSpscRing(region, SMALL_AT).expect("attach the small ring")
  const dst: u8[] = new Array<u8>(64)
  const lens: i32[] = new Array<i32>(4)

  const w: u8[] = ring.reserve(28)
  t.eqI32("a reservation is the length asked for", toI32(w.length), 28)
  t.eqI32("and nothing is queued before commit", back.tryPop(dst, 0), RING_EMPTY)
  fill(w, 0, 28, 1)
  ring.commit(20)
  t.eqI32("commit empties the window", toI32(w.length), 0)
  const r: readonly u8[] = back.peek()
  t.eqI32("peek lends the record, of the length committed", toI32(r.length), 20)
  t.ok("with the bytes written into the window", filled(r, 0, 20, 1))
  back.release()
  t.eqI32("release empties it", toI32(r.length), 0)
  t.eqI32("and frees the record", back.tryPop(dst, 0), RING_EMPTY)
  t.eqI32("so peek answers empty", toI32(back.peek().length), 0)

  // The tail is at 24: a reservation of 28 (32 bytes) fits the 40 left.
  const again: u8[] = ring.reserve(28)
  t.eqI32("the next reservation is the same window", toI32(w.length), 28)
  fill(again, 0, 28, 2)
  ring.abandon()
  t.eqI32("abandon empties it", toI32(again.length), 0)
  t.eqI32("and publishes nothing", back.tryPop(dst, 0), RING_EMPTY)

  // Fill to the end of the lap, leaving 8 at 56: a reservation of 8 (12
  // bytes) cannot fit, so a skip marker covers 56..64 and it starts at 0.
  ring.reserve(28)
  ring.commit(28) // 24..56
  t.eqI32("a ring with no room for a window answers it empty", toI32(ring.reserve(28).length), 0)
  t.eqI32("tryPop takes the record before it", back.tryPop(dst, 0), 28)
  const wrapped: u8[] = ring.reserve(8)
  t.eqI32("a reservation past the end of the lap fits at its start", toI32(wrapped.length), 8)
  fill(wrapped, 0, 8, 3)
  ring.commit(8)
  t.eqI32("tryPop steps over the skip marker", back.tryPop(dst, 0), 8)
  t.ok("to the record", filled(dst, 0, 8, 3))

  // The tail is at 76 (12 in the lap). A record that ends the lap exactly
  // needs no marker; one that does not fit the rest of it does.
  ring.reserve(28)
  ring.commit(28) // 12..44
  ring.reserve(16)
  ring.commit(16) // 44..64
  t.eqI32("a record that ends the lap exactly needs no skip marker", back.popBatch(dst, lens), 2)
  ring.reserve(24)
  ring.commit(24) // 0..28
  ring.reserve(16)
  ring.commit(16) // 28..48
  back.popBatch(dst, lens)
  fill(ring.reserve(24), 0, 24, 5) // 28 bytes; 16 left, so behind a marker at 48
  ring.commit(24)
  t.eqI32("popBatch steps over a skip marker", back.popBatch(dst, lens), 1)
  t.ok("to the record", lens[0] === 24 && filled(dst, 0, 24, 5))

  ring.reserve(28)
  ring.commit(28) // 28..60
  fill(ring.reserve(4), 0, 4, 6) // 8 bytes; 4 left, so behind a marker at 60
  ring.commit(4)
  t.eqI32("peek takes the record before it", toI32(back.peek().length), 28)
  back.release()
  const after: readonly u8[] = back.peek()
  t.eqI32("and steps over the skip marker", toI32(after.length), 4)
  t.ok("to the record", filled(after, 0, 4, 6))
  back.release()

  // tryPush wraps a record across the end; peek cannot lend it.
  const src: u8[] = new Array<u8>(40)
  fill(src, 0, 40, 7)
  ring.tryPush(src, 0, 40) // 8..52
  back.tryPop(dst, 0)
  ring.tryPush(src, 0, 20) // 52..76: the payload crosses the end
  t.eqI32("peek answers empty for a record tryPush wrapped", toI32(back.peek().length), 0)
  t.eqI32("which tryPop takes", back.tryPop(dst, 0), 20)
  t.ok("whole", filled(dst, 0, 20, 7))
  ring.tryPush(src, 0, 0)
  t.eqI32("peek answers empty for a record of length 0", toI32(back.peek().length), 0)
  t.eqI32("which tryPop takes", back.tryPop(dst, 0), 0)
  t.eqI32("leaving none", back.tryPop(dst, 0), RING_EMPTY)

  // A ring of 16 allows a reservation of 4 and no more; one of 8 none.
  const sixteen = initSpscRing(region, SMALL_AT, 16, false)
  const four: u8[] = sixteen.reserve(4)
  t.eqI32("a ring of 16 reserves 4 bytes", toI32(four.length), 4)
  fill(four, 0, 4, 9)
  sixteen.commit(4)
  t.eqI32("and commits them", sixteen.tryPop(dst, 0), 4)
  t.ok("whole", filled(dst, 0, 4, 9))
}

/** tryPush and reserve in turn, over many laps of a ring of 256. */
const mixed = (t: Suite, region: SharedRegion): void => {
  const ring = initSpscRing(region, MIXED_AT, 256, false)
  const src: u8[] = new Array<u8>(124)
  const dst: u8[] = new Array<u8>(124)
  let ok = true
  let peeked: i32 = 0
  for (let i = 0; i < 2000 && ok; i++) {
    const len: i32 = 1 + ((i * 37) % 124)
    if (i % 2 === 0) {
      fill(src, 0, len, i)
      ok = ring.tryPush(src, 0, len)
    } else {
      const w: u8[] = ring.reserve(len)
      fill(w, 0, len, i)
      ok = toI32(w.length) === len
      ring.commit(len)
    }
    const r: readonly u8[] = ring.peek()
    if (r.length > 0) {
      ok = ok && toI32(r.length) === len && filled(r, 0, len, i)
      ring.release()
      peeked = peeked + 1
    } else {
      ok = ok && ring.tryPop(dst, 0) === len && filled(dst, 0, len, i)
    }
  }
  t.ok("tryPush and reserve mix over 2000 records of 1 to 124 bytes", ok)
  t.ok("peek lends most of them", peeked > 1000 && peeked < 2000)
}

/** The driver produces into a child consumer, then consumes from a child producer. */
const across = (t: Suite, name: string, region: SharedRegion): void => {
  const ring = initSpscRing(region, BIG_AT, BIG, true)
  region.storeI32(RESULT_AT, 0, SEQ_CST)
  const pid: i32 = spawn([process.argv[0], "child", name, "consume"])
  if (!t.ok("the consumer starts", pid > 0)) {
    return
  }
  const buf: u8[] = new Array<u8>(10240)
  const start: i64 = monotonicNanos()
  let n: i32 = 0
  while (n < RECORDS && send(ring, buf, n, start)) {
    n = n + 1
  }
  t.eqI32("the producer reserved or pushed every record", n, RECORDS)
  t.eqI32("the consumer exits 0", reap(pid), 0)
  t.eqI64("the consumer took every record", region.loadI64(COUNT_AT, SEQ_CST), toI64(RECORDS))
  t.eqI32("in order, each its length and bytes", region.loadI32(RESULT_AT, SEQ_CST), 1)
  t.ok("most of them lent in place by peek", region.loadI64(PEEKED_AT, SEQ_CST) > toI64(RECORDS / 2))

  const back = initSpscRing(region, BIG_AT, BIG, true)
  const prod: i32 = spawn([process.argv[0], "child", name, "produce"])
  if (!t.ok("the producer starts", prod > 0)) {
    return
  }
  const dst: u8[] = new Array<u8>(BIG)
  const lens: i32[] = new Array<i32>(8)
  const from: i64 = monotonicNanos()
  let got: i32 = 0
  let ok = true
  while (got < RECORDS && ok && !late(from)) {
    if (got % 2 === 0) {
      const count: i32 = back.popBatch(dst, lens)
      let at: i32 = 0
      for (let i = 0; i < count; i++) {
        ok = ok && isRecord(dst, at, lens[i], got)
        at = at + lens[i]
        got = got + 1
      }
      if (count > 0) {
        continue
      }
    }
    let len: i32 = back.popWait(dst, 0, 5000)
    if (len === SHM_UNSUPPORTED) {
      len = back.tryPop(dst, 0)
    }
    if (len >= 0) {
      ok = ok && isRecord(dst, 0, len, got)
      got = got + 1
    }
  }
  t.eqI32("the reserving producer exits 0", reap(prod), 0)
  t.eqI32("popBatch and popWait took every record", got, RECORDS)
  t.ok("in order, each its length and bytes", ok)
}

/** A child that panics on `what`, and the message it gives. */
const panics = (t: Suite, name: string, what: string, needle: string): void => {
  const err: string = `build/sync-ring-inplace-${what}.err`
  const rc: i32 = spawnSyncTo([process.argv[0], "child", name, what], "", err)
  t.eqI32(`${what}: the child exits 1`, rc, 1)
  const text: string | null = readFileSyncOrNull(err)
  t.contains(`${what}: and says why`, text === null ? "" : text, needle)
}

export const main = (): i32 => {
  if (process.argv.length > 3 && process.argv[1] === "child") {
    return child(process.argv[2], process.argv[3])
  }
  const t = new Suite("nish/sync/ring in place")
  const name: string = `nish-test-ringw-${monotonicNanos() % toI64(1000000000)}`
  const made = createRegion(name, BYTES)
  if (made.isErr()) {
    t.fail("create a region", made.error.message)
    return t.done()
  }
  const region = made.value
  alone(t, region)
  mixed(t, region)
  across(t, name, region)
  const ring = "nish/sync/ring:"
  const open = "while a reservation is open; commit or abandon it first"
  const lent = "while peek has a record lent; release it first"
  panics(t, name, "reserve-twice", `${ring} reserve ${open}`)
  panics(t, name, "reserve-none", `${ring} a reservation of 0 bytes is not from 1 to 28`)
  panics(t, name, "reserve-long", `${ring} a reservation of 29 bytes is not from 1 to 28`)
  panics(t, name, "commit-none", `${ring} commit without a reservation`)
  panics(t, name, "commit-long", `${ring} commit of 9 bytes from a reservation of 8`)
  panics(t, name, "abandon-none", `${ring} abandon without a reservation`)
  panics(t, name, "push-reserved", `${ring} tryPush ${open}`)
  panics(t, name, "pushed", "window of length 9 is no longer the region's bytes: a push moved it")
  panics(t, name, "peek-twice", `${ring} peek ${lent}`)
  panics(t, name, "pop-peeked", `${ring} tryPop ${lent}`)
  panics(t, name, "batch-peeked", `${ring} popBatch ${lent}`)
  panics(t, name, "release-none", `${ring} release without a record peek lent`)
  panics(t, name, "lone-marker", `${ring} a record of length -1 at position 64: the ring is corrupt`)
  const forged = `${ring} a record of length 4 at position 64: the ring is corrupt`
  panics(t, name, "forged-pop", forged)
  panics(t, name, "forged-batch", forged)
  panics(t, name, "forged-peek", forged)
  panics(t, name, "tiny", `${ring} an SPSC ring of 8 bytes cannot reserve`)
  panics(t, name, "sixteen", `${ring} a reservation of 5 bytes is not from 1 to 4`)
  panics(t, name, "popwait-peeked", `${ring} tryPop ${lent}`)
  panics(t, name, "loop-commit", "index out of range: 2 >= 0")
  panics(t, name, "loop-release", "index out of range: 2 >= 0")
  t.ok("unlink the region", unlinkRegion(name).isOk())
  return t.done()
}
