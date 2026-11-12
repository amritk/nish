// WP51 §2.2: `JSON.stringify` of a reference is refused as printing one is:
// Node would print the function's source, native holds a tag.
type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1

export const main = (): void => {
  const f: F = inc
  const s = JSON.stringify(f)
}
