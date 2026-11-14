// NL2773: a renaming object pattern on the left of `=` is not a declaration.
class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}
export const main = (): void => {
  const p = new Point(1, 2)
  let px = 0
  ;({ x: px } = p)
  console.log(px)
}
