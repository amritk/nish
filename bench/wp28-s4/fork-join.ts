// Spike S4, the lowering under test: `await Promise.all([product(a),
// product(b)])` as `--async-model threads` would emit it, written by hand.
// Two tasks on one scope, joined where its block ends, their answers combined.
// The two-slot array is the `Promise.all`'s result array: a destination must
// be a fresh local, so every call allocates one, as the lowering would.
//
//   fork-join <n> <calls>    n: elements per task; calls: how many pairs
import { scope } from "nish/threads"
import { element, feedback, fold, mulmod, product } from "./kernel"

const pair = (a: i32[], b: i32[]): i32 => {
  const out: i32[] = [0, 0]
  {
    using s = scope()
    s.spawn(product, a, out, 0)
    s.spawn(product, b, out, 1)
  }
  return mulmod(out[0], out[1])
}

export const main = (): i32 => {
  if (process.argv.length < 3) {
    console.error("usage: fork-join <n> <calls>")
    return 2
  }
  const n: i32 = parseInt(process.argv[1])
  const calls: i32 = parseInt(process.argv[2])
  const a = new Array<i32>(n)
  const b = new Array<i32>(n)
  for (let i: i32 = 0; i < n; i++) {
    if (i < toI32(a.length) && i < toI32(b.length)) {
      a[i] = element(i)
      b[i] = element(n + i)
    }
  }
  let check: i32 = 0
  for (let c: i32 = 0; c < calls; c++) {
    check = fold(check, pair(a, b))
    const at: i32 = c % n
    if (at >= 0 && at < toI32(a.length)) {
      a[at] = feedback(check)
    }
  }
  console.log(`${check}`)
  return 0
}
