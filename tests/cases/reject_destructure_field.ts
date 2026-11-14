// NL2778: a field the receiver does not have.
class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}
export const main = (): void => {
  const { z } = new Point(1, 2)
  console.log(z)
}
