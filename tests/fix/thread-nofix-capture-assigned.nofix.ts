import { scope } from "nish/threads"

export function main(): i32 {
  let k = 3
  k = k + 1
  const out = new Array<i32>(1)
  {
    using s = scope()
    s.spawn((n: i32): i32 => {
      k = n
      return k
    }, 5, out, 0)
  }
  console.log(out[0])
  return 0
}
