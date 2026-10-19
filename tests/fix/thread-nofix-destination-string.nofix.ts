import { scope } from "nish/threads"

const name = (n: i32): string => `task ${n}`

export function main(): i32 {
  {
    using s = scope()
    s.spawn(name, 3)
  }
  console.log("joined")
  return 0
}
