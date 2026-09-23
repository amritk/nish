// #181 for `do/while`: a `continue` jumps to the condition. The guard proves
// `i < h.xs.length`, and on the second pass `shrink` replaces `h.xs` with a
// one-element array before `continue`, so the condition reads `h.xs[3]` from
// it. The walk used to judge the condition in the end-of-body state, where the
// fact still held, and the read went out unchecked. Run by tests/run.js: exit 1
// with "index out of range: 3 >= 1" on stderr.
class H {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

const shrink = (h: H): void => {
  h.xs = [5];
};

export const main = (): number => {
  const h = new H([1, 2, 3, 4]);
  let n = 0;
  let i = 0;
  do {
    n = n + 1;
    if (n === 1) {
      i = 3;
    }
    if (i < 0 || i >= h.xs.length) {
      break;
    }
    if (n === 2) {
      shrink(h);
      continue;
    }
  } while (h.xs[i] > 0 && n < 5);
  console.log(`n=${n}`);
  return 0;
};
