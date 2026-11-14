// A computed key names no field the checker can see.
class Point {
  x: number
  constructor(x: number) {
    this.x = x
  }
}

export const main = (): void => {
  const { ["x"]: a } = new Point(1)
  console.log(a)
}
