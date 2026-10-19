import { scope } from "nish/threads"

const at = (n: i32): i32 => n

export function main(): i32 {
  let k = 3
  k = k + 1
  const out = new Array<i32>(2)
  {
    using s = scope()
    s.spawn((n: i32): i32 => n * k, at(k), out, 0)
  }
  console.log(out[0])
  return 0
}
