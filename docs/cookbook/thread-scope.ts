import { scope } from "nish/threads"

const square = (n: i32): i32 => n * n

const cube = (n: i32): i32 => n * n * n

export const powers = (n: i32): i32 => {
  const out: i32[] = [0, 0]
  {
    using s = scope()
    s.spawn(square, n, out, 0)
    s.spawn(cube, n, out, 1)
  }
  return out[0] + out[1]
}
