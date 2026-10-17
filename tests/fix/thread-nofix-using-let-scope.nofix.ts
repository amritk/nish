import { scope } from "nish/threads"

const square = (n: i32): i32 => n * n

export function main(): i32 {
  const out = new Array<i32>(2)
  {
    let s = scope()
    s.spawn(square, 3, out, 0)
    s.spawn(square, 4, out, 1)
  }
  console.log(out[0] + out[1])
  return 0
}
