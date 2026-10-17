import { scope } from "nish/threads"

export function main(): i32 {
  let k = 3
  k = k + 1
  const out = new Array<i32>(2)
  {
    using s = scope()
    s.spawn((n: i32): i32 => n * k, 5, out, 0)
    s.spawn((n: i32): i32 => n + k, 7, out, 1)
  }
  console.log(out[0] + out[1])
  return 0
}
