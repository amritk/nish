// The boundary of "`-5` counts as the literal": the *other* operand still has to be a
// shape the contextual walk answers for — a variable, a field or element of one, or a
// call — and a shift is not one of them however plainly integral it looks
// (docs/LANGUAGE.md, "Numeric literals"). So the negated literal keeps the mode's
// default type and the widths do not match. Reading the sibling's computed type instead
// would compile this, which is the over-wide fix this case exists to refuse.
export const main = (): i32 => {
  const cp: i32 = 200;
  return -1 * (cp >> 6);
};
