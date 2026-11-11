// `storage_lend_methods_before` with each callee declared after its caller:
// the lend is judged while the callee's `a.slice(0, 2)` is still a method call.
const BUF = new Int32Array(3)

export const main = (): void => {
  BUF[0] = 3
  BUF[1] = 1
  BUF[2] = 2
  console.log(`${sliced(BUF)} ${mapped(BUF)} ${kept(BUF)} ${anyBig(BUF)} ${allSet(BUF)} ${firstOne(BUF)}`)
  console.log(`${sortFirst(BUF)} ${BUF[2]}`)
}

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
