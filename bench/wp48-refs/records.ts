// WP48's lean handle graph, one record a node: `sibling.ts`'s links as `i32`
// indices in a contiguous array of `Rec`, so a node's five fields share a
// cache line as `sibling.ts`'s do, at 20 bytes rather than 32. This is the
// layout a whole-program 32-bit reference mode would give `sibling.ts`.
// `columns.ts` holds the same fields one column each.
//
// A record array cannot be allocated at its final length (`new Array<Rec>(n)`
// is refused: it would fill with null), so it is grown by `push`, and every
// block a doubling leaves behind stays in the arena until the program exits.
// `nodes[i]` keeps its bounds check: `uncheckedGet` takes arrays of numbers.
//
//   build/nish bench/wp48-refs/records.ts --link build/wp48/records
//   build/wp48/records <count> <rounds>
//
// stdout is the checksum alone, so a run under Node prints the same line;
// the timings (nanoseconds) and the arena's offset go to stderr.
import { wrappingAdd, wrappingMul } from "nish:unsafe"

interface Rec {
  kind: i32
  pos: i32
  parent: i32
  first: i32
  next: i32
}

class Tree {
  nodes: Rec[]
  seed: i32 = 0x2545f491
  count: i32
  depth: i32
  constructor(count: i32, depth: i32) {
    this.nodes = []
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
    const id: i32 = toI32(this.nodes.length)
    const r: Rec = { kind: kind, pos: id, parent: parent, first: -1, next: -1 }
    this.nodes.push(r)
    return id
  }

  /** `n`'s subtree, children first in, depth first, while the budget lasts. */
  grow(n: i32, level: i32): void {
    if (level >= this.depth) {
      return
    }
    const k: i32 = 2 + (this.rand() % 5)
    let last: i32 = -1
    for (let c: i32 = 0; c < k && toI32(this.nodes.length) < this.count; c++) {
      const kid: i32 = this.add(this.rand() % 200, n)
      if (last < 0) {
        this.nodes[n].first = kid
      } else {
        this.nodes[last].next = kid
      }
      last = kid
    }
    let kid: i32 = this.nodes[n].first
    while (kid >= 0) {
      this.grow(kid, level + 1)
      kid = this.nodes[kid].next
    }
  }
}

const visit = (t: Tree, n: i32, level: i32, round: i32): i32 => {
  const r: Rec = t.nodes[n]
  let s: i32 = (r.kind ^ round) * (level + 1)
  let kid: i32 = r.first
  while (kid >= 0) {
    s = wrappingAdd(s, visit(t, kid, level + 1, round))
    kid = t.nodes[kid].next
  }
  return s
}

/** From every leaf under `n`, climb the parent links to the root. */
const climb = (t: Tree, n: i32, round: i32): i32 => {
  let kid: i32 = t.nodes[n].first
  if (kid < 0) {
    let s: i32 = 0
    let at: i32 = n
    while (at >= 0) {
      const p: Rec = t.nodes[at]
      s = wrappingAdd(s, p.kind ^ round)
      at = p.parent
    }
    return s
  }
  let s: i32 = 0
  while (kid >= 0) {
    s = wrappingAdd(s, climb(t, kid, round))
    kid = t.nodes[kid].next
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
