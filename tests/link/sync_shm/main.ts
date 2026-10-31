// `nish/sync/shm` end to end. With no arguments this program is the driver; it
// runs itself again (`child <name> <what>`) for what one process cannot show:
//
//   1. one process: create, the refusals (a name that exists, a bad name, a
//      missing one), a second mapping of the same name, every atomic at both
//      widths, byte windows, and `waitI32` answering at once or timing out;
//   2. two processes adding to one slot at once lose no increment, and the
//      i64 a child stores is the i64 the driver loads;
//   3. (Linux) a child asleep in `waitI32` is woken by the driver's `wake`;
//   4. (Linux) what a peer plants at a name is refused, never adopted: a
//      region others may read, a symbolic link, an empty object, a second
//      hard link to one of ours, a FIFO;
//   5. every unsafe access is a checked panic that names it, in a child of
//      its own: past the end, below 0, misaligned, an ordering the access
//      cannot take, a closed handle, and byte windows outside the region or
//      the buffer.
//
// The region's name carries the driver's start time, so two runs never share
// one, and the driver unlinks it before it reports.
import { readFileSyncOrNull } from "nish:fs"
import { monotonicNanos, platform, spawn, spawnSync, spawnSyncTo, waitPid } from "nish:process"
import {
  ACQ_REL,
  ACQUIRE,
  createRegion,
  fence,
  openRegion,
  RELAXED,
  RELEASE,
  SEQ_CST,
  SHM_ACCESS,
  SHM_EXISTS,
  SHM_INVALID,
  SHM_NOT_EQUAL,
  SHM_NOT_FOUND,
  SHM_TIMED_OUT,
  SHM_UNSUPPORTED,
  SharedRegion,
  unlinkRegion,
} from "nish/sync/shm"
import { Suite } from "nish/testing"

const BYTES: i32 = 64
const ADDS: i32 = 100000
const COUNT_AT: i32 = 0 // i32: both processes add to it
const WORD_AT: i32 = 8 // i64: the child's store
const BELL_AT: i32 = 16 // i32: the child sleeps on it
const WORD: i64 = 0x123456789
const FIVE_SECONDS: i64 = 5000000000

/** A child's work, by `what`; its exit status is the answer. */
const child = (name: string, what: string): i32 => {
  const region = openRegion(name).expect("the child opens the region")
  const buf: u8[] = new Array<u8>(1)
  if (what === "add") {
    for (let i = 0; i < ADDS; i++) {
      region.addI32(COUNT_AT, 1, RELAXED)
    }
    region.storeI64(WORD_AT, WORD, RELEASE)
    return 0
  }
  if (what === "sleep") {
    // Tell the driver it is about to sleep, then sleep until it is woken.
    region.storeI32(BELL_AT + 4, 1, SEQ_CST)
    const rc: i32 = region.waitI32(BELL_AT, 0, 10000)
    return rc === 0 || rc === SHM_NOT_EQUAL ? 0 : 3
  }
  if (what === "past-end") {
    region.loadI32(BYTES, RELAXED)
  } else if (what === "negative") {
    region.storeI64(-8, toI64(1), RELAXED)
  } else if (what === "misaligned") {
    region.addI64(4, toI64(1), SEQ_CST)
  } else if (what === "load-release") {
    region.loadI32(0, RELEASE)
  } else if (what === "store-acquire") {
    region.storeI64(0, toI64(1), ACQUIRE)
  } else if (what === "no-order") {
    region.exchangeI32(0, 1, 7)
  } else if (what === "closed") {
    region.close().expect("close")
    region.loadI32(0, RELAXED)
  } else if (what === "window") {
    region.read(BYTES - 1, buf, 0, 2)
  } else if (what === "buffer") {
    region.write(0, buf, 1, 1)
  }
  return 0 // not reached: each access above panics
}

