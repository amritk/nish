// WP33 NL8008, quiet: `>>>` on a u32 reads back unsigned in both readings, and
// `>>` on an i32 is a sign-filling shift in both.
export const main = (): number => {
  const bits: u32 = 4294967288;
  const half: u32 = bits >>> 1;
  const x: i32 = -8;
  const signed: i32 = x >> 1;
  console.log(toI32(half));
  console.log(signed);
  return 0;
};
