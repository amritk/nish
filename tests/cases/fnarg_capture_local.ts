// A capture is an extra parameter, not part of the instantiation key: the two
// calls of `apply` with different `step`s share one `apply$fn...` per arrow,
// and a capture forwarded through `twice` to `apply` travels as a parameter of
// each instantiation on the way. A loop's `const` is captured like any other.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

const twice = (f: (x: i32) => i32, x: i32): i32 => apply(f, apply(f, x));

const offset = (step: i32, x: i32): i32 => apply((v) => v + step, x);

export const main = (): i32 => {
  const step = 3;
  console.log(`${apply((x) => x + step, 2)}`);
  console.log(`${offset(10, 1)} ${offset(20, 1)}`);
  for (const k of [2, 5]) console.log(`${twice((x) => x * k + step, 1)}`);
  return 0;
};
