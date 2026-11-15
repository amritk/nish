// NL2783: an array pattern reads an array.
class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}
export const main = (): void => {
  const [a] = new Point(1, 2)
  console.log(a)
}
