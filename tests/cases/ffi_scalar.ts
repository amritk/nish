// WP27 S1: a C function this program calls but does not define. `abs` and
// `labs` come from libc, so the golden below is also a link test: the `declare`
// carries no attributes, and the caller loses `readnone` and `willreturn` while
// a function that calls no C keeps both.
declare function abs(n: i32): i32;
declare function labs(n: i64): i64;

function pureDouble(n: i32): i32 {
  return n * 2;
}

function callsC(n: i32): i32 {
  return abs(n) + 1;
}

export function main(): i32 {
  const wide: i64 = -5;
  const back: i64 = labs(wide);
  console.log(`${callsC(-7)}`);
  console.log(`${pureDouble(3)}`);
  return back === 5 ? 0 : 1;
}
