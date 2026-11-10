// The twin of `spread.ts`: each spread there is written out here as the fields
// it copies, in the order the spread stores them.
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

export const moved = (b: Base): Point => ({ x: b.x, y: b.y, name: b.name, z: 1 })

export const main = (): void => {
  const b: Base = { x: 1, y: 2, name: "b" }
  const p: Point = { y: b.y, name: b.name, x: 10, z: 3 }
  const q = moved(b)
  console.log(`${p.x} ${p.y} ${p.name} ${p.z} ${q.x}`)
}
