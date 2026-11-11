// WP51 §5.2: under `--no-strict-exports` every export is host-visible, so an
// exported function taking a reference could be handed a tag no dispatcher
// knows.
type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1

export const apply = (f: F, x: i32): i32 => f(x)

export const main = (): i32 => apply(inc, 1)
