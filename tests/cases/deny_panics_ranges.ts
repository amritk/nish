// --deny-panics proves the range checks a guard pins: `new Array` of an `i32`
// known non-negative, `String.fromBytes`, a string's and an array's `slice`,
// `dst.set(src, 0)` and the window of `writeBytes`. Each proof drops its
// check from the IR, and the program builds with no panic site left.
const ranged = (n: integer<0, 1000>): u8[] => new Array<u8>(n);

const sized = (n: i32): u8[] => {
  if (n < 0) {
    return [];
  }
  return new Array<u8>(n);
};

const word = (buf: u8[], start: i32, end: i32): string => {
  if (start >= 0 && start <= end && end <= buf.length) {
    return String.fromBytes(buf, start, end);
  }
  return "";
};

// `const from = i` and the loop that only counts `i` up keep `from <= i`.
const lastWord = (buf: u8[]): string => {
  let i = 0;
  while (i < buf.length && buf[i] !== 32) {
    i += 1;
  }
  const from = i;
  while (i < buf.length) {
    i += 1;
  }
  if (i > buf.length) {
    return "";
  }
  return String.fromBytes(buf, from, i);
};

const copy = (dst: u8[], src: u8[]): void => {
  if (src.length <= dst.length) {
    dst.set(src, 0);
  }
};

const tail = (s: string, k: i32): string => {
  if (k >= 0 && k <= s.length) {
    return s.slice(k);
  }
  return "";
};

const middle = (xs: i32[], a: i32, b: i32): i32[] => {
  if (a >= 0 && a <= b && b <= xs.length) {
    return xs.slice(a, b);
  }
  return [];
};

const rest = (buf: u8[], off: i32): void => {
  if (off >= 0 && off <= buf.length) {
    writeBytes(buf, off, buf.length - off);
  }
};

export const main = (): number => {
  const b: u8[] = [104, 105, 32, 116, 104, 101, 114, 101, 10];
  console.log(ranged(5).length);
  console.log(sized(7).length);
  console.log(word(b, 3, 8));
  console.log(lastWord(b).length);
  const d = sized(12);
  copy(d, b);
  if (d.length > 0) {
    console.log(d[0]);
  }
  console.log(tail("hello", 2));
  const xs: i32[] = [1, 2, 3, 4];
  console.log(middle(xs, 1, 3).length);
  rest(b, 3);
  return 0;
};
