// WP51 stage 1: an arrow argument captures a reference parameter of the
// constructor it is written in, through `map` and through `filter`. The
// capture's place is the constructor parameter's own.
type F = (x: i32) => i32
type P = (x: i32) => boolean

const plus1 = (x: i32): i32 => x + 1
const double = (x: i32): i32 => x * 2
const even = (x: i32): boolean => x % 2 === 0
const big = (x: i32): boolean => x > 2

class Mapped {
  out: i32[]
  constructor(h: F, xs: i32[]) {
    this.out = xs.map((x) => h(x))
  }
}

class Kept {
  out: i32[]
  constructor(p: P, xs: i32[]) {
    this.out = xs.filter((x) => p(x))
  }
}

const show = (xs: i32[]): void => {
  let line = ""
  for (const x of xs) {
    line = line + `${x} `
  }
  console.log(line)
}

export const main = (): void => {
  show(new Mapped(plus1, [1, 2, 3]).out)
  show(new Mapped(double, [1, 2, 3]).out)
  show(new Kept(even, [1, 2, 3, 4]).out)
  show(new Kept(big, [1, 2, 3, 4]).out)
}
