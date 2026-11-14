// NL2777: a key that is not a field's name.
class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}
export const main = (): void => {
  const { "x": a } = new Point(1, 2)
  console.log(a)
}
