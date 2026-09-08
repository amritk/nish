// An element target is legal for `&= |= ^= <<= >>= >>>=` now, but the operand
// rule is still `&`'s: `f64` has no bit operations, and the refusal names the
// compound token that was written (docs/LANGUAGE.md, Expressions).
export function test(): number {
  const a: f64[] = [6.0];
  a[0] &= 3.0;
  return 0;
}
