// Map operations by integer, enum and string key, one operation per row:
// `insert` (`set` of every key into a cleared table, its capacity kept), `hit`
// (`get` of a present key) and `miss` (`get` of an absent one), at a table size
// that fits in L1, one that fits in L2 and one past L3. Probes visit the
// keys in an LCG's order. Every row prints `<row> <ns> <ops> <checksum>`;
// run.mjs builds this with each compiler it is given, and fx.rs prints the
// same integer and enum rows, with the same checksums, from Rust's `HashMap`
// under rustc's `FxHasher`.
//
//   main [scale]     2^23 times `scale` operations a row (default 1)

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

/**
 * Keys a table holds: 1 Ki fits in L1 and 64 Ki in L2; 8 Mi, half what a `Map`
 * can hold, is a table of over 128 MiB, past a server's L3.
 */
const L1: i32 = 1024
const L2: i32 = 65536
const L3: i32 = 8388608

/** The next state of a 32-bit LCG (Numerical Recipes'). */
const step = (x: i32): i32 => wrappingAdd(wrappingMul(x, 1664525), 1013904223)

/** The `i`th `i32` key: an odd multiple, so distinct keys for distinct `i`. */
const keyI32 = (i: i32): i32 => wrappingMul(i, 7919)

/** Two `i32`s as one `i64` key (docs/guide/language/maps-and-sets.md). */
const pack = (hi: i32, lo: i32): i64 => (toI64(hi) << toI64(32)) | (toI64(lo) & toI64(0xffffffff))

/** The `i`th `i64` key, a cell of a grid 1024 wide; a `miss` takes a row below it. */
const keyI64 = (i: i32, miss: boolean): i64 => pack(miss ? -1 - (i >> 10) : i >> 10, (i & 1023) - 512)

/** Prints one row: `ops` operations in `ns` nanoseconds. */
const report = (row: string, ns: i64, ops: i32, sum: i32): void => {
  console.log(`${row} ${ns} ${ops} ${sum}`)
}

/** The three rows of a `Map<i32, i32>` of `size` keys, about `total` operations each. */
const rowsI32 = (level: string, size: i32, total: i32): void => {
  const reps: i32 = total > size ? total / size : 1
  const ops: i32 = reps * size
  const mask: i32 = size - 1
  const m = new Map<i32, i32>()
  for (let i: i32 = 0; i < size; i++) {
    m.set(keyI32(i), i)
  }
  let sum: i32 = 0
  let x: i32 = 12345
  let started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    x = step(x)
    sum = wrappingAdd(sum, m.get(keyI32((x >>> 8) & mask)) ?? 0)
  }
  report(`i32-hit-${level}`, monotonicNanos() - started, ops, sum)
  sum = 0
  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    x = step(x)
    sum = wrappingAdd(sum, m.get(keyI32(((x >>> 8) & mask) + size)) ?? 1)
  }
  report(`i32-miss-${level}`, monotonicNanos() - started, ops, sum)
  started = monotonicNanos()
  for (let r: i32 = 0; r < reps; r++) {
    m.clear()
    for (let i: i32 = 0; i < size; i++) {
      m.set(keyI32(i), i ^ r)
    }
  }
  const ns: i64 = monotonicNanos() - started
  report(`i32-insert-${level}`, ns, ops, wrappingAdd(m.size, m.get(keyI32(size - 1)) ?? 0))
}

/** `rowsI32`'s rows for a `Map<i64, i32>` keyed by two packed `i32`s. */
const rowsI64 = (level: string, size: i32, total: i32): void => {
  const reps: i32 = total > size ? total / size : 1
  const ops: i32 = reps * size
  const mask: i32 = size - 1
  const m = new Map<i64, i32>()
  for (let i: i32 = 0; i < size; i++) {
    m.set(keyI64(i, false), i)
  }
  let sum: i32 = 0
  let x: i32 = 12345
  let started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    x = step(x)
    sum = wrappingAdd(sum, m.get(keyI64((x >>> 8) & mask, false)) ?? 0)
  }
  report(`i64-hit-${level}`, monotonicNanos() - started, ops, sum)
  sum = 0
  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    x = step(x)
    sum = wrappingAdd(sum, m.get(keyI64((x >>> 8) & mask, true)) ?? 1)
  }
  report(`i64-miss-${level}`, monotonicNanos() - started, ops, sum)
  started = monotonicNanos()
  for (let r: i32 = 0; r < reps; r++) {
    m.clear()
    for (let i: i32 = 0; i < size; i++) {
      m.set(keyI64(i, false), i ^ r)
    }
  }
  const ns: i64 = monotonicNanos() - started
  report(`i64-insert-${level}`, ns, ops, wrappingAdd(m.size, m.get(keyI64(size - 1, false)) ?? 0))
}

