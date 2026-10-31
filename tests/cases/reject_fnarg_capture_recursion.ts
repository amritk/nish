// Each recursive call makes a new arrow, so a new instantiation of `loop`:
// the instantiation limit stops it, as it stops any unbounded recursion.
const loop = (n: i32, f: (x: i32) => i32): i32 => {
  if (n === 0) return f(0);
  return loop(n - 1, (x) => x + n) + f(n);
};
export const main = (): i32 => {
  console.log(`${loop(3, (x) => x)}`);
  return 0;
};
