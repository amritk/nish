// NL2779: `Map.get` gives `V | undefined`, which may be absent like a `T | null`.
class Point {
  x: number
  constructor(x: number) {
    this.x = x
  }
}
export const main = (): void => {
  const m = new Map<string, Point>()
  m.set("a", new Point(1))
  const { x } = m.get("a")
  console.log(x)
}
