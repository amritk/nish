// WP51 stage 1: a call through a reference passes every parameter its type
// lists, so a written function type has no rest parameter.
type F = (...xs: i32[]) => i32

const count = (xs: i32[]): i32 => xs.length

export const main = (): void => {
  const f: F = count
  console.log(`${f([1, 2])}`)
}
