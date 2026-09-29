// WP34 N2: every `set` the checker cannot prove disjoint is an `llvm.memmove`,
// because `TypedArray.prototype.set` copies as if the source were read first.
// A self-copy is the overlap a program can spell; a parameter and a `let` are
// the two ways a program hides whether the arrays differ. In f64 mode with a
// `main`, so the unmodified-Node run compares the output too.
const show = (xs: u8[]): string => {
  const parts: string[] = [];
  for (const x of xs) {
    parts.push(`${x}`);
  }
  return parts.join(" ");
};

const copyInto = (dst: u8[], src: u8[], at: number): void => {
  dst.set(src, at);
};

export const main = (): i32 => {
  const a: u8[] = [1, 2, 3, 4];
  a.set(a);
  a.set(a, 0);
  console.log(show(a));
  const b: u8[] = [9, 8];
  copyInto(a, b, 1);
  console.log(show(a));
  copyInto(a, a, 0);
  console.log(show(a));
  let c: u8[] = [5];
  c = b;
  a.set(c, 2);
  console.log(show(a));
  return 0;
};
