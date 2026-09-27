// WP31 §5: a bound past `u64` is outside `i32` in any radix. Seventeen hex
// digits wrap to 0 in 64-bit arithmetic, so the literal is measured before it
// is read rather than judged by the value it wraps to.
export const f = (x: integer<0, 0x10000000000000000>): i32 => x

export const main = (): number => f(0)
