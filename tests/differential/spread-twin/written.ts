// The twin of `spread.ts`: each spread there is written out here as the fields
// it copies, in the order the spread stores them.
interface Base {
  y: i64
  name: string
  x: i32
}

interface Point {
  y: i64
  name: string
  x: i32
  z: i32
}

export const moved = (b: Base): Point => ({ y: b.y, name: b.name, x: b.x, z: 1 })

export const firstX = (b: Base): i32 => {
  const p: Point = { y: b.y, name: b.name, x: b.x, z: 1 }
  return p.x
}

export const main = (): void => {
  const b: Base = { x: 1, y: toI64(2), name: "b" }
  const p: Point = { y: b.y, name: b.name, x: 10, z: 3 }
  const q = moved(b)
  const f = firstX(b)
  console.log(`${p.x} ${p.y} ${p.name} ${p.z} ${q.x} ${f}`)
}
