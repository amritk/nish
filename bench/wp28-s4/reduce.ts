// Spike S4, the yardstick: the same product over the same elements as one
// `parallelReduce`, the data-parallel form the fork/join is measured against.
// The two tasks' arrays are one array here, `a` then `b`.
//
//   reduce <n> <calls>    n: elements per task (the array holds 2n); calls: how many folds
import { parallelReduce } from "nish/threads"
import { element, feedback, fold, mulmod } from "./kernel"

export const main = (): i32 => {
  if (process.argv.length < 3) {
    console.error("usage: reduce <n> <calls>")
    return 2
  }
  const n: i32 = parseInt(process.argv[1])
  const calls: i32 = parseInt(process.argv[2])
  const xs = new Array<i32>(2 * n)
  for (let i: i32 = 0; i < toI32(xs.length); i++) {
    xs[i] = element(i)
  }
  let check: i32 = 0
  for (let c: i32 = 0; c < calls; c++) {
    check = fold(check, parallelReduce(xs, mulmod, 1))
    const at: i32 = c % n
    if (at >= 0 && at < toI32(xs.length)) {
      xs[at] = feedback(check)
    }
  }
  console.log(`${check}`)
  return 0
}
