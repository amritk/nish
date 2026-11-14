// `var` with an object pattern is a `var` declaration and is refused as one.
class Point {
  x: number
  constructor(x: number) {
    this.x = x
  }
}
export const main = (): void => {
  const p = new Point(1)
  var { x } = p
  console.log(x)
}
