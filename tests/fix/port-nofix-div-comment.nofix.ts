// A comment before the `/=` gets the site no review edit: the rewrite
// `q = toI32(q / 4)` replaces the text between the target and the divisor,
// and would drop the comment.
const g = (a: i32): i32 => {
  let q = a
  q /* halve twice */ /= 4
  return q
}

export const main = (): i32 => {
  console.log(`${g(17)}`)
  return 0
}
