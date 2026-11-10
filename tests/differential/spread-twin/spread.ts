// `written.ts` is this file with every object spread written out as the fields
// it copies: `tests/run.js` holds the two to the same IR, value names aside. A
// literal that stays local is an `alloca` in both, and one that escapes is
// allocated in the arena in both.
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

export const moved = (b: Base): Point => ({ ...b, z: 1 })

export const main = (): void => {
  const b: Base = { x: 1, y: 2, name: "b" }
  const p: Point = { ...b, x: 10, z: 3 }
  const q = moved(b)
  console.log(`${p.x} ${p.y} ${p.name} ${p.z} ${q.x}`)
}
