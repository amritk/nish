// WP15 §8: the two arithmetic warnings whose programs still have defined
// behaviour, so this case is also linked and run.
//
// The widening rule is about the *shape* rather than the values: `a * b` is
// computed in i32 whatever `a` and `b` hold, so the conversion that follows it
// can never recover an overflow that has already happened. Small values keep
// the case runnable while still tripping it.
export function test(): number {
  const a = 3;
  const b = 4;
  const widened = toI64(a * b);
  // 32 is at or beyond the width of an i32, so the count is masked to 0 and
  // this shifts by nothing at all.
  const shifted = 1 << 32;
  return toI32(widened) + shifted;
}
