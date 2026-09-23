// #106: a second holder shares the array and shrinks it. `h` and `g` are two
// `Holder`s around one array, the loop proves `i < h.xs.length`, and on the
// second pass it pops twice through `g`. Nothing in the loop names `h`, so a
// fact keyed by `h.xs` alone would survive; the `pop`s are calls, and a call
// drops every path. Run by tests/run.js: exit 1 with
// "index out of range: 1 >= 1" on stderr, after "1" on stdout.
//
// `arr_path_alias_store` is the same alias reached by a store rather than a
// call.
class Holder {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

export const main = (): number => {
  const shared = [1, 2, 3];
  const h = new Holder(shared);
  const g = new Holder(shared);
  let i = 0;
  while (i < h.xs.length) {
    if (i === 1) {
      g.xs.pop();
      g.xs.pop();
    }
    const x = h.xs[i];
    console.log(`${x}`);
    i = i + 1;
  }
  return 0;
};
