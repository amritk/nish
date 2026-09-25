// WP15 §2.4: an argument evaluated after the index rebinds the local the index
// was read from. `i` is 50 when it is passed and 0 once the next argument has
// run, so what the state says about `i` at the call is not about the value
// `pick` got: the site carries nothing for `a`, `pick` keeps its check, and the
// second call panics with `index out of range: 50 >= 3`.
const pick = (xs: i32[], a: i32, b: i32): i32 => xs[a] + b * 0;

export const main = (): number => {
  const xs = [1, 2, 3];
  let i = 50;
  console.log(`${pick(xs, 0, 0)}`);
  console.log(`${pick(xs, i, (i = 0))}`);
  return 0;
};
