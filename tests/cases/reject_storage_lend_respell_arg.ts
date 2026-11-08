// WP50 §5.1: a callee lent storage may not pass its typed-array parameter on
// to a `T[]` parameter, whose spelling allows `push` and would grow the
// storage through its static header.
const S = new Array<i32>(8)

const g = (b: i32[]): void => {
  b.push(1)
}

const f = (a: Int32Array): void => {
  g(a)
}

export const main = (): void => {
  f(S)
  console.log(`${S.length}`)
}
