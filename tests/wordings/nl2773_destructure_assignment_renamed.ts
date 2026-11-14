// NL2773: an object pattern on the left of `=`, renamed.
class Point {
  x: number
  constructor(x: number) {
    this.x = x
  }
}
export const main = (): void => {
  const p = new Point(1)
  let px = 0
  ;({ x: px } = p)
  console.log(px)
}
