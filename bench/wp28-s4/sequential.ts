// Spike S4, the baseline: what `await Promise.all([product(a), product(b)])`
// is today, the two calls one after the other on one thread.
//
//   sequential <n> <calls>    n: elements per task; calls: how many pairs
import { element, feedback, fold, mulmod, product } from "./kernel"

export const main = (): i32 => {
  if (process.argv.length < 3) {
    console.error("usage: sequential <n> <calls>")
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
    const left = product(a)
    const right = product(b)
    check = fold(check, mulmod(left, right))
    const at: i32 = c % n
    if (at >= 0 && at < toI32(a.length)) {
      a[at] = feedback(check)
    }
  }
  console.log(`${check}`)
  return 0
}
