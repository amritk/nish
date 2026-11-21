// --deny-panics reads `w & C` as [0, C] and `w >>> k` as [0, 2^(32-k) - 1]
// for a u32 `w`, and `toI32` keeps that range, so the `- 1` and `+ 1` below
// are `nsw` with no overflow check — even at the mask's top value.
const low = (w: u32): i32 => toI32(w & 16777215) - 1;

const high = (w: u32): i32 => toI32(w >>> 8) + 1;

export const main = (): number => {
  const top: u32 = 4294967295;
  console.log(low(top));
  console.log(low(toU32(0)));
  console.log(high(top));
  console.log(high(toU32(255)));
  return 0;
};
