// WP29: an arrow written as the argument is lifted into a function of its own,
// `nish_main$arrow<n>`, and the call is instantiated for it like a named one.
// Every spelling: `x => ...`, `(x) => ...`, annotated, and a block body.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => {
  const a = apply(x => x + 1, 10);
  const b = apply((x) => x * 2, 10);
  const c = apply((x: i32): i32 => x - 3, 10);
  const d = apply((x) => {
    let n = 0;
    for (let i = 0; i < x; i++) {
      n = n + i;
    }
    return n;
  }, 10);
  console.log(`${a} ${b} ${c} ${d}`);
  return 0;
};
