import { parallelMap } from "nish/threads"

export function main(): i32 {
  const xs: i32[] = [1, 2, 3]
  let k = 10
  k = k * 2
  const kNow = k
  const ys = parallelMap(xs, (x: i32): i32 => x + kNow)
  const kNow2 = k
  const zs = parallelMap(xs, (x: i32): i32 => x * kNow2)
  console.log(ys[0] + ys[1] + ys[2] + zs[0])
  return 0
}
