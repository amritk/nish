// --deny-panics reads `x & 255` on an i32 as [0, 255] whatever `x` holds, a
// negative `x` included, so `+ 1` on it is `nsw` with no overflow check.
const lowByte = (x: i32): i32 => (x & 255) + 1;
export const main = (): number => {
  console.log(lowByte(-1));
  console.log(lowByte(4660));
  console.log(lowByte(-2147483648));
  return 0;
};
