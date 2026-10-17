import { scope } from "nish/threads"

export function main(): i32 {
  const out = new Array<i32>(2)
  {
    using s = scope()
    for (let k = 0; k < 2; k++) s.spawn((n: i32): i32 => n * k, 5, out, k)
  }
  console.log(out[0] + out[1])
  return 0
}
