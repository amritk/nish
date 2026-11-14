// NL2779: a value that may be absent.
class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}
const pick = (p: Point | null): number => {
  const { x } = p
  return x
}
export const main = (): void => {
  console.log(pick(null))
}
