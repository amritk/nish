// The constructor sibling of `arr_bounds_range_call`: a `new` is a call, so a
// constructor that takes an element off `xs` while the index is computed
// leaves a shorter array than the 16 it was made with. The check stays, and
// with `r = 15` the access panics with `index out of range: 15 >= 15`.
class Shrinker {
  zero: i32;
  constructor(xs: i32[]) {
    xs.pop();
    this.zero = 0;
  }
}

export const main = (): number => {
  const xs = new Array<i32>(16);
  let total = 0;
  for (let r = 0; r < 16; r++) {
    total = total + xs[r + new Shrinker(xs).zero];
    xs.push(0);
  }
  console.log(`${total}`);
  return 0;
};
