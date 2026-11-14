// NL2771: an object pattern on the left of `=` is not a declaration either.
class Point {
  x: number
  constructor(x: number) {
    this.x = x
  }
}
export const main = (): void => {
  const p = new Point(1)
  let x = 0
  ;({ x } = p)
  console.log(x)
}
