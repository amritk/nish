// Data parallelism (wp29 P1), the region kernel: a 2^17-element map called a
// thousand times, so what is measured is what one divided region costs. Each
// element is eight rounds of a shift-and-xor scramble: enough by the
// compiler's estimate for the region to divide over four cores, and about half
// a millisecond of work on one, so handing the chunks to other threads and
// waiting for them is a visible part of each call. Between calls one input
// element is fed from an output element, so no call can be hoisted out of the
// loop or computed once. `seq` runs the loop, `par` runs `parallelMapInto`,
// and both print the same checksum.
import { parallelMapInto } from "nish/threads"

const scramble = (x: i32): i32 => {
  let h: i32 = x
  for (let k: i32 = 0; k < 8; k++) {
    h = h ^ (h << 5)
    h = h ^ (h >> 3)
    h = h ^ k
  }
  return h
}

export const main = (): i32 => {
  const rounds: i32 = 1000 // bench:n
  const n: i32 = 131072
  const par = process.argv.length > 1 && process.argv[1] === "par"
  const src = new Array<i32>(n)
  const dst = new Array<i32>(n)
  for (let i: i32 = 0; i < toI32(src.length); i++) {
    src[i] = i
  }
  let check: i32 = 0
  for (let r: i32 = 0; r < rounds; r++) {
    if (par) {
      parallelMapInto(src, dst, scramble)
    } else {
      for (let i: i32 = 0; i < toI32(src.length); i++) {
        const y = scramble(src[i])
        if (i < toI32(dst.length)) {
          dst[i] = y
        }
      }
    }
    const at: i32 = (r * 7919) % n
    if (at >= 0 && at < toI32(dst.length) && at < toI32(src.length)) {
      check = check ^ dst[at]
      src[at] = dst[at]
    }
  }
  let sum: i32 = 0
  for (let i: i32 = 0; i < toI32(dst.length); i++) {
    sum = sum ^ dst[i]
  }
  console.log(`${sum} ${check}`)
  return 0
}
