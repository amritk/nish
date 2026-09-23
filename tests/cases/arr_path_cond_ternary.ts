// The same condition as a ternary's test: its true arm is reached only after
// `trim` has popped. Run by tests/run.js: exit 1 with
// "index out of range: 5 >= 1".
class Holder {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }

  trim(): boolean {
    while (this.xs.length > 1) {
      this.xs.pop();
    }
    return true;
  }
}

const read = (h: Holder, i: i32): i32 => (i >= 0 && i < h.xs.length && h.trim() ? h.xs[i] : -1);

export const main = (): number => {
  console.log(`${read(new Holder([1, 2, 3, 4, 5, 6]), 5)}`);
  return 0;
};
