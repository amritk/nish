import { scope } from "nish/threads"

export function main(): i32 {
  let k = 3
  k = k + 1
  const out = new Array<i32>(2)
  {
    using s = scope()
    const kNow = k
    s.spawn((n: i32): i32 => n * kNow, 5, out, 0)
    const kNow2 = k
    s.spawn((n: i32): i32 => n + kNow2, 7, out, 1)
  }
  console.log(out[0] + out[1])
  return 0
}
