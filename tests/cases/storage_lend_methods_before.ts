// Module storage lent to callees that call the array methods, each callee
// declared before its caller: its body is checked first, so its `a.slice(0, 2)`
// has already been rewritten to a std template call when the lend is judged.
// The lend is judged as the method written, as in `storage_lend_methods_after`.
const BUF = new Int32Array(3)

const sliced = (a: Int32Array): i32 => a.slice(0, 2).length
const mapped = (a: Int32Array): i32 => a.map((x) => x + 1)[0]
const kept = (a: Int32Array): i32 => a.filter((x) => x > 1).length
const anyBig = (a: Int32Array): boolean => a.some((x) => x > 2)
const allSet = (a: Int32Array): boolean => a.every((x) => x > 0)
const firstOne = (a: Int32Array): i32 => a.findIndex((x) => x === 1)
const sortFirst = (a: Int32Array): i32 => {
  a.sort((x, y) => x - y)
  return a[0]
}

export const main = (): void => {
  BUF[0] = 3
  BUF[1] = 1
  BUF[2] = 2
  console.log(`${sliced(BUF)} ${mapped(BUF)} ${kept(BUF)} ${anyBig(BUF)} ${allSet(BUF)} ${firstOne(BUF)}`)
  console.log(`${sortFirst(BUF)} ${BUF[2]}`)
}
