// A `/=` whose divisor holds a `/` keeps its warning but gets no review edit:
// the inner `/` is wrapped on its own, and a `/=` edit spanning the divisor
// would overlap it, at any depth. A comment between the name and the `/=`
// declines the edit too, which would drop it.
const twice = (n: i32): i32 => n * 2

export const main = (): i32 => {
  const a: i32 = 7
  const b: i32 = 2
  let q: i32 = 99
  q /= toI32(a / b)
  let r: i32 = 99
  r /= (toI32(a / b))
  let s: i32 = 96
  s /= twice(toI32(a / b)) + 2
  let t: i32 = 50
  t /* halve it */ /= b
  console.log(`${q} ${r} ${s} ${t}`)
  return 0
}
