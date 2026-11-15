// Patterns in the places a review asked to see covered: over `this` in a
// method, in a `for (let ...of)` head, in an arrow's and an async body, and
// in a C-style `for` initialiser.
class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
  sum(): number {
    const { x, y } = this
    return x + y
  }
}
const scaled = (p: Point, k: number): number => {
  const { x: px, y: py } = p
  return px * k + py * k
}
const later = async (xs: number[]): Promise<number> => {
  const [a, b] = xs
  return a - b
}
export const main = async (): Promise<void> => {
  const p = new Point(3, 4)
  console.log(p.sum())
  console.log(scaled(p, 2))
  const rows = [new Point(1, 2), new Point(5, 6)]
  for (let { x, y } of rows) {
    x = x + 10
    console.log(x * y)
  }
  const d = await later([9, 4])
  console.log(d)
  const xs = [0, 3]
  for (let [i, n] = xs; i < n; i++) {
    console.log(i)
  }
}