/** (Linux) What a peer plants at a name is refused, never adopted. */
const planted = (t: Suite, name: string): void => {
  if (platform !== "linux") {
    t.skip("a region others may read is SHM_ACCESS", "the names live in /dev/shm on Linux")
    return
  }
  const loose = `${name}-loose`
  createRegion(loose, BYTES).expect("make a region to loosen").close().expect("close it")
  t.eqI32("chmod the region 0644", spawnSync(["chmod", "0644", `/dev/shm/${loose}`]), 0)
  const opened = openRegion(loose)
  if (opened.isErr()) {
    t.eqI32("a region others may read is SHM_ACCESS", opened.error.code, SHM_ACCESS)
  } else {
    t.fail("a region others may read is SHM_ACCESS", "it opened")
  }
  const link = `${name}-link`
  t.eqI32("plant a symbolic link", spawnSync(["ln", "-s", `/dev/shm/${loose}`, `/dev/shm/${link}`]), 0)
  const followed = openRegion(link)
  if (followed.isErr()) {
    t.eqI32("a symbolic link is not followed (ELOOP)", followed.error.code, 40)
  } else {
    t.fail("a symbolic link is not followed (ELOOP)", "it opened")
  }
  const empty = `${name}-empty`
  t.eqI32("plant an empty object", spawnSync(["touch", `/dev/shm/${empty}`]), 0)
  t.eqI32("chmod it 0600", spawnSync(["chmod", "0600", `/dev/shm/${empty}`]), 0)
  const hollow = openRegion(empty)
  if (hollow.isErr()) {
    t.eqI32("an empty object is SHM_INVALID", hollow.error.code, SHM_INVALID)
  } else {
    t.fail("an empty object is SHM_INVALID", "it opened")
  }
  const ours = `${name}-ours`
  const twin = `${name}-twin`
  createRegion(ours, BYTES).expect("make a region to link").close().expect("close it")
  t.eqI32("link it under a second name", spawnSync(["ln", `/dev/shm/${ours}`, `/dev/shm/${twin}`]), 0)
  const linked = openRegion(twin)
  if (linked.isErr()) {
    t.eqI32("a region with a second link is SHM_ACCESS", linked.error.code, SHM_ACCESS)
  } else {
    t.fail("a region with a second link is SHM_ACCESS", "it opened")
  }
  const fifo = `${name}-fifo`
  t.eqI32("plant a FIFO", spawnSync(["mkfifo", "-m", "0600", `/dev/shm/${fifo}`]), 0)
  const piped = openRegion(fifo)
  if (piped.isErr()) {
    t.eqI32("a FIFO is SHM_ACCESS", piped.error.code, SHM_ACCESS)
  } else {
    t.fail("a FIFO is SHM_ACCESS", "it opened")
  }
  let gone: boolean = true
  for (const n of [loose, link, empty, ours, twin, fifo]) {
    gone = unlinkRegion(n).isOk() && gone
  }
  t.ok("unlink what was planted", gone)
}

