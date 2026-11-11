// A spread sets only the fields its source has: `Base` has no `z`, and nothing
// else in the literal sets it, so the literal is missing a field of `Point`.
interface Base {
  x: i32
  y: i32
}

interface Point {
  x: i32
  y: i32
  z: i32
}

export const main = (): i32 => {
  const b: Base = { x: 1, y: 2 }
  const p: Point = { ...b }
  return p.x
}
