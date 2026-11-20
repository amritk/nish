// Ported to Nish from Goose (https://github.com/aardappel/goose). Licensed
// under the Apache License, Version 2.0; see bench/goose/LICENSE.
// Upstream file: bench/goose/tree.goose, at commit 3a0aa2e.
//
// A pointer-linked binary tree, the shape of every AST and index structure:
// built once from a xorshift64 stream, then summed eight times with the pass
// index folded into each node so no pass can be hoisted. A node is a class
// with two nullable links; every node outlives `build`, so they all come from
// `main`'s scope and are given back in one release when it returns.
//
// The compact rule (docs/guide/language/compact-classes.md) picks `TNode`:
// it is native, holds links, is made in recursion, and its links as 32-bit
// offsets take it from 24 bytes to 12. `--explain-layout` prints that verdict.
// At n = 24 that halves peak RSS (788 MB to 395 MB) and cuts wall time by a
// third against `--compact off`; the run is in docs/wp48-ref32-classes.md,
// section 5.6. Nothing here asks for it: the program is written as before.

const DEPTH: i32 = 20 // bench:n
const PASSES: i64 = 8

class TNode {
  v: i32
  l: TNode | null
  r: TNode | null
  constructor(v: i32, l: TNode | null, r: TNode | null) {
    this.v = v
    this.l = l
    this.r = r
  }
}

/** xorshift64, matching Goose's `rng.goose` and the C++ `bench.h`. */
const xsNext = (x: u64): u64 => {
  let v = x
  v ^= v << 13
  v ^= v >> 7
  v ^= v << 17
  return v
}

const build = (depth: i32, seed: u64): TNode => {
  const v = toI32(seed % 1000)
  if (depth === 0) {
    return new TNode(v, null, null)
  }
  const l = build(depth - 1, xsNext(seed))
  const r = build(depth - 1, xsNext(seed + 1))
  return new TNode(v, l, r)
}

const sumTree = (n: TNode, p: i64): i64 => {
  let t: i64 = toI64(n.v) ^ p
  const l = n.l
  if (l !== null) {
    t += sumTree(l, p)
  }
  const r = n.r
  if (r !== null) {
    t += sumTree(r, p)
  }
  return t
}

export const main = (): i32 => {
  const root = build(DEPTH, 12345)
  let total: i64 = 0
  for (let p: i64 = 0; p < PASSES; p++) {
    total += sumTree(root, p)
  }
  // Goose prints its pool's length: a complete tree's node count.
  console.log(`${(1 << (DEPTH + 1)) - 1}`)
  console.log(`${total}`)
  return 0
}