/** One process: everything a single mapping can show. */
const alone = (t: Suite, name: string, region: SharedRegion): void => {
  t.eqI32("a fresh region has the size asked for", region.size(), BYTES)
  t.eqI64("and is zeroed", region.loadI64(56, ACQUIRE), toI64(0))
  const again = createRegion(name, BYTES)
  if (again.isErr()) {
    t.eqI32("a name that exists is SHM_EXISTS", again.error.code, SHM_EXISTS)
  } else {
    t.fail("a name that exists is SHM_EXISTS", "it was made again")
  }
  const bad = createRegion("a/b", BYTES)
  if (bad.isErr()) {
    t.eqI32("a name with a slash is SHM_INVALID", bad.error.code, SHM_INVALID)
  } else {
    t.fail("a name with a slash is SHM_INVALID", "it was made")
  }
  const missing = openRegion("nish-test-shm-none")
  if (missing.isErr()) {
    t.eqI32("a name nobody made is SHM_NOT_FOUND", missing.error.code, SHM_NOT_FOUND)
  } else {
    t.fail("a name nobody made is SHM_NOT_FOUND", "it opened")
  }

  // A second mapping of the same name sees the first one's stores.
  const view = openRegion(name).expect("open the name again")
  region.storeI32(40, 7, RELEASE)
  t.eqI32("a second mapping sees a store", view.loadI32(40, ACQUIRE), 7)
  t.eqI32("add answers the old value", view.addI32(40, 5, ACQ_REL), 7)
  t.eqI32("exchange answers the old value", region.exchangeI32(40, 100, SEQ_CST), 12)
  t.eqI32("a compare-exchange that fails answers the value", region.compareExchangeI32(40, 99, 1, SEQ_CST), 100)
  t.eqI32("... and stores nothing", view.loadI32(40, RELAXED), 100)
  t.eqI32("one that succeeds answers the expected value", region.compareExchangeI32(40, 100, 1, SEQ_CST), 100)
  t.eqI32("... and stores", view.loadI32(40, RELAXED), 1)
  region.storeI32(44, -1, RELAXED)
  t.eqI32("a negative i32 round-trips", view.loadI32(44, SEQ_CST), -1)
  t.eqI32("the slot beside it is untouched", view.loadI32(40, SEQ_CST), 1)

  const big: i64 = toI64(0x7fffffff) * toI64(4)
  region.storeI64(48, big, SEQ_CST)
  t.eqI64("an i64 past 32 bits round-trips", view.loadI64(48, ACQUIRE), big)
  t.eqI64("addI64 answers the old value", view.addI64(48, toI64(-1), RELAXED), big)
  t.eqI64("exchangeI64 answers the old value", region.exchangeI64(48, toI64(9), ACQ_REL), big - toI64(1))
  t.eqI64("compareExchangeI64 fails on a stale value", region.compareExchangeI64(48, big, toI64(1), SEQ_CST), toI64(9))
  t.eqI64("and succeeds on the current one", region.compareExchangeI64(48, toI64(9), toI64(10), SEQ_CST), toI64(9))
  t.eqI64("which it stored", view.loadI64(48, RELAXED), toI64(10))
  fence(SEQ_CST)

  // Byte windows, at an offset into the buffer as well as the region.
  const src: u8[] = [1, 2, 3, 4, 5, 6, 7]
  region.write(BYTES - 5, src, 2, 5)
  const dst: u8[] = new Array<u8>(8)
  view.read(BYTES - 5, dst, 3, 5)
  const parts: string[] = []
  for (const b of dst) {
    parts.push(`${b}`)
  }
  t.eqStr("a byte window round-trips", parts.join(","), "0,0,0,3,4,5,6,7")
  view.read(0, dst, 0, 0)
  t.eqI32("an empty window copies nothing", toI32(dst[3]), 3)

  // Waiting without a waker: a slot that does not hold the value answers at
  // once, and one that does sleeps out its timeout.
  const exp: i32 = platform === "linux" ? SHM_NOT_EQUAL : SHM_UNSUPPORTED
  t.eqI32("waitI32 on a slot that moved answers at once", region.waitI32(40, 5, 1000), exp)
  const start: i64 = monotonicNanos()
  const rc: i32 = region.waitI32(BELL_AT, 0, 30)
  if (platform === "linux") {
    t.eqI32("waitI32 times out", rc, SHM_TIMED_OUT)
    t.ok("after its timeout", monotonicNanos() - start >= toI64(29000000))
    t.eqI32("a wake with nobody asleep wakes nobody", region.wake(BELL_AT, 1), 0)
  } else {
    t.eqI32("waitI32 is refused here", rc, SHM_UNSUPPORTED)
    t.eqI32("and so is wake", region.wake(BELL_AT, 1), SHM_UNSUPPORTED)
  }
  t.ok("closing the second mapping", view.close().isOk())
  t.eqI32("leaves the first", region.loadI32(40, RELAXED), 1)
  region.storeI32(40, 0, RELAXED)
  region.storeI64(48, toI64(0), RELAXED)
}

