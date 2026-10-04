// The access is the right operand of `??`, read only when the map misses, so
// a guard before the statement would panic on a hit the program never indexes.
const pick = (xs: i32[], idx: i32[], m: Map<i32, i32>): i32 => {
  let total = 0
  for (const i of idx) {
    const cur = m.get(i)
    const v = cur ?? xs[i]
    total = total + v
  }
  return total
}

export const main = (): number => {
  const m = new Map<i32, i32>()
  m.set(9, 50)
  console.log(`${pick([1, 2], [9], m)}`)
  return 0
}
