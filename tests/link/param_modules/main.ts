import { Color, first, join, paint } from "./lib"

function ratio(a: number, b: number = 5): number {
  return a * b
}
function pick<T>(xs: T[], at: number = 0): T {
  return xs[at]
}
class Counter {
  count: number
  step: number
  constructor(start: number = 0, step: number = 1) {
    this.count = start
    this.step = step
  }
  bump(times: number = 1): number {
    this.count = this.count + this.step * times
    return this.count
  }
  addAll(...xs: number[]): number {
    for (const x of xs) {
      this.count = this.count + x
    }
    return this.count
  }
}
export function main(): void {
  console.log(paint("a"))
  console.log(paint("b", Color.Red))
  console.log(paint("c", Color.Red, true))
  console.log(join(", "))
  console.log(join(", ", "x"))
  console.log(join("-", "x", "y", "z"))
  console.log(first(7))
  console.log(first(7, 8, 9))
  console.log(first("none", "s"))
  console.log(ratio(3))
  console.log(ratio(3, 2))
  console.log(pick([4, 5, 6]))
  console.log(pick(["p", "q"], 1))
  const c = new Counter()
  console.log(c.bump())
  console.log(c.bump(3))
  console.log(c.addAll())
  console.log(c.addAll(1, 2))
  const d = new Counter(5, 2)
  console.log(d.bump())
}
