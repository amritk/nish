// A later `&&` operand's field store kills an earlier operand's path fact, with
// no call anywhere in the condition. Run by tests/run.js: exit 1 with
// "index out of range: 5 >= 1".
class Holder {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

const read = (h: Holder, short: i32[], i: i32): i32 => {
  if (i >= 0 && i < h.xs.length && (h.xs = short).length > 0) {
    return h.xs[i];
  }
  return -1;
};

export const main = (): number => {
  console.log(`${read(new Holder([1, 2, 3, 4, 5, 6]), [7], 5)}`);
  return 0;
};
