// A callee declared before its caller keeps the array `a.sort(cmp)` answers:
// the rewritten call is judged as `sort`, which is lend-safe only as a
// statement, so the lend is still refused.
const BUF = new Int32Array(3)

const keep = (a: Int32Array): Int32Array => a.sort((x, y) => x - y)

export const main = (): void => {
  console.log(`${keep(BUF).length}`)
}
