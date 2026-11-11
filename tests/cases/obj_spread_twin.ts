// `obj_spread_twin_written.ts` is this file with every object spread written
// out as the fields it copies: `tests/run.js` holds the two to the same IR,
// value names aside, and each field has a type of its own so a copy wired to
// the wrong field shows. A literal that stays local is an `alloca` in both, and
// one that escapes is allocated in the arena in both.
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

export const moved = (b: Base): Point => ({ ...b, z: 1 })

// Reads `b` through the spread and nothing else, so it is `readonly`, never
// `readnone`: the attribute the whole-module comparison holds to the twin's.
export const firstX = (b: Base): i32 => {
  const p: Point = { ...b, z: 1 }
  return p.x
}

export const main = (): void => {
  const b: Base = { x: 1, y: toI64(2), name: "b" }
  const p: Point = { ...b, x: 10, z: 3 }
  const q = moved(b)
  const f = firstX(b)
  console.log(`${p.x} ${p.y} ${p.name} ${p.z} ${q.x} ${f}`)
}
