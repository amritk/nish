// A constant table cannot reach a mutable `T[]` through a generic
// instantiation: `T` is `u8`, so the parameter is `u8[]`.
const TAB: readonly u8[] = [1, 2, 3]

const first = <T>(xs: T[]): T => {
  return xs[0]
}

export const main = (): void => {
  console.log(`${first(TAB)}`)
}
