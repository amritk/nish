// WP47's handle graph: the tree `class.ts` builds, in the same order, as
// records in arrays addressed by `i32`. A node is an index into `nodes`, a
// contiguous array of `Rec`; its children are `count` consecutive indices in
// `kids` from `first`, and its parent is an index too, -1 at the root. Every
// link is four bytes, and nothing but the two arrays is allocated.
//
// An index stored by the builder is in range by construction, so the walks
// read `kids` with `uncheckedGet`; `nodes[i]` keeps its bounds check, because
// `uncheckedGet` takes only arrays of numbers.
//
//   build/nish bench/wp47-refs/pool.ts --link build/wp47/pool
//   build/wp47/pool <count> <rounds>
//
// stdout is the checksum alone, so a run under Node prints the same line;
// the timings (nanoseconds) and the arena's offset go to stderr.
import { uncheckedGet, wrappingAdd, wrappingMul } from "nish:unsafe"

interface Rec {
  kind: i32
  pos: i32
  parent: i32
  first: i32
  count: i32
}

class Tree {
  nodes: Rec[]
  kids: i32[]
  seed: i32 = 0x2545f491
  limit: i32
  depth: i32
  constructor(limit: i32, depth: i32) {
    this.nodes = []
    this.kids = []
    this.limit = limit
    this.depth = depth
  }

  next(): i32 {
    let x: i32 = this.seed
    x = x ^ (x << 13)
    x = x ^ (x >>> 17)
    x = x ^ (x << 5)
    this.seed = x
    return x >>> 1
  }

  add(kind: i32, parent: i32): i32 {
    const id: i32 = toI32(this.nodes.length)
    const r: Rec = { kind: kind, pos: id, parent: parent, first: 0, count: 0 }
    this.nodes.push(r)
    return id
  }

  /** `n`'s subtree, children first in, depth first, while the budget lasts. */
  grow(n: i32, level: i32): void {
    if (level >= this.depth) {
      return
    }
    const k: i32 = 2 + (this.next() % 5)
    const first: i32 = toI32(this.kids.length)
    let made: i32 = 0
    for (let c: i32 = 0; c < k && toI32(this.nodes.length) < this.limit; c++) {
      this.kids.push(this.add(this.next() % 200, n))
      made = made + 1
    }
    this.nodes[n].first = first
    this.nodes[n].count = made
    for (let c: i32 = 0; c < made; c++) {
      this.grow(uncheckedGet(this.kids, first + c), level + 1)
    }
  }
}

const visit = (t: Tree, n: i32, level: i32, round: i32): i32 => {
  const r: Rec = t.nodes[n]
  let s: i32 = (r.kind ^ round) * (level + 1)
  const end: i32 = r.first + r.count
  for (let c: i32 = r.first; c < end; c++) {
    s = wrappingAdd(s, visit(t, uncheckedGet(t.kids, c), level + 1, round))
  }
  return s
}

/** From every leaf under `n`, climb the parent links to the root. */
const climb = (t: Tree, n: i32, round: i32): i32 => {
  const r: Rec = t.nodes[n]
  if (r.count === 0) {
    let s: i32 = 0
    let at: i32 = n
    while (at >= 0) {
      const p: Rec = t.nodes[at]
      s = wrappingAdd(s, (p.kind ^ round))
      at = p.parent
    }
    return s
  }
  let s: i32 = 0
  const end: i32 = r.first + r.count
  for (let c: i32 = r.first; c < end; c++) {
    s = wrappingAdd(s, climb(t, uncheckedGet(t.kids, c), round))
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
  let sum: i32 = toI32(t.nodes.length)
  for (let r: i32 = 0; r < rounds; r++) {
    sum = wrappingAdd(wrappingMul(sum, 31), visit(t, root, 0, r))
  }
  const t2: i64 = monotonicNanos()
  for (let r: i32 = 0; r < rounds; r++) {
    sum = wrappingAdd(wrappingMul(sum, 31), climb(t, root, r))
  }
  const t3: i64 = monotonicNanos()
  console.log(`nodes ${t.nodes.length} checksum ${sum}`)
  console.error(`build ${t1 - t0} visit ${t2 - t1} climb ${t3 - t2} used ${Arena.used()}`)
  return 0
}