/** Two processes adding to one slot, and a child's store seen by the driver. */
const together = (t: Suite, name: string, region: SharedRegion): void => {
  const pid: i32 = spawn([process.argv[0], "child", name, "add"])
  if (!t.ok("the child starts", pid > 0)) {
    return
  }
  for (let i = 0; i < ADDS; i++) {
    region.addI32(COUNT_AT, 1, RELAXED)
  }
  const st = waitPid(pid, 0)
  t.eqI32("the child exits 0", st[1], 0)
  t.eqI32("no increment is lost", region.loadI32(COUNT_AT, SEQ_CST), 2 * ADDS)
  t.eqI64("the child's i64 store is seen", region.loadI64(WORD_AT, ACQUIRE), WORD)
}

/** A child asleep on a slot, woken by this process. */
const woken = (t: Suite, name: string, region: SharedRegion): void => {
  if (platform !== "linux") {
    t.skip("a sleeping child is woken", "futexes are Linux's")
    return
  }
  const pid: i32 = spawn([process.argv[0], "child", name, "sleep"])
  if (!t.ok("the sleeper starts", pid > 0)) {
    return
  }
  const start: i64 = monotonicNanos()
  while (region.loadI32(BELL_AT + 4, SEQ_CST) === 0 && monotonicNanos() - start < FIVE_SECONDS) {}
  let woke = 0
  // The child may not be asleep yet when its flag is seen: wake until it is.
  for (let i = 0; i < 500 && woke === 0; i++) {
    region.storeI32(BELL_AT, 0, SEQ_CST)
    woke = region.wake(BELL_AT, 1)
    if (woke === 0) {
      region.waitI32(BELL_AT + 8, 0, 2)
    }
  }
  t.eqI32("wake wakes the sleeper", woke, 1)
  const st = waitPid(pid, 0)
  t.eqI32("which exits 0, long before its timeout", st[1], 0)
  t.ok("in under five seconds", monotonicNanos() - start < FIVE_SECONDS)
}

/** A child that panics on `what`, and the message it gives. */
const panics = (t: Suite, name: string, what: string, needle: string): void => {
  const err: string = `build/sync-shm-${what}.err`
  const rc: i32 = spawnSyncTo([process.argv[0], "child", name, what], "", err)
  t.eqI32(`${what}: the child exits 1`, rc, 1)
  const text: string | null = readFileSyncOrNull(err)
  t.contains(`${what}: and says why`, text === null ? "" : text, needle)
}

export const main = (): i32 => {
  if (process.argv.length > 3 && process.argv[1] === "child") {
    return child(process.argv[2], process.argv[3])
  }
  const t = new Suite("nish/sync/shm")
  const name: string = `nish-test-shm-${monotonicNanos() % toI64(1000000000)}`
  const made = createRegion(name, BYTES)
  if (made.isErr()) {
    t.fail("create a region", made.error.message)
    return t.done()
  }
  const region = made.value
  alone(t, name, region)
  together(t, name, region)
  woken(t, name, region)
  planted(t, name)
  const at = "nish/sync/shm: slot offset"
  panics(t, name, "past-end", `${at} 64 is outside the region of 64 bytes`)
  panics(t, name, "negative", `${at} -8 is outside the region of 64 bytes`)
  panics(t, name, "misaligned", `${at} 4 is not a multiple of 8, the slot's width`)
  panics(t, name, "load-release", "ordering 3 cannot order a load")
  panics(t, name, "store-acquire", "ordering 2 cannot order a store")
  panics(t, name, "no-order", "ordering 7 is not an ordering")
  panics(t, name, "closed", "names no open region")
  panics(t, name, "window", "byte window at 63 is outside the region of 64 bytes")
  panics(t, name, "buffer", "buffer window at 1 is outside the buffer of 1 bytes")
  t.ok("unlink the region", unlinkRegion(name).isOk())
  const gone = unlinkRegion(name)
  t.ok("a second unlink is SHM_NOT_FOUND", gone.isErr() && gone.error.code === SHM_NOT_FOUND)
  t.ok("the mapping outlives the name", region.close().isOk())
  return t.done()
}
