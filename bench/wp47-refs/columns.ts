// WP47's lean handle graph: `sibling.ts`'s links as `i32` indices, one
// column per field, every column allocated once at its final length. A node
// is an index; parent, first child and next sibling are indices, -1 for none.
// That is 20 bytes a node against `sibling.ts`'s 32, and it is the closest a
// Nish program comes today to what a compressed 32-bit reference would store.
//
// Every index is in range by construction (each is below `made`, and `made`
// stays below `count`, the columns' length), so every access is
// `uncheckedGet` / `uncheckedSet`.
//
//   build/nish bench/wp47-refs/columns.ts --link build/wp47/columns
//   build/wp47/columns <count> <rounds>
//
// stdout is the checksum alone, so a run under Node prints the same line;
// the timings (nanoseconds) and the arena's offset go to stderr.
import { uncheckedGet, uncheckedSet, wrappingAdd, wrappingMul } from "nish:unsafe"

class Tree {
  kind: i32[]
  pos: i32[]
  parent: i32[]
  first: i32[]
  next: i32[]
  seed: i32 = 0x2545f491
  made: i32 = 0
  count: i32
  depth: i32
  constructor(count: i32, depth: i32) {
    this.kind = new Array<i32>(count)
    this.pos = new Array<i32>(count)
    this.parent = new Array<i32>(count)
    this.first = new Array<i32>(count)
    this.next = new Array<i32>(count)
    this.count = count
    this.depth = depth
  }

  rand(): i32 {
    let x: i32 = this.seed
    x = x ^ (x << 13)
    x = x ^ (x >>> 17)
    x = x ^ (x << 5)
    this.seed = x
    return x >>> 1
  }

  add(kind: i32, parent: i32): i32 {
    const id: i32 = this.made
    uncheckedSet(this.kind, id, kind)
    uncheckedSet(this.pos, id, id)
    uncheckedSet(this.parent, id, parent)
    uncheckedSet(this.first, id, -1)
    uncheckedSet(this.next, id, -1)
    this.made = id + 1
    return id
  }

  /** `n`'s subtree, children first in, depth first, while the budget lasts. */
  grow(n: i32, level: i32): void {
    if (level >= this.depth) {
      return
    }
    const k: i32 = 2 + (this.rand() % 5)
    let last: i32 = -1
    for (let c: i32 = 0; c < k && this.made < this.count; c++) {
      const kid: i32 = this.add(this.rand() % 200, n)
      if (last < 0) {
        uncheckedSet(this.first, n, kid)
      } else {
        uncheckedSet(this.next, last, kid)
      }
      last = kid
    }
    let kid: i32 = uncheckedGet(this.first, n)
    while (kid >= 0) {
      this.grow(kid, level + 1)
      kid = uncheckedGet(this.next, kid)
    }
  }
}

const visit = (t: Tree, n: i32, level: i32, round: i32): i32 => {
  let s: i32 = (uncheckedGet(t.kind, n) ^ round) * (level + 1)
  let kid: i32 = uncheckedGet(t.first, n)
  while (kid >= 0) {
    s = wrappingAdd(s, visit(t, kid, level + 1, round))
    kid = uncheckedGet(t.next, kid)
  }
  return s
}

/** From every leaf under `n`, climb the parent links to the root. */
const climb = (t: Tree, n: i32, round: i32): i32 => {
  let kid: i32 = uncheckedGet(t.first, n)
  if (kid < 0) {
    let s: i32 = 0
    let at: i32 = n
    while (at >= 0) {
      s = wrappingAdd(s, (uncheckedGet(t.kind, at) ^ round))
      at = uncheckedGet(t.parent, at)
    }
    return s
  }
  let s: i32 = 0
  while (kid >= 0) {
    s = wrappingAdd(s, climb(t, kid, round))
    kid = uncheckedGet(t.next, kid)
  }
  return s
}

export const main = (): i32 => {
  const count: i32 = process.argv.length > 1 ? toI32(Number(process.argv[1])) : 1000000
  const rounds: i32 = process.argv.length > 2 ? toI32(Number(process.argv[2])) : 4
  const t0: i64 = monotonicNanos()
  const t: Tree = new Tree(count, 16)
  const root: i32 = t.add(0, -1)
  t.grow(root, 0)
  const t1: i64 = monotonicNanos()
  let sum: i32 = toI32(t.made)
  for (let r: i32 = 0; r < rounds; r++) {
    sum = wrappingAdd(wrappingMul(sum, 31), visit(t, root, 0, r))
  }
  const t2: i64 = monotonicNanos()
  for (let r: i32 = 0; r < rounds; r++) {
    sum = wrappingAdd(wrappingMul(sum, 31), climb(t, root, r))
  }
  const t3: i64 = monotonicNanos()
  console.log(`nodes ${t.made} checksum ${sum}`)
  console.error(`build ${t1 - t0} visit ${t2 - t1} climb ${t3 - t2} used ${Arena.used()}`)
  return 0
}
