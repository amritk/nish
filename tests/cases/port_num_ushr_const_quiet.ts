// WP33 NL8008, quiet: a `>>>` whose count is a constant k with k & 31 not 0
// moves a zero into the sign bit, so the i32 result reads back the same signed
// here and unsigned in TypeScript. A literal, a parenthesised count, a named
// constant and a count past 31 (33 & 31 is 1) are all such a k.
const K: i32 = 5;

export const main = (): number => {
  const x: i32 = -16;
  const a: i32 = x >>> 2;
  const b: i32 = x >>> K;
  const c: i32 = x >>> (3);
  let d: i32 = -1;
  d >>>= 33;
  console.log(a);
  console.log(b);
  console.log(c);
  console.log(d);
  return 0;
};
