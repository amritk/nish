// `h.xs[i] += (i = 2)`: a compound store checks before its value runs, so it is
// judged against the `i` it reads. Run by tests/run.js: exit 1 with
// "index out of range: 1000000 >= 3".
class Holder {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

const poke = (h: Holder, start: i32): i32 => {
  let i = start;
  if (h.xs.length >= 3) {
    h.xs[i] += (i = 2);
  }
  return i;
};

export const main = (): number => {
  console.log(`${poke(new Holder([1, 2, 3]), 1000000)}`);
  return 0;
};
