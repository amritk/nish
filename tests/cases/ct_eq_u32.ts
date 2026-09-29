// WP34 N6: ctEq over u32 answers all-ones for equal operands and zero for
// anything else, including pairs that differ only in the top bit or only in the
// bottom one. f64 mode with a `main`, so tests/differential/unmodified.js runs
// it under Node with runtime/nish.mjs too, and the two must print the same.
type Word = u32;

const show = (a: Word, b: Word): void => {
  console.log(`${a} ${b}: ${ctEq(a, b)} ${ctSelect(ctEq(a, b), 1, 2)}`);
};

export const main = (): i32 => {
  const ONES: Word = 0xffffffff;
  const TOP: Word = 0x80000000;
  show(0, 0);
  show(0, 1);
  show(1, 0);
  show(ONES, ONES);
  show(ONES, 0);
  show(0xfffffffe, ONES);
  show(TOP, TOP);
  show(TOP, 0);
  show(1, 0x80000001);
  // The literal may lead: it takes the type of the operand that is not one.
  console.log(ctEq(0, TOP));
  // A parenthesised literal is still the literal, as it is beside an operator.
  console.log(ctEq((0), ctSelect(0, TOP, 0)));
  console.log(ctEq(0, ctSelect(0, ONES, 0)));
  return 0;
};
