// WP15 §2.4: two call sites, and only one proves the range. `at` is called once with an index its caller
// proves and once with one nobody does, so its entry facts are the join of the
// two — nothing — and it keeps its check. The second call panics with
// `index out of range: 5 >= 3` after the first has printed.
const at = (xs: i32[], i: i32): i32 => xs[i];

export const main = (): number => {
  const xs = [7, 8, 9];
  let i = 0;
  while (i < xs.length) {
    console.log(`${at(xs, i)}`);
    i = i + 1;
  }
  console.log(`${at(xs, i + 2)}`);
  return 0;
};
