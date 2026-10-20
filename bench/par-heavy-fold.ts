// par-heavy with a fold the compiler vectorises: each element weighted by its
// index and summed, rather than par-heavy's chain of multiplies, each waiting
// on the last. The map is the same, so the two together show how much of
// par-heavy's speedup its serial fold costs. The weights keep the fold
// order-sensitive: a map that put an element in the wrong place prints another
// checksum. `seq` and `par` as in par-heavy, and both print the same checksum.
import { parallelMap } from "nish/threads"

const work = (x: i32, k: i32): i32 => {
  let h: i32 = x
  for (let r: i32 = 0; r < 16; r++) {
    h = h ^ (h << 5)
    h = h ^ (h >> 3)
    h = h ^ (k + r)
  }
  return h
}

const fold = (ys: i32[]): i32 => {
  let w: u32 = 0
  for (let i: i32 = 0; i < toI32(ys.length); i++) {
    w = w + toU32(ys[i]) * toU32(i + 1)
  }
  return toI32(w & 16777215)
}

const onceSeq = (xs: i32[], k: i32): i32 => {
  const ys = new Array<i32>(xs.length)
  for (let i: i32 = 0; i < toI32(xs.length); i++) {
    const y = work(xs[i], k)
    if (i < toI32(ys.length)) {
      ys[i] = y
    }
  }
  return fold(ys)
}

const oncePar = (xs: i32[], k: i32): i32 => {
  const ys = parallelMap(xs, (x: i32): i32 => work(x, k))
  return fold(ys)
}

export const main = (): i32 => {
  const par = process.argv.length > 1 && process.argv[1] === "par"
  const calls: i32 = 40
  const n: i32 = 4194304 // bench:n
  const xs = new Array<i32>(n)
  for (let i: i32 = 0; i < toI32(xs.length); i++) {
    xs[i] = i
  }
  let check: i32 = 0
  for (let c: i32 = 0; c < calls; c++) {
    const k: i32 = c * 7 + 3
    check = ((check & 16777215) * 17 + (par ? oncePar(xs, k) : onceSeq(xs, k))) & 16777215
    if (c < toI32(xs.length)) {
      xs[c] = check
    }
  }
  console.log(`${check}`)
  return 0
}
