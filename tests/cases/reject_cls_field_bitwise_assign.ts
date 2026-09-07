// The bitwise compound assignments (`&= |= ^= <<= >>= >>>=`) take a local
// only; a field target is not lowered yet (docs/LANGUAGE.md, Expressions).
class Flags {
  bits: i32 = 6;
}
export function test(): number {
  const f = new Flags();
  f.bits |= 1;
  return f.bits;
}
