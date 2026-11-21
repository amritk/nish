// --deny-panics reads a named `const` mask as its value, so `x & MASK` on an
// i32 is [0, 255] whatever `x` holds and `+ 1` on it is `nsw` with no
// overflow check.
const MASK: i32 = 255;
const lowByte = (x: i32): i32 => (x & MASK) + 1;
export const main = (): number => {
  console.log(lowByte(-1));
  console.log(lowByte(4660));
  console.log(lowByte(-2147483648));
  return 0;
};
