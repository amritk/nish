// `1e10` is ten billion, which is past i32 -- not the wrapped digits of `1`,
// `e` and `10` (#267).
export const main = (): void => {
  const x: i32 = 1e10
  console.log(x)
}
