// A passed check is forgotten at a call: a callee holding the same array may
// `pop` it. Every access after `touch` keeps its check. In `storeCall` the
// value's `xs[j]` is checked before `touch` runs, so the `xs[j]` after the
// store is checked again, and on a path the store itself learns nothing: its
// check passed on the array `this.v` named before `replace` rebound it.
const touch = (xs: i32[]): i32 => {
  if (xs.length > 8) {
    xs.pop();
  }
  return 1;
};

const afterCall = (xs: i32[], i: i32): i32 => {
  const a = xs[i];
  touch(xs);
  return a + xs[i];
};

const storeCall = (xs: i32[], i: i32, j: i32): i32 => {
  xs[i] = xs[j] + touch(xs);
  return xs[j];
};

class Box {
  v: i32[];

  constructor() {
    this.v = [1, 2, 3, 4];
  }

  replace(): i32 {
    this.v = [5, 6, 7, 8];
    return 10;
  }

  storeReplaced(i: i32): i32 {
    this.v[i] = this.replace();
    return this.v[i];
  }
}

export const test = (): number => {
  const b = new Box();
  return afterCall([1, 2, 3], 2) + storeCall([1, 2, 3], 0, 1) + b.storeReplaced(1);
};
