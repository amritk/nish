// NL2776: a method is not a field; the diagnostic says to call it.
class Point {
  x: number
  constructor(x: number) {
    this.x = x
  }
  norm(): number {
    return this.x
  }
}
export const main = (): void => {
  const { norm } = new Point(1)
  console.log(norm)
}
