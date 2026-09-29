// WP33 NL8008: a `>>>` count that is not a constant, or is a constant that is
// 0 mod 32, can leave the sign bit set, so the i32 result reads back signed
// here and unsigned in TypeScript: -8 >>> 32 is -8 here and 4294967288 there.
const NONE: i32 = 0;

const shift = (x: i32, n: i32): i32 => x >>> n;

export const main = (): number => {
  let y: i32 = -8;
  y >>>= 32;
  const z: i32 = y >>> NONE;
  console.log(shift(-8, 1));
  console.log(y);
  console.log(z);
  return 0;
};
