// A field an entry after the spread sets by name is never copied, so its type
// in the source does not matter: `x` is an `i32` in `Narrow` and an `i64` in
// `Wide`, and the literal's own `x` is the one stored, as TypeScript reads it.
interface Narrow {
  x: i32
  y: i32
}

interface Wide {
  x: i64
  y: i32
}

export const main = (): void => {
  const a: Narrow = { x: 1, y: 2 }
  const big: i64 = toI64(1) << 40
  const w: Wide = { ...a, x: big }
  console.log(`${w.x} ${w.y}`)
}
