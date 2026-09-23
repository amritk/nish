// #106: an assignment to the root drops every path rooted at it. The loop
// proves `i < h.xs.length`, then rebinds `h` to a holder of a one-element
// array; `h.xs` now names a different field of a different object. Run by
// tests/run.js: exit 1 with "index out of range: 1 >= 1" on stderr, after "1"
// on stdout.
class Holder {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

export const main = (): number => {
  const other = new Holder([7]);
  let h = new Holder([1, 2, 3]);
  let i = 0;
  while (i < h.xs.length) {
    if (i === 1) {
      h = other;
    }
    const x = h.xs[i];
    console.log(`${x}`);
    i = i + 1;
  }
  return 0;
};
