// WP33 R2: `push` and `pop` are refused only on a receiver spelled with a
// typed-array name. `f64[]` keeps both, and a `Float64Array` value that flows
// into a binding or a parameter spelled `f64[]` may be grown there: the rule
// follows the spelling the program wrote, and the IR is the `f64[]` one.
const grow = (xs: f64[], v: f64): void => {
  xs.push(v);
};

export const main = (): number => {
  const t = new Float64Array(2);
  t[0] = 1.5;
  t[1] = 2.5;
  const a: f64[] = t;
  a.push(3.5);
  grow(t, 4.5);
  const last = a.pop();
  console.log(last);
  console.log(t.length);
  return 0;
};
