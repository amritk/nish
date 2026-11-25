// --deny-panics proves more range shapes a guard pins: a slice ended by
// `const j = i + 1`, which records `i <= j` while a later guard bounds `j`,
// `String.fromBytes` to a literal bound the length check
// covers, `dst.set(src)` with no offset, a one-argument `xs.slice(a)`, and a
// constant range of an array literal whose length is known.
const pair = (xs: i32[], i: i32): i32[] => {
  if (i >= 0 && i < xs.length) {
    const j = i + 1;
    if (j <= xs.length) {
      return xs.slice(i, j);
    }
  }
  return [];
};

const head = (buf: u8[]): string => {
  if (buf.length >= 2) {
    return String.fromBytes(buf, 0, 2);
  }
  return "";
};

const fill = (dst: u8[], src: u8[]): void => {
  if (src.length <= dst.length) {
    dst.set(src);
  }
};

const from = (xs: i32[], a: i32): i32[] => {
  if (a >= 0 && a <= xs.length) {
    return xs.slice(a);
  }
  return [];
};

export const main = (): number => {
  const xs: i32[] = [3, 1, 2];
  console.log(`${xs.slice(1, 2).length}`);
  const p = pair(xs, 2);
  if (p.length > 0) {
    console.log(p[0]);
  }
  const b: u8[] = [104, 105, 33];
  console.log(head(b));
  const d: u8[] = [0, 0, 0, 0];
  fill(d, b);
  if (d.length > 2) {
    console.log(d[2]);
  }
  console.log(from(xs, 1).length);
  return 0;
};