/** The rows of a `Map<Op, i32>`: `hit` on all 16 members, `miss` on a table of the first 8. */
const rowsEnum = (total: i32): void => {
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
  const all = new Map<Op, i32>()
  const half = new Map<Op, i32>()
  for (let i: i32 = 0; i < toI32(ops.length); i++) {
    const op = ops[i]
    all.set(op, i)
    if (i < 8) {
      half.set(op, i)
    }
  }
  let sum: i32 = 0
  let x: i32 = 12345
  let started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < total; i++) {
    x = step(x)
    const op = ops[toI32((x >>> 8) & 15)]
    sum = wrappingAdd(sum, all.get(op) ?? 0)
  }
  report("enum-hit-L1", monotonicNanos() - started, total, sum)
  sum = 0
  started = monotonicNanos()
  for (let i: i32 = 0; i < total; i++) {
    x = step(x)
    const op = ops[toI32((x >>> 8) & 7) + 8]
    sum = wrappingAdd(sum, half.get(op) ?? 1)
  }
  report("enum-miss-L1", monotonicNanos() - started, total, sum)
  const reps: i32 = total / 16
  started = monotonicNanos()
  for (let r: i32 = 0; r < reps; r++) {
    all.clear()
    for (let i: i32 = 0; i < toI32(ops.length); i++) {
      all.set(ops[i], i ^ r)
    }
  }
  const ns: i64 = monotonicNanos() - started
  report("enum-insert-L1", ns, reps * 16, wrappingAdd(all.size, all.get(Op.Ge) ?? 0))
}

/** `rowsI32`'s rows for a `Map<string, i32>`, its keys built before any clock starts. */
const rowsString = (level: string, size: i32, total: i32): void => {
  const reps: i32 = total > size ? total / size : 1
  const ops: i32 = reps * size
  const mask: i32 = size - 1
  const present: string[] = []
  const absent: string[] = []
  for (let i: i32 = 0; i < size; i++) {
    present.push(`key-${keyI32(i)}`)
    absent.push(`nil-${keyI32(i)}`)
  }
  const m = new Map<string, i32>()
  for (let i: i32 = 0; i < toI32(present.length); i++) {
    m.set(present[i], i)
  }
  let sum: i32 = 0
  let x: i32 = 12345
  let started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    x = step(x)
    sum = wrappingAdd(sum, m.get(present[toI32((x >>> 8) & mask)]) ?? 0)
  }
  report(`string-hit-${level}`, monotonicNanos() - started, ops, sum)
  sum = 0
  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i++) {
    x = step(x)
    sum = wrappingAdd(sum, m.get(absent[toI32((x >>> 8) & mask)]) ?? 1)
  }
  report(`string-miss-${level}`, monotonicNanos() - started, ops, sum)
  started = monotonicNanos()
  for (let r: i32 = 0; r < reps; r++) {
    m.clear()
    for (let i: i32 = 0; i < toI32(present.length); i++) {
      m.set(present[i], i ^ r)
    }
  }
  const ns: i64 = monotonicNanos() - started
  report(`string-insert-${level}`, ns, ops, wrappingAdd(m.size, m.get(present[size - 1]) ?? 0))
}

export const main = (): i32 => {
  const scale: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : 1
  const total: i32 = scale * 8388608
  rowsI32("L1", L1, total)
  rowsI64("L1", L1, total)
  rowsI32("L2", L2, total)
  rowsI64("L2", L2, total)
  rowsI32("L3+", L3, total)
  rowsI64("L3+", L3, total)
  rowsEnum(total)
  rowsString("L1", L1, total)
  rowsString("L2", L2, total)
  return 0
}
