import { scope } from "nish/threads"

const square = (n: i32): i32 => n * n

export function main(): i32 {
  {
    const answer = new Array<i32>(1)
    const answer2 = new Array<i32>(1)
    using s = scope()
    s.spawn(square, 3, answer, 0)
    s.spawn(square, 4, answer2, 0)
  }
  console.log("joined")
  return 0
}
