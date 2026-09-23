// #106: a store to a field the path names drops the path's facts. The loop
// condition proves `i < h.xs.length`, and on the second pass the body puts a
// one-element array in `h.xs` before reading `h.xs[i]`. There is no call
// anywhere between the two, so only the store can take the fact away. Run by
// tests/run.js: exit 1 with "index out of range: 1 >= 1" on stderr, after "1"
// on stdout.
class Holder {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

export const main = (): number => {
  const h = new Holder([1, 2, 3]);
  const short = [7];
  let i = 0;
  while (i < h.xs.length) {
    if (i === 1) {
      h.xs = short;
    }
    const x = h.xs[i];
    console.log(`${x}`);
    i = i + 1;
  }
  return 0;
};
