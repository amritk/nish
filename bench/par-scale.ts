// A memory-bound map: `x * k` over 2^22 elements, called 40 times, each call's
// checksum fed into the next call's input. Each element costs one multiply,
// so the map is limited by memory bandwidth rather than the cores, and the
// speedup it can reach is lower than par-heavy's. The fold is order-sensitive
// and runs on one thread. `par-scale seq` runs the loop, `par-scale par` runs
// `parallelMap`, and both print the same checksum.
import { parallelMap } from "nish/threads"

const fold = (ys: i32[]): i32 => {
  let f: i32 = 0
  for (let i: i32 = 0; i < toI32(ys.length); i++) {
    f = (f * 31 + (ys[i] & 65535)) & 16777215
  }
  return f
}

const onceSeq = (xs: i32[], k: i32): i32 => {
  const ys = new Array<i32>(xs.length)
  for (let i: i32 = 0; i < toI32(xs.length); i++) {
    const y = xs[i] * k
    if (i < toI32(ys.length)) {
      ys[i] = y
    }
  }
  return fold(ys)
}

const oncePar = (xs: i32[], k: i32): i32 => {
  const ys = parallelMap(xs, (x: i32): i32 => x * k)
  return fold(ys)
}

export const main = (): i32 => {
  const par = process.argv.length > 1 && process.argv[1] === "par"
  const calls: i32 = 40
  const n: i32 = 4194304 // bench:n
  const xs = new Array<i32>(n)
  for (let i: i32 = 0; i < toI32(xs.length); i++) {
    xs[i] = i & 65535
  }
  let check: i32 = 0
  for (let c: i32 = 0; c < calls; c++) {
    const k: i32 = c * 7 + 3
    check = ((check & 16777215) * 17 + (par ? oncePar(xs, k) : onceSeq(xs, k))) & 16777215
    if (c < toI32(xs.length)) {
      xs[c] = check & 65535
    }
  }
  console.log(`${check}`)
  return 0
}
