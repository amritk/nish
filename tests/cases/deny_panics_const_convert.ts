// --deny-panics reads a conversion of a literal that fits its target as the
// literal: `toI32(7)`, `toU32(3)`, `toI64(5)` and `toU8(200)` divide with no
// zero test. A function-level `const` is read as its value as a mask and as a
// shift count, so the `- 1` and `+ 1` below are `nsw` with no overflow check.

const divI32 = (a: i32): i32 => a / toI32(7);

const remU32 = (a: u32): u32 => a % toU32(3);

const divI64 = (a: i64): i64 => a / toI64(5);

const remU8 = (a: u8): u8 => a % toU8(200);

const lowByte = (w: u32): i32 => {
  const mask: u32 = 255;
  return toI32(w & mask) - 1;
};

const topByte = (w: u32): i32 => {
  const shift: u32 = 24;
  return toI32(w >>> shift) + 1;
};

export const main = (): number => {
  const top: u32 = 4294967295;
  console.log(divI32(-50));
  console.log(toI32(remU32(toU32(17))));
  console.log(toI32(divI64(toI64(-26))));
  console.log(toI32(remU8(toU8(255))));
  console.log(lowByte(top));
  console.log(lowByte(toU32(256)));
  console.log(topByte(top));
  console.log(topByte(toU32(0)));
  return 0;
};
