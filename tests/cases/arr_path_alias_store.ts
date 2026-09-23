// #106: a store through a second holder of the same object. `g` is `h` under
// another name, so `g.xs = short` replaces the array `h.xs` reads with no
// mention of `h` and no call. The path fact is dropped by the field's *name*,
// whatever holder the store goes through, which is what catches an alias the
// walk cannot see. Run by tests/run.js: exit 1 with
// "index out of range: 1 >= 1" on stderr, after "1" on stdout.
class Holder {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

export const main = (): number => {
  const h = new Holder([1, 2, 3]);
  const g = h;
  const short = [7];
  let i = 0;
  while (i < h.xs.length) {
    if (i === 1) {
      g.xs = short;
    }
    const x = h.xs[i];
    console.log(`${x}`);
    i = i + 1;
  }
  return 0;
};
