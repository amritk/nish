// WP51: a function type inside an array type is printed in parentheses, so a
// diagnostic names `((i32) => i32)[]`, an array of functions, and never
// `(i32) => i32[]`, a function returning an array.
const inc = (x: i32): i32 => x + 1

export const main = (): void => {
  const fs: ((x: i32) => i32)[] = [inc]
  const n: string = fs
  console.log(n)
}
