// A struct read only through a pattern does not escape: `p` stays an `alloca`.
class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}

export const sum = (a: number, b: number): number => {
  const p = new Point(a, b)
  const { x, y } = p
  return x + y
}

export const main = (): void => {
  console.log(sum(3, 4))
}
