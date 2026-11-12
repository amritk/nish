// NL2743: a reference local passed for a function parameter that a later
// argument of the same call assigns.
type F = (x: i32) => i32;

const sq = (x: i32): i32 => x * x;
const inc = (x: i32): i32 => x + 1;

const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);
const k = (f: F): i32 => f(1);

export const main = (): i32 => {
  let h: F = sq;
  return apply(h, k((h = inc)));
};
