// `SharedRegion.lend` and `giveBack` end to end. With no arguments this program
// is the driver; it runs itself again (`child <name> <what>`) for a second
// process and for each panic:
//
//   1. a window is the region's bytes, not a copy: what `copyBytes` writes into
//      it another process reads, and what a second mapping writes it sees;
//   2. `giveBack` answers the length and empties the window, and a window
//      given back lends again as `reuse`;
//   3. every misuse is a checked panic that names it, in a child of its own:
//      an index after `giveBack`, an index after `close`, a `push` then
//      `giveBack`, a range outside the region, a second `giveBack`, and a
//      `reuse` of a window still lent;
//   4. a loop bound `i < w.length` proves nothing past a `giveBack` or a
//      `close` inside the loop: both empty `w`, so the next index panics.
//      This fails if the compiler took either call to leave `w`'s length or
//      data as they were (`markShmWindow`, `resizesArray`).
import { readFileSyncOrNull } from "nish:fs"
import { monotonicNanos, spawnSync, spawnSyncTo } from "nish:process"
import { copyBytes } from "nish/bytes"
import { createRegion, openRegion, SharedRegion, unlinkRegion } from "nish/sync/shm"
import { Suite } from "nish/testing"

const BYTES: i32 = 64
const AT: i32 = 8
const LEN: i32 = 16

/** A child's work, by `what`; its exit status is the answer. */
const child = (name: string, what: string): i32 => {
  const region = openRegion(name).expect("the child opens the region")
  if (what === "read") {
    // The driver wrote 10..15 through its window at AT + 2.
    const got: u8[] = new Array<u8>(6)
    region.read(AT + 2, got, 0, 6)
    let want: i32 = 10
    for (const b of got) {
      if (toI32(b) !== want) {
        return 2
      }
      want = want + 1
    }
    return 0
  }
  const w: u8[] = region.lend(AT, LEN)
  if (what === "given-back") {
    region.giveBack(w)
    console.log(`${w[0]}`)
  } else if (what === "closed") {
    region.close().expect("close")
    console.log(`${w[0]}`)
  } else if (what === "pushed") {
    w.push(1)
    region.giveBack(w)
  } else if (what === "outside") {
    region.lend(BYTES - 4, 8)
  } else if (what === "twice") {
    region.giveBack(w)
    region.giveBack(w)
  } else if (what === "reuse-lent") {
    region.lend(0, 4, w)
  } else if (what === "loop-given-back" || what === "loop-closed") {
    let sum: i32 = 0
    for (let i: i32 = 0; i < w.length; i++) {
      if (i === 2) {
        if (what === "loop-given-back") {
          region.giveBack(w)
        } else {
          region.close().expect("close")
        }
      }
      sum = sum + toI32(w[i])
    }
    console.log(`${sum}`)
  }
  return 0 // not reached: each misuse above panics
}

/** One process, and a second one reading what a window wrote. */
const windows = (t: Suite, name: string, region: SharedRegion): void => {
  const w: u8[] = region.lend(AT, LEN)
  t.eqI32("a window has the length lent", toI32(w.length), LEN)
  t.eqI32("and starts as the region's bytes, zeroed", toI32(w[LEN - 1]), 0)
  const src: u8[] = [10, 11, 12, 13, 14, 15]
  copyBytes(w, 2, src, 0, 6)
  const back: u8[] = new Array<u8>(6)
  region.read(AT + 2, back, 0, 6)
  t.eqI32("copyBytes into it writes the region", toI32(back[5]), 15)
  t.eqI32("another process reads what it wrote", spawnSync([process.argv[0], "child", name, "read"]), 0)

  const view = openRegion(name).expect("open the name again")
  const one: u8[] = [99]
  view.write(AT + LEN - 1, one, 0, 1)
  t.eqI32("it sees a second mapping's write", toI32(w[LEN - 1]), 99)
  w[0] = 7
  t.eqI32("and a second mapping sees its store", view.loadI32(AT, 0) & 255, 7)
  t.ok("close the second mapping", view.close().isOk())

  t.eqI32("giveBack answers the length", region.giveBack(w), LEN)
  t.eqI32("and empties the window", toI32(w.length), 0)
  const again: u8[] = region.lend(AT + LEN, 4, w)
  t.eqI32("a window given back lends again", toI32(again.length), 4)
  t.eqI32("in the same header", toI32(w.length), 4)
  again[3] = 5
  const four: u8[] = new Array<u8>(1)
  region.read(AT + LEN + 3, four, 0, 1)
  t.eqI32("at its new range", toI32(four[0]), 5)
  t.eqI32("an empty window lends", toI32(region.lend(BYTES, 0).length), 0)
  t.eqI32("and gives back", region.giveBack(again), 4)
}

/** A child that panics on `what`, and the message it gives. */
const panics = (t: Suite, name: string, what: string, needle: string): void => {
  const err: string = `build/sync-shm-window-${what}.err`
  const rc: i32 = spawnSyncTo([process.argv[0], "child", name, what], "", err)
  t.eqI32(`${what}: the child exits 1`, rc, 1)
  const text: string | null = readFileSyncOrNull(err)
  t.contains(`${what}: and says why`, text === null ? "" : text, needle)
}

export const main = (): i32 => {
  if (process.argv.length > 3 && process.argv[1] === "child") {
    return child(process.argv[2], process.argv[3])
  }
  const t = new Suite("nish/sync/shm windows")
  const name: string = `nish-test-shmw-${monotonicNanos() % toI64(1000000000)}`
  const made = createRegion(name, BYTES)
  if (made.isErr()) {
    t.fail("create a region", made.error.message)
    return t.done()
  }
  const region = made.value
  windows(t, name, region)
  panics(t, name, "given-back", "index out of range: 0 >= 0")
  panics(t, name, "closed", "index out of range: 0 >= 0")
  panics(t, name, "pushed", "window of length 17 is no longer the region's bytes: a push moved it")
  panics(t, name, "outside", "nish/sync/shm: byte window at 60 is outside the region of 64 bytes")
  panics(t, name, "twice", "window of length 0 is not lent by this region: it was given back")
  panics(t, name, "reuse-lent", "reuse of length 16 is not a window this region lent and was given back")
  panics(t, name, "loop-given-back", "index out of range: 2 >= 0")
  panics(t, name, "loop-closed", "index out of range: 2 >= 0")
  t.ok("unlink the region", unlinkRegion(name).isOk())
  t.ok("close the region", region.close().isOk())
  return t.done()
}
