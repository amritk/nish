// WP51 stage 1: an arrow argument captures a reference parameter of the
// method it is written in, through `map` and through `filter`. The capture's
// place is the method parameter's own.
type F = (x: i32) => i32
type P = (x: i32) => boolean

const plus1 = (x: i32): i32 => x + 1
const double = (x: i32): i32 => x * 2
const even = (x: i32): boolean => x % 2 === 0
const big = (x: i32): boolean => x > 2

class Table {
  xs: i32[]
  constructor(xs: i32[]) {
    this.xs = xs
  }
  mapAll(h: F): i32[] {
    return this.xs.map((x) => h(x))
  }
  keepIf(p: P): i32[] {
    return this.xs.filter((x) => p(x))
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
  const t = new Table([1, 2, 3, 4])
  show(t.mapAll(plus1))
  show(t.mapAll(double))
  show(t.keepIf(even))
  show(t.keepIf(big))
}
