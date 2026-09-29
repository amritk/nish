// WP33 NL8008: `>>>` on an i32 is `lshr` here and the bits read back as a
// signed i32, where TypeScript reads the same bits as an unsigned number: -8
// >>> 1 is 2147483644 in both, but -8 >>> 0 is -8 here and 4294967288 there.
export const main = (): number => {
  const x: i32 = -8;
  const same: i32 = x >>> 0;
  let y: i32 = -1;
  y >>>= 4;
  console.log(same);
  console.log(y);
  return 0;
};
