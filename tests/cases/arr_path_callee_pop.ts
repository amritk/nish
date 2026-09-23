// #106: a property-path length fact dies at a call. The loop condition proves
// `i < h.xs.length` on the way in, and `drain` pops the field's array through
// the same `Holder`, so the fact has to go at the call and `h.xs[i]` keeps its
// check. Run by tests/run.js: exit 1 with "index out of range: 1 >= 1" on
// stderr, after "2 1" on stdout. Kept, the fact would read past `len`.
//
// This is `arr_bounds_shrink_panic` with the array in a field rather than a
// local, and it is the rule `FunctionFacts.resizesArray` would have answered if
// the fixpoint ran before the checker. It does not, so every call counts.
class Holder {
  xs: i32[];
  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

const drain = (h: Holder): i32 => {
  h.xs.pop();
  return h.xs.length;
};

export const main = (): number => {
  const h = new Holder([1, 2, 3]);
  let i = 0;
  while (i < h.xs.length) {
    const left = drain(h);
    const x = h.xs[i];
    console.log(`${left} ${x}`);
    i = i + 1;
  }
  return 0;
};
