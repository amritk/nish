// A later `&&` operand that reassigns the path's root kills the path fact the
// earlier operand proved. Run by tests/run.js: exit 1 with
// "index out of range: 5 >= 1".
class Holder {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

const read = (a: Holder, b: Holder, i: i32): i32 => {
  let h = a;
  if (i >= 0 && i < h.xs.length && (h = b) === b) {
    return h.xs[i];
  }
  return -1;
};

export const main = (): number => {
  console.log(`${read(new Holder([1, 2, 3, 4, 5, 6]), new Holder([7]), 5)}`);
  return 0;
};
