// A pattern that binds no name is accepted, as TypeScript accepts it, and
// still evaluates its right-hand side exactly once: `const {} = p`,
// `const [] = xs`, `const [,] = xs` and `const [, ,] = make()`.
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

export const main = (): void => {
  const p = new Point(1, 2)
  const xs = [3, 4]
  const {} = p
  const [] = xs
  const [,] = xs
  const calls: number[] = []
  const [, ,] = make(calls)
  const {} = new Point(calls.length, 0)
  console.log(calls.length)
  console.log(p.x + xs[0])
}
