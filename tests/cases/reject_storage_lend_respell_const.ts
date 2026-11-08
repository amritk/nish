// WP50 §5.1: a callee lent storage may not bind its typed-array parameter to
// a `T[]` local, whose spelling allows `pop`.
const S = new Array<i32>(8)

const f = (a: Int32Array): void => {
  const b: i32[] = a
  b.pop()
}

export const main = (): void => {
  f(S)
  console.log(`${S.length}`)
}
