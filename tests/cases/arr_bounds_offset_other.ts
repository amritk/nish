// A guard on `xs.length` says nothing about `ys`: `ys[i + 1]` keeps its check
// and panics on the pass where `ys` is shorter, with `index out of range: 2 >= 2`.
const mixed = (xs: i32[], ys: i32[]): i32 => {
  let s = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    s = s + xs[i + 1] + ys[i + 1];
  }
  return s;
};

export const main = (): number => {
  console.log(`${mixed([1, 2, 3, 4], [5, 6])}`);
  return 0;
};
