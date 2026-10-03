// NL2188: a class or an array behind `| null` is truthy when it is not `null`,
// since an object is always truthy, so the fix is `!== null` and the branch
// narrows as the rewritten test does.
class Cell {
  value: i32 = 0
}
export const test = (): number => {
  const cell: Cell | null = new Cell()
  const xs: i32[] | null = null
  let n: i32 = 0
  if (cell !== null) {
    n = n + 1
  }
  if (xs !== null) {
    n = n + 2
  }
  return n
}
