// A binary operator's operands take their type from *each other*, never from
// the context around the operator: `docs/LANGUAGE.md`'s numeric-literal table
// grants an annotated initializer its type, and `1 + 2` is not a literal, it is
// a sum of two `i32` literals that neither annotation reaches. Write
// `const b: u8 = toU8(3)`, or annotate the operands one at a time.
export function main(): i32 {
  const b: u8 = 1 + 2;
  return toI32(b);
}
