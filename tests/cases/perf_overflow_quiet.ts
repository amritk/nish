// WP15 §8, the false-positive guards for the arithmetic warnings. Every line
// here is either the rewrite one of the warnings names or a shape the compiler
// cannot call wrong, and none of them may warn.
export function test(): number {
  // The rewrite the widening warning asks for: both operands are widened
  // first, so the multiplication happens in i64 and nothing wraps.
  const a = 70000;
  const b = 40000;
  const wide = toI64(a) * toI64(b);

  // Not a constant. Whether this overflows depends on values the compiler does
  // not have, and warning on every `*` in the program is exactly the
  // un-actionable class section 8 rules out.
  let n = 3;
  n = n * 2;

  // A constant that fits, right up against the edge of the type.
  const fits = 2147483646 + 1;

  // A shift count inside the operand width shifts by what it says. Shifts
  // carry no no-wrap flag, so reaching the sign bit is defined.
  const shifted = 1 << 31;

  return toI32(wide / 100000000) + n + (fits - 2147483646) + (shifted - shifted);
}
