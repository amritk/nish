// A pattern that binds no name is accepted, as TypeScript accepts it, and
// still evaluates its right-hand side exactly once: `const {} = p`,
// `const [] = xs`, `const [,] = xs`, `const [, ,] = make()` and
// `const {} = at()`: `calls` counts `make` and `at` once each.
class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}

const make = (calls: number[]): number[] => {
  calls.push(calls.length)
  return [calls.length, calls.length]
}

const at = (calls: number[]): Point => {
  calls.push(calls.length)
  return new Point(calls.length, 0)
}

export const main = (): void => {
  const p = new Point(1, 2)
  const xs = [3, 4]
  const {} = p
  const [] = xs
  const [,] = xs
  const calls: number[] = []
  const [, ,] = make(calls)
  const {} = at(calls)
  console.log(calls.length)
  console.log(p.x + xs[0])
}
