// A function declaration named `toU32` gets the module no review edit for a
// `u32` `/=`.
function toU32(x: u32): u32 {
  return x + 1000
}

const g = (a: u32, b: u32): u32 => {
  let q = a
  q /= b
  return q
}

export const main = (): i32 => {
  console.log(`${g(17, 4)} ${toU32(4)}`)
  return 0
}
