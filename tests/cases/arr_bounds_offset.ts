// An offset index `xs[i + c]` is proved by a guard on the sum: `i + 3 <
// xs.length` reaches three past `i`, so a loop that reads four elements a pass
// keeps none of its four checks. The sum is checked, so it is exact, and
// `i >= 0` keeps it non-negative. Each function keeps no bounds check but
// `passed`, whose first access is the one that proves the other two.
const sum4 = (xs: i32[]): i32 => {
  let s = 0;
  for (let i = 0; i + 3 < xs.length; i = i + 4) {
    s = s + xs[i] + xs[i + 1] + xs[i + 2] + xs[i + 3];
  }
  return s;
};

// A hoisted length that bounds two arrays: `i + 1 < n` reaches one past `i`
// in both, through `n <= xs.length` and `n <= ys.length`.
const pairs = (xs: i32[], ys: i32[]): i32 => {
  const n = xs.length;
  if (ys.length < n) {
    return 0;
  }
  let s = 0;
  for (let i = 0; i + 1 < n; i++) {
    s = s + xs[i + 1] - ys[i];
  }
  return s;
};

// A non-strict guard reaches one less: `i + 2 <= xs.length` is `i + 1 < xs.length`.
const window2 = (xs: i32[]): i32 => {
  let s = 0;
  for (let i = 0; i + 2 <= xs.length; i++) {
    s = s + xs[i] * xs[i + 1];
  }
  return s;
};

// A literal bound and an array of known size: `i + 2 < 8` is `i < 6`, and
// `6 + 2` is the literal's length.
const tail = (): i32 => {
  const t = [1, 2, 3, 4, 5, 6, 7, 8];
  let s = 0;
  for (let i = 0; i + 2 < 8; i++) {
    s = s + t[i + 2];
  }
  return s;
};

// A passed `xs[i + 2]` leaves `i + 2 < xs.length` behind, and with `i >= 0`
// that proves `xs[i + 1]` and `xs[i]`. The caller passes `xs.length - 3`, so
// the entry state knows `i < xs.length` and nothing further: the first
// access keeps its check, and it is the one that proves the other two.
const passed = (xs: i32[], i: i32): i32 => {
  if (i < 0) {
    return 0;
  }
  return xs[i + 2] + xs[i + 1] + xs[i];
};

export const main = (): number => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const ys = [9, 8, 7, 6, 5, 4, 3, 2, 1];
  console.log(`${sum4(xs)}`);
  console.log(`${pairs(xs, ys)}`);
  console.log(`${window2(xs)}`);
  console.log(`${tail()}`);
  console.log(`${passed(xs, xs.length - 3)}`);
  return 0;
};
