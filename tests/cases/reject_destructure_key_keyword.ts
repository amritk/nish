// A keyword key is a key like any other: `Point` has no field `default`.
class Point {
  x: number
  constructor(x: number) {
    this.x = x
  }
}

export const main = (): void => {
  const { default: d } = new Point(1)
  console.log(d)
}
