import { scope } from "nish/threads"

const square = (n: i32): i32 => n * n

export function main(): i32 {
  {
    using s = scope()
    for (let i = 0; i < 2; i++) {
      s.spawn(square, i)
    }
  }
  console.log("joined")
  return 0
}
