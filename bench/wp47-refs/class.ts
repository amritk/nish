// WP47's pointer graph: an AST-shaped tree of class objects linked by
// references, the layout a straight port of a TypeScript compiler's `Node`
// gets. Every link is an 8-byte pointer into the arena: `parent`, `kids` (a
// pointer to an array header) and each slot of `kids`.
//
// The tree is built depth first from a fixed seed: each node below `depth` has
// 2 to 6 children until `count` nodes exist. Then `rounds` recursive visits
// fold every node's kind, and `rounds` parent walks climb from every leaf to
// the root. `pool.ts` builds the same tree in the same order as records in
// arrays addressed by `i32`, and prints the same checksum.
//
//   build/nish bench/wp47-refs/class.ts --link build/wp47/class
//   build/wp47/class <count> <rounds>
//
// stdout is the checksum alone, so a run under Node prints the same line;
// the timings (nanoseconds) and the arena's offset go to stderr.
import { wrappingAdd, wrappingMul } from "nish:unsafe"

class Node {
  kind: i32
  pos: i32
  parent: Node | null
  kids: Node[]
  constructor(kind: i32, pos: i32, parent: Node | null) {
    this.kind = kind
    this.pos = pos
    this.parent = parent
    this.kids = []
  }
}

class Builder {
  seed: i32 = 0x2545f491
  made: i32 = 0
  count: i32
  depth: i32
  constructor(count: i32, depth: i32) {
    this.count = count
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

  /** `n`'s subtree, children first in, depth first, while the budget lasts. */
  grow(n: Node, level: i32): void {
    if (level >= this.depth) {
      return
    }
    const k: i32 = 2 + (this.next() % 5)
    for (let c: i32 = 0; c < k && this.made < this.count; c++) {
      const kid: Node = new Node(this.next() % 200, this.made, n)
      this.made = this.made + 1
      n.kids.push(kid)
    }
    for (const kid of n.kids) {
      this.grow(kid, level + 1)
    }
  }
}

const visit = (n: Node, level: i32, round: i32): i32 => {
  let s: i32 = (n.kind ^ round) * (level + 1)
  for (const kid of n.kids) {
    s = wrappingAdd(s, visit(kid, level + 1, round))
  }
  return s
}

/** From every leaf under `n`, climb the parent links to the root. */
const climb = (n: Node, round: i32): i32 => {
  if (n.kids.length === 0) {
    let s: i32 = 0
    let at: Node | null = n
    while (at !== null) {
      s = wrappingAdd(s, at.kind ^ round)
      at = at.parent
    }
    return s
  }
  let s: i32 = 0
  for (const kid of n.kids) {
    s = wrappingAdd(s, climb(kid, round))
  }
  return s
}

export const main = (): i32 => {
  const count: i32 = process.argv.length > 1 ? toI32(Number(process.argv[1])) : 1000000
  const rounds: i32 = process.argv.length > 2 ? toI32(Number(process.argv[2])) : 4
  const t0: i64 = monotonicNanos()
  const b: Builder = new Builder(count, 16)
  const root: Node = new Node(0, 0, null)
  b.made = 1
  b.grow(root, 0)
  const t1: i64 = monotonicNanos()
  let sum: i32 = toI32(b.made)
  for (let r: i32 = 0; r < rounds; r++) {
    sum = wrappingAdd(wrappingMul(sum, 31), visit(root, 0, r))
  }
  const t2: i64 = monotonicNanos()
  for (let r: i32 = 0; r < rounds; r++) {
    sum = wrappingAdd(wrappingMul(sum, 31), climb(root, r))
  }
  const t3: i64 = monotonicNanos()
  console.log(`nodes ${b.made} checksum ${sum}`)
  console.error(`build ${t1 - t0} visit ${t2 - t1} climb ${t3 - t2} used ${Arena.used()}`)
  return 0
}
