// NL2772: a missing name has no default to take.
class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}
export const main = (): void => {
  const { x = 0 } = new Point(1, 2)
  console.log(x)
}
