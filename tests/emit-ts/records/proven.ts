// An index the loop proves in range keeps its plain `a[i]`; the one a
// parameter supplies, from an element no caller proves, is checked.
const sum = (xs: i32[]): i32 => {
  let t = 0;
  for (let i = 0; i < xs.length; i++) {
    t += xs[i];
  }
  return t;
};

const at = (xs: i32[], i: i32): i32 => xs[i];

export const main = (): number => {
  const xs = [1, 2, 3, 4];
  const ks = [2];
  console.log(`${sum(xs)} ${at(xs, ks[0])}`);
  return 0;
};
