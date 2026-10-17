import { scope } from "nish/threads"

const square = (n: i32): i32 => n * n

export function main(): i32 {
  {
    using s = scope()
    s.spawn(square, 3)
  }
  console.log("joined")
  return 0
}
