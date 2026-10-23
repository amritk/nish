// `new Array<T>(n)` is filled with T's zero, and `dst.set(src, at)` copies
// into the array in place.
export const main = (): number => {
  const n: i32 = 4;
  const xs = new Array<i32>(n);
  const big = new Array<i64>(2);
  const flags = new Array<boolean>(2);
  const bytes: u8[] = new Array<u8>(6);
  const src: u8[] = [1, 2, 3];
  bytes.set(src, 2);
  console.log(`${xs[3]} ${big[1]} ${flags[0]} ${bytes[0]} ${bytes[2]} ${bytes[4]} ${bytes[5]}`);
  return 0;
};
