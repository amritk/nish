// Panic sites: an operation the bounds walk proves fits is `nsw` with no
// check, so its `overflow` site is listed proven and the function has no panic
// path: `i++` under `i < xs.length`, and `hi * 256 + lo` on bytes.
const parity = (xs: i32[]): i32 => {
  let p: i32 = 0;
  for (let i: i32 = 0; i < xs.length; i++) {
    p = p ^ i;
  }
  return p;
};

const word = (hi: u8, lo: u8): i32 => toI32(hi) * 256 + toI32(lo);

export const main = (): number => {
  console.log(parity([1, 2, 3, 4, 5]));
  console.log(word(toU8(1), toU8(2)));
  return 0;
};
