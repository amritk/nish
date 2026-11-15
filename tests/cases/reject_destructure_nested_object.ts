// A nested object pattern is refused: destructure the field into a name first.
class Point {
  x: number
  constructor(x: number) {
    this.x = x
  }
}

class Holder {
  p: Point
  constructor(p: Point) {
    this.p = p
  }
}

export const main = (): void => {
  const { p: { x } } = new Holder(new Point(1))
  console.log(x)
}
