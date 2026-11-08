// WP50 §5.1: a callee lent storage may not return its typed-array parameter
// as a `T[]`, which the caller could then grow.
const S = new Array<i32>(8)

const id = (a: Int32Array): i32[] => {
  return a
}

export const main = (): void => {
  id(S).push(1)
  console.log(`${S.length}`)
}
