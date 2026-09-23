// A loop condition whose second operand pops: `while (i < h.xs.length &&
// step(h, i))`. The body runs after `step`, which on the second pass drains the
// array to one element, so the first operand's fact cannot be the body's. Run
// by tests/run.js: exit 1 with "index out of range: 1 >= 1", after "1" on
// stdout.
class Holder {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

const step = (h: Holder, i: i32): boolean => {
  if (i === 1) {
    h.xs.pop();
    h.xs.pop();
    h.xs.pop();
  }
  return true;
};

export const main = (): number => {
  const h = new Holder([1, 2, 3, 4]);
  let i = 0;
  while (i < h.xs.length && step(h, i)) {
    console.log(`${h.xs[i]}`);
    i = i + 1;
  }
  return 0;
};
