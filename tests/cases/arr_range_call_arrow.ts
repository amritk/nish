// WP15 §2.4: a call from an arrow argument. The arrow is lifted into a function
// the instantiation of `apply` calls, which the walk never enters with a state,
// so `at9` is entered knowing nothing whatever its other call site proves. The
// call through `apply` panics with `index out of range: 9 >= 3`.
const at9 = (i: i32): i32 => {
  const xs = [1, 2, 3];
  return xs[i];
};

const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): number => {
  console.log(`${at9(1)}`);
  console.log(`${apply((k) => at9(k), 9)}`);
  return 0;
};
