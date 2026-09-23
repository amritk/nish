// `h.xs[i] = (i = 0)`: the store reads `i` before the value and checks after
// it, so the proof must not be taken in the state the value left behind, where
// `i` is 0. Run by tests/run.js: exit 1 with
// "index out of range: 1000000 >= 3". Proven, it wrote a million slots past
// the array.
class Holder {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

const poke = (h: Holder, start: i32): i32 => {
  let i = start;
  if (h.xs.length >= 1) {
    h.xs[i] = (i = 0);
  }
  return i;
};

export const main = (): number => {
  console.log(`${poke(new Holder([1, 2, 3]), 1000000)}`);
  return 0;
};
