// An unread shorthand name is renamed inside the pattern, not before it.
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
  const { x, y } = p
  console.log(x)
}
