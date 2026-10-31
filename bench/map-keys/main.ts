// Map lookups by integer and enum key: `set`, `get` and `has` on a
// `Map<i32, i32>`, a `Map<i64, i32>` keyed by two packed `i32`s, and a
// `Map<Op, i32>` over a 16-member enum. Each row times `rounds` passes, each
// pass fed by the last one's checksum so no pass can be computed once, and
// prints `<row> <ns> <ops> <checksum>`; run.mjs builds it with each compiler
// it is given and reports the medians.
//
//   main [rounds]

import { monotonicNanos } from "nish:process"
import { wrappingAdd, wrappingMul } from "nish:unsafe"

enum Op {
  Add = 0,
  Sub = 1,
  Mul = 2,
  Div = 3,
  Mod = 4,
  And = 5,
  Or = 6,
  Xor = 7,
  Shl = 8,
  Shr = 9,
  Eq = 10,
  Ne = 11,
  Lt = 12,
  Le = 13,
  Gt = 14,
  Ge = 15,
}

/** The keys each table holds: enough to leave the L1 and L2 caches. */
const SIZE: i32 = 65536

/** The next state of a 32-bit LCG (Numerical Recipes'). */
const step = (x: i32): i32 => wrappingAdd(wrappingMul(x, 1664525), 1013904223)

/** Two `i32`s as one `i64` key, every operand an `i64` (docs/guide/language/maps-and-sets.md). */
const pack = (hi: i32, lo: i32): i64 => (toI64(hi) << toI64(32)) + toI64(lo)

/**
 * One pass over a `Map<i32, i32>`: fill it with `SIZE` keys spread by a
 * multiply, overwrite each once, then look up `SIZE` keys of which half are
 * present (`get`) and `SIZE` of which half are present (`has`).
 */
const passI32 = (seed: i32): i32 => {
  const m = new Map<i32, i32>()
  for (let i: i32 = 0; i < SIZE; i++) {
    m.set(wrappingMul(i, 7919), i)
  }
  for (let i: i32 = 0; i < SIZE; i++) {
    const k = wrappingMul(i, 7919)
    m.set(k, (m.get(k) ?? 0) + seed)
  }
  let sum: i32 = 0
  let x = seed
  for (let i: i32 = 0; i < SIZE; i++) {
    x = step(x)
    sum = wrappingAdd(sum, m.get(wrappingMul((x >>> 8) & (2 * SIZE - 1), 7919)) ?? 1)
  }
  for (let i: i32 = 0; i < SIZE; i++) {
    x = step(x)
    if (m.has(wrappingMul((x >>> 8) & (2 * SIZE - 1), 7919))) {
      sum = wrappingAdd(sum, 3)
    }
  }
  return sum
}

/** `passI32`'s pass over a grid of 256 by `SIZE / 256` cells keyed by `pack`. */
const passI64 = (seed: i32): i32 => {
  const m = new Map<i64, i32>()
  const rows: i32 = SIZE / 256
  for (let y: i32 = 0; y < rows; y++) {
    for (let x: i32 = 0; x < 256; x++) {
      m.set(pack(y, x - 128), x + y)
    }
  }
  for (let y: i32 = 0; y < rows; y++) {
    for (let x: i32 = 0; x < 256; x++) {
      const k = pack(y, x - 128)
      m.set(k, (m.get(k) ?? 0) + seed)
    }
  }
  let sum: i32 = 0
  let r = seed
  for (let i: i32 = 0; i < SIZE; i++) {
    r = step(r)
    const k = pack((r >>> 16) & (2 * rows - 1), ((r >>> 8) & 255) - 128)
    sum = wrappingAdd(sum, m.get(k) ?? 1)
  }
  for (let i: i32 = 0; i < SIZE; i++) {
    r = step(r)
    if (m.has(pack((r >>> 16) & (2 * rows - 1), ((r >>> 8) & 255) - 128))) {
      sum = wrappingAdd(sum, 3)
    }
  }
  return sum
}

/** A histogram of `4 * SIZE` enum keys: one `get` and one `set` each, then a `has` each. */
const passEnum = (seed: i32): i32 => {
  const m = new Map<Op, i32>()
  const ops: Op[] = [
    Op.Add,
    Op.Sub,
    Op.Mul,
    Op.Div,
    Op.Mod,
    Op.And,
    Op.Or,
    Op.Xor,
    Op.Shl,
    Op.Shr,
    Op.Eq,
    Op.Ne,
    Op.Lt,
    Op.Le,
    Op.Gt,
    Op.Ge,
  ]
  let x = seed
  for (let i: i32 = 0; i < 4 * SIZE; i++) {
    x = step(x)
    const at = (x >>> 12) & 15
    if (at < ops.length) {
      const op = ops[at]
      m.set(op, (m.get(op) ?? seed) + 1)
    }
  }
  let sum: i32 = 0
  for (let i: i32 = 0; i < 4 * SIZE; i++) {
    x = step(x)
    const probe = (x >>> 12) & 15
    const read = (x >>> 20) & 15
    if (probe < ops.length && read < ops.length) {
      const wanted = ops[probe]
      const value = m.get(ops[read]) ?? 0
      if (m.has(wanted)) {
        sum = wrappingAdd(sum, value ^ x)
      }
    }
  }
  return sum
}

/** Times `rounds` passes of one row after two untimed ones, and prints it. */
const time = (row: string, rounds: i32, opsPerPass: i32, pass: (seed: i32) => i32): void => {
  let seed: i32 = pass(pass(1))
  const started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < rounds; i++) {
    seed = pass(seed)
  }
  const ns: i64 = monotonicNanos() - started
  console.log(`${row} ${ns} ${toI64(rounds) * toI64(opsPerPass)} ${seed}`)
}

export const main = (): i32 => {
  const rounds: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : 20
  time("i32", rounds, 5 * SIZE, passI32)
  time("i64", rounds, 5 * SIZE, passI64)
  time("enum", rounds, 12 * SIZE, passEnum)
  return 0
}
