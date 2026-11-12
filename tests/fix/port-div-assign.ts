// `q /= d` becomes `q = toI32(q / d)`; a divisor that is not a name, a number
// or a call is parenthesised, so `q /= d + 1` keeps dividing by the sum.
export const main = (): i32 => {
  let q: i32 = 4000
  const d: i32 = 7
  q /= d + 1
  let r: i32 = 100
  r /= 3
  console.log(`${q} ${r}`)
  return 0
}
