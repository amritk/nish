// WP51 §2.2: Node prints a function's source, native holds a tag, so a
// reference can be called, compared, stored and passed, nothing else.
type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1

export const main = (): void => {
  const f: F = inc
  console.log(`${f}`)
}
