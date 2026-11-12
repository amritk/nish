// A module that binds `toI32` itself gets no review edit, for `/` or `/=`:
// the edit would write `toI32(a / b)` and call this function, which adds
// 1000, where the original divides.
const toI32 = (x: i32): i32 => x + 1000

const f = (a: i32, b: i32): i32 => a / b

const g = (a: i32, b: i32): i32 => {
  let q = a
  q /= b
  return q
}

export const main = (): i32 => {
  console.log(`${f(17, 4)} ${g(17, 4)} ${toI32(4)}`)
  return 0
}
