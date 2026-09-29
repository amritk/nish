// WP34 N6: ctSelect over u32 at the edges of the word: an all-ones mask picks
// `a`, a zero mask picks `b`, and any other mask blends bit by bit, as
// `(a & mask) | (b & ~mask)` says. f64 mode with a `main`, so
// tests/differential/unmodified.js runs it under Node with runtime/nish.mjs
// too, and the two must print the same.
export const main = (): i32 => {
  const ONES: u32 = 0xffffffff;
  const TOP: u32 = 0x80000000;
  const values: u32[] = [0, 1, TOP, ONES, 0xaaaaaaaa];
  for (const a of values) {
    for (const b of values) {
      console.log(`${a} ${b}: ${ctSelect(ONES, a, b)} ${ctSelect(0, a, b)}`);
    }
  }
  // Not a mask the rule promises anything about, but a defined blend:
  // 0x12345678 & 0xf0f0f0f0 | 0x9abcdef0 & 0x0f0f0f0f is 0x1a3c5e70.
  const half: u32 = 0xf0f0f0f0;
  console.log(ctSelect(half, 0x12345678, 0x9abcdef0));
  console.log(ctSelect(TOP, ONES, 0));
  console.log(ctSelect(1, 0, ONES));
  // A literal operand takes the type of the first one that is not a literal.
  console.log(ctSelect(ONES, 7, TOP));
  return 0;
};
