// WP51 stage 2: a reference local passed for a function parameter is read
// once every argument has run, so a later argument that assigns it would
// change which function the callee sees; JavaScript reads it first.
type F = (x: i32) => i32;
const sq = (x: i32): i32 => x * x;
const plus1 = (x: i32): i32 => x + 1;
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);
const k = (f: F): i32 => f(1);
export const main = (): i32 => {
  let r: F = sq;
  return apply(r, k((r = plus1)));
};
