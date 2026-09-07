// The unsigned divisor check is ONE compare. Unsigned division has no
// overflow case (there is no value whose negation leaves the range), so only
// the zero test remains; the signed version next door needs three compares,
// an `and` and an `or`. Keep both in one golden so the diff shows the saving.
export function udiv(a: u32, b: u32): u32 {
  return a / b;
}

export function sdiv(a: i32, b: i32): i32 {
  return a / b;
}
