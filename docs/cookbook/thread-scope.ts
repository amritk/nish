import { scope } from "nish/threads"

const square = (n: i32): i32 => n * n

const cube = (n: i32): i32 => n * n * n

export const powers = (n: i32, out: i32[]): void => {
  using s = scope()
  s.spawn(square, n, out, 0)
  s.spawn(cube, n, out, 1)
}
