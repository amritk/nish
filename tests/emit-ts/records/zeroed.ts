// `new Array<T>(n)` is filled with T's zero, and `dst.set(src, at)` copies
// into the array in place; a map's `set` is left as it is.
class Tag {}

export const main = (): number => {
  const n: i32 = 4;
  const xs = new Array<i32>(n);
  const big = new Array<i64>(2);
  const flags = new Array<boolean>(2);
  const bytes: u8[] = new Array<u8>(6);
  const src: u8[] = [1, 2, 3];
  bytes.set(src, 2);
  const tag = new Tag();
  const seen = new Map<Tag, i32>();
  seen.set(tag, 7);
  console.log(`${xs[3]} ${big[1]} ${flags[0]} ${bytes[0]} ${bytes[2]} ${bytes[4]} ${bytes[5]} ${seen.get(tag) ?? 0}`);
  return 0;
};
