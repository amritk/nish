// --deny-panics accepts signed arithmetic the bounds walk proves fits: a loop
// counter below a length, and a value built from two bytes. Each is `nsw`
// with no check, so the IR has no overflow path.
const count = (xs: i32[]): i32 => {
  let n = 0;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] > 0) {
      n = i;
    }
  }
  return n;
};

const word = (hi: u8, lo: u8): i32 => toI32(hi) * 256 + toI32(lo);

export const main = (): number => {
  const xs: i32[] = [3, -1, 7];
  console.log(count(xs));
  console.log(word(toU8(1), toU8(2)));
  return 0;
};
