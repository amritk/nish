// WP51 §5.2: an exported function of the program called through the C ABI
// could be handed a tag no dispatcher knows.
type F = (x: i32) => i32

export function apply(f: F, x: i32): i32 {
  return f(x)
}
