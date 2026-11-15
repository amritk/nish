// A `for...of` head binds the names afresh on each pass, from the element the
// loop reads.
class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}

export const main = (): void => {
  const points = [new Point(1, 2), new Point(5, 6)]
  for (const { x, y } of points) {
    console.log(x * y)
  }
  const pairs = [[1, 4], [9, 2]]
  for (const [lo, hi] of pairs) {
    console.log(hi - lo)
  }
}
