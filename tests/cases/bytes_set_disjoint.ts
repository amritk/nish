// WP34 N2: `dst.set(src, at)` between two arrays the checker proves distinct —
// two `const`s, each bound to a fresh literal — copies with `llvm.memcpy`, and
// so does a literal handed straight to `set`. In f64 mode with a `main`, so the
// unmodified-Node run compares the output too.
const show = (xs: u8[]): string => {
  const parts: string[] = [];
  for (const x of xs) {
    parts.push(`${x}`);
  }
  return parts.join(" ");
};

export const main = (): i32 => {
  const dst: u8[] = [0, 0, 0, 0, 0, 0];
  const src: u8[] = [1, 128, 255];
  dst.set(src, 2);
  console.log(show(dst));
  dst.set(src);
  console.log(show(dst));
  dst.set([7, 7]);
  console.log(show(dst));
  return 0;
};
