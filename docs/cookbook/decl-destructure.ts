class Point {
  x: i32
  y: i32
  constructor(x: i32, y: i32) {
    this.x = x
    this.y = y
  }
}

const pick = (p: Point): i32 => {
  const { x, y: py } = p
  return x - py
}

const third = (xs: i32[]): i32 => {
  const [a, , c] = xs
  return a + c
}
