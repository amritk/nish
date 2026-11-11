// WP51 stage 1: an arrow argument captures a reference parameter of the
// function it is written in. The capture's place is the parameter's own, so
// both callers' functions reach the arrow's dispatcher through `map` and
// through `filter`.
type F = (x: i32) => i32
type P = (x: i32) => boolean

const plus1 = (x: i32): i32 => x + 1
const double = (x: i32): i32 => x * 2
const even = (x: i32): boolean => x % 2 === 0
const big = (x: i32): boolean => x > 2

const mapAll = (h: F, xs: i32[]): i32[] => xs.map((x) => h(x))
const keepIf = (p: P, xs: i32[]): i32[] => xs.filter((x) => p(x))

const show = (xs: i32[]): void => {
  let line = ""
  for (const x of xs) {
    line = line + `${x} `
  }
  console.log(line)
}

export const main = (): void => {
  show(mapAll(plus1, [1, 2, 3]))
  show(mapAll(double, [1, 2, 3]))
  show(keepIf(even, [1, 2, 3, 4]))
  show(keepIf(big, [1, 2, 3, 4]))
}
