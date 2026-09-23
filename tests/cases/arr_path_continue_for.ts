// #181: a `continue` jumps to the `for` update with its branch's effects
// applied. The condition proves `i < h.xs.length`, the first pass replaces
// `h.xs` with a one-element array and sets `i = 7` before `continue`, and the
// update then writes `h.xs[7]`. The walk used to drop the `continue` branch at
// the `if` and judge the update in the end-of-body state, where the fact still
// held, so the store went out unchecked and wrote past the array. Run by
// tests/run.js: exit 1 with "index out of range: 7 >= 1" on stderr.
class H {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

export const main = (): number => {
  const h = new H([10, 20, 30, 40, 50, 60, 70, 80]);
  let n = 0;
  let i = 0;
  for (i = 0; i >= 0 && i < h.xs.length; h.xs[i] = 1000000) {
    n = n + 1;
    if (n === 1) {
      h.xs = [1];
      i = 7;
      continue;
    }
    if (n > 3) {
      break;
    }
  }
  console.log(`n=${n} i=${i}`);
  return 0;
};
