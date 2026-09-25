// WP15 §2.4: a call from a generic function's body. An instantiation has side
// tables of its own and is not walked with a state, so a function it calls is
// entered knowing nothing: `at9(1)` is proven at its own site, and `via`'s call
// with 9 still reaches a check, which panics with `index out of range: 9 >= 3`.
const at9 = (i: i32): i32 => {
  const xs = [1, 2, 3];
  return xs[i];
};

const via = <T>(x: T, i: i32): i32 => at9(i);

export const main = (): number => {
  console.log(`${at9(1)}`);
  console.log(`${via("a", 9)}`);
  return 0;
};
