// `for...in` walks an object's property names, and a Nish value has none to
// walk: its layout is fixed when it is compiled. Phase 0 refuses the loop by
// that rule, whatever it is over.
export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  let n: i32 = 0;
  for (const i in xs) {
    n = n + 1;
  }
  return n;
};
