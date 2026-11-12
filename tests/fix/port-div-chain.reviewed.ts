// Review edits compose: `a / b / c` warns twice, and both edits insert
// `toI32(` at the same offset. Applied together, from the end and the inner
// division's first, they nest: `toI32(toI32(a / b) / c)`.
const f = (a: i32, b: i32, c: i32): i32 => toI32(toI32(a / b) / c)

export const main = (): i32 => {
  console.log(`${f(100, 7, 3)} ${f(-100, 7, 3)}`)
  return 0
}
