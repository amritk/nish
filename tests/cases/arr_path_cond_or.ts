// The `||` form: where `i < 0 || i >= h.xs.length || h.shrink()` is false, all
// three operands ran, and the third popped the array. The early exit's facts
// have to survive it, and do not. Run by tests/run.js: exit 1 with
// "index out of range: 5 >= 1".
class Holder {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }

  shrink(): boolean {
    while (this.xs.length > 1) {
      this.xs.pop();
    }
    return false;
  }
}

const read = (h: Holder, i: i32): i32 => {
  if (i < 0 || i >= h.xs.length || h.shrink()) {
    return -1;
  }
  return h.xs[i];
};

export const main = (): number => {
  console.log(`${read(new Holder([1, 2, 3, 4, 5, 6]), 5)}`);
  return 0;
};
