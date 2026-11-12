// WP51 stage 2: a generic's `Result<T, E>` instantiated at a reference type
// is a reference in a `Result` arm, refused like a written one (NL2744).
type F = (x: i32) => i32

const plus1 = (x: i32): i32 => x + 1

const wrap = <T>(x: T): Result<T, string> => Ok(x)

export const main = (): void => {
  const w = wrap(plus1)
  console.log(`${w.ok}`)
}
