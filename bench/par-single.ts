// One map over 2^25 elements: `x * 3`, called once, so the program's time is
// the input's fill, one region and the fold. It measures what a single large
// region costs, which a kernel that calls the map many times averages away.
// `par-single seq` runs the loop, `par-single par` runs `parallelMap`, and
// both print the same order-sensitive checksum.
import { parallelMap } from "nish/threads"

const tripled = (xs: i32[]): i32[] => {
  const ys = new Array<i32>(xs.length)
  for (let i: i32 = 0; i < toI32(xs.length); i++) {
    const y = xs[i] * 3
    if (i < toI32(ys.length)) {
      ys[i] = y
    }
  }
  return ys
}

export const main = (): i32 => {
  const par = process.argv.length > 1 && process.argv[1] === "par"
  const n: i32 = 33554432 // bench:n
  const xs = new Array<i32>(n)
  for (let i: i32 = 0; i < toI32(xs.length); i++) {
    xs[i] = (i ^ (i >> 7)) & 65535
  }
  const ys = par ? parallelMap(xs, (x: i32): i32 => x * 3) : tripled(xs)
  let f: i32 = 0
  for (let i: i32 = 0; i < toI32(ys.length); i++) {
    f = ((f << 5) ^ (f >> 19) ^ (ys[i] & 65535)) & 16777215
  }
  console.log(`${f}`)
  return 0
}
