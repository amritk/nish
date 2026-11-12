// A `/=` on a field gets no review edit: `p.x = toI32(p.x / 2)` would
// evaluate `p` twice, and only a plain name is safe to spell twice.
interface Point {
  x: i32
  y: i32
}

export const main = (): i32 => {
  const p: Point = { x: 9, y: 4 }
  p.x /= 2
  console.log(`${p.x} ${p.y}`)
  return 0
}
