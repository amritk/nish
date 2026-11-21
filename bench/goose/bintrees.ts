// Ported to Nish from Goose (https://github.com/aardappel/goose). Licensed
// under the Apache License, Version 2.0; see bench/goose/LICENSE.
// Upstream file: bench/goose/bintrees.goose, at commit 3a0aa2e.
//
// The Benchmarks Game's binary-trees in the shape the Goose suite times it:
// many short-lived complete binary trees, each built, checked and dropped,
// with one long-lived tree kept across the run. A node is a class with two
// nullable links; each tree is built inside `treeCheck`, whose automatic
// arena scope gives the whole tree back when it returns.
//
// The compact rule leaves `TNode` wide: 16 bytes would become 8, and the rule
// counts a saving only on a class of at least 24 bytes. That floor comes from
// this program: compacted under an earlier rule, `TNode` ran 18.8% slower at
// depth 19, since each tree is freed before the next and its nodes are
// already four to a cache line (docs/wp48-ref32-classes.md, section 5.5).
// So do not add `implements Compact` here.

class TNode {
  l: TNode | null
  r: TNode | null
  constructor(l: TNode | null, r: TNode | null) {
    this.l = l
    this.r = r
  }
}

const MINDEPTH: i32 = 4

const make = (depth: i32): TNode => {
  if (depth === 0) {
    return new TNode(null, null)
  }
  const l = make(depth - 1)
  const r = make(depth - 1)
  return new TNode(l, r)
}

/** The node count: a leaf counts 1. */
const check = (n: TNode): i32 => {
  const l = n.l
  const r = n.r
  if (l === null || r === null) {
    return 1
  }
  return 1 + check(l) + check(r)
}

/** Build, check, drop. */
const treeCheck = (depth: i32): i32 => check(make(depth))

export const main = (): i32 => {
  const MAXDEPTH: i32 = 17 // bench:n
  console.log(`${treeCheck(MAXDEPTH + 1)}`)
  const lroot = make(MAXDEPTH)
  for (let d = MINDEPTH; d <= MAXDEPTH; d += 2) {
    const iters: i32 = 1 << (MAXDEPTH - d + MINDEPTH)
    let sum: i32 = 0
    for (let i: i32 = 0; i < iters; i++) {
      sum += treeCheck(d)
    }
    console.log(`${iters}`)
    console.log(`${d}`)
    console.log(`${sum}`)
  }
  console.log(`${check(lroot)}`)
  return 0
}
