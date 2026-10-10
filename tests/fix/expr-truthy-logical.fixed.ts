// NL2099: under `tsc`, `&&` and `||` answer one of their operands, so a
// non-boolean operand is fixed where that answer is read only for its
// truthiness: the whole is a condition, or `!`'s operand, directly or through
// parentheses and other `&&` and `||`. There each non-boolean operand takes
// the comparison a condition's fix writes: `!== 0`, `.length !== 0`,
// `!== null`, with `&` parenthesised.
class Node {
  value: i32
  constructor(value: i32) {
    this.value = value
  }
}
export const test = (s: string, t: string, p: Node | null, n: i32): number => {
  let k: i32 = 0
  if (s.length !== 0 && n > 0) {
    k = k + 1
  }
  while (n !== 0 || k > 9) {
    k = k + 1
    break
  }
  const flag: i64 = 6
  const bits = ((flag & 2) !== 0 || p !== null) && true ? 1 : 0
  const neither = !(s.length !== 0 && t.length !== 0)
  for (let i: i32 = 3; i !== 0 && k < 9; i = i - 1) {
    k = k + 1
  }
  do {
    k = k - 1
  } while (k > 100 && k !== 0)
  return k + bits + (neither ? 1 : 0)
}
