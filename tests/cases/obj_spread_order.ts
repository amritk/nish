// An object spread is evaluated once, in source order with the entries around
// it, and the entry written later wins: `x` set after the spread overrides the
// source's, and of two spreads the later one supplies the fields both have.
interface Base {
  x: i32
  y: i32
  name: string
}

interface Point {
  x: i32
  y: i32
  name: string
  z: i32
}

const mark = (label: string, b: Base): Base => {
  console.log(`eval ${label}`)
  return b
}

const tick = (label: string, v: i32): i32 => {
  console.log(`eval ${label}`)
  return v
}

export const main = (): void => {
  const a: Base = { x: 1, y: 2, name: "a" }
  const b: Base = { x: 3, y: 4, name: "b" }
  const p: Point = { z: tick("z", 9), ...mark("first", a), ...mark("second", b), x: tick("x", 10) }
  console.log(`${p.x} ${p.y} ${p.name} ${p.z}`)
  const q: Point = { ...a, z: 0 }
  console.log(`${q.x} ${q.y} ${q.name} ${q.z}`)
}
