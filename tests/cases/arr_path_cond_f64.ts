// The `&&` shape under `--number-mode f64`, where the length is compared
// through `toI32`. Run by tests/run.js through `tests/driver.c`: exit 1 with
// "index out of range: 5 >= 1". It exports `test` rather than `main` because
// an f64 program with an entry point is also run as-is under Node, where the
// read past the array is `undefined` rather than a panic.
class Holder {
  xs: f64[];
  constructor(xs: f64[]) {
    this.xs = xs;
  }

  trim(): boolean {
    while (this.xs.length > 1) {
      this.xs.pop();
    }
    return true;
  }
}

const read = (h: Holder, i: i32): f64 => {
  if (i >= 0 && i < toI32(h.xs.length) && h.trim()) {
    return h.xs[i];
  }
  return -1;
};

export const test = (): i32 => toI32(read(new Holder([1, 2, 3, 4, 5, 6]), 5));
