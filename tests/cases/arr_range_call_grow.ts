// WP15 §2.4: a recursion whose bound grows. `visit(xs, 0)` is proven, but
// `visit` calls itself with `j = i + 1`, which has a floor and no upper bound,
// so the join of the two sites leaves `i >= 0` and `xs.length >= 1` and
// nothing that bounds `i` from above: the check stays, and the fourth call
// panics with `index out of range: 3 >= 3`.
const visit = (xs: i32[], i: i32): i32 => {
  console.log(`${xs[i]}`);
  if (i < 10) {
    const j = i + 1;
    return visit(xs, j);
  }
  return 0;
};

export const main = (): number => {
  const xs = [1, 2, 3];
  if (xs.length > 0) {
    visit(xs, 0);
  }
  return 0;
};
