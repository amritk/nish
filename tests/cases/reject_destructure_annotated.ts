// NL2185: an annotated pattern names the pattern, not its hidden receiver.
class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}
class Other {
  x: number
  constructor(x: number) {
    this.x = x
  }
}
export const main = (): void => {
  const p = new Point(1, 2)
  const { x }: Other = p
  console.log(x)
}
