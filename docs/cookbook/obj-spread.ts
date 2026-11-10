interface Base {
  x: i32
  y: i32
}

interface Point {
  x: i32
  y: i32
  z: i32
}

const lift = (b: Base): Point => ({ ...b, x: 1, z: 2 })
