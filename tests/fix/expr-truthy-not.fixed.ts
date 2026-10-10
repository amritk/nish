// NL2263: `!x` on an integer, a string or a class behind `| null` is the
// falsy test, so its fix is the comparison a condition's fix writes, turned
// round: `=== 0`, `.length === 0`, `=== null`. `!` reads truthiness wherever
// it stands, so it is fixed as a value too; the comparison is parenthesised
// where its parent binds tighter than `===`, and the operand where `===`
// would bind tighter than it.
class Node {
  value: i32
  constructor(value: i32) {
    this.value = value
  }
}
const count = (xs: i32[]): i32 => xs.length
const isTrue = (b: boolean): i32 => (b ? 1 : 0)
export const test = (): number => {
  const xs: i32[] = [1, 2, 3]
  let n: i32 = 0
  if (xs.length === 0) {
    n = n + 1
  }
  const s = "nish"
  const p: Node | null = null
  const empty = s.length === 0
  const missing = p === null
  const flag: i64 = 6
  const clear = (flag & 2) === 0
  const none = count(xs) === 0 && true
  const same = true === (n === 0)
  return n + isTrue(empty) + isTrue(missing) + isTrue(clear) + isTrue(none) + isTrue(same) + isTrue(n === 0)
}
