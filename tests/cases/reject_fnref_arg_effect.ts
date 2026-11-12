// WP51 stage 2: an element passed for a function parameter would be read
// again at each call the callee makes, so it is refused (NL2759), here where
// reading it also calls a function.
type F = (x: i32) => i32;

const inc = (x: i32): i32 => x + 1;
const dbl = (x: i32): i32 => x * 2;

class Box {
  n: i32 = 0;
}

const next = (b: Box): i32 => {
  b.n = b.n + 1;
  return 0;
};

const twice = (f: (x: i32) => i32, x: i32): i32 => f(f(x));

export const main = (): void => {
  const ops: F[] = [inc, dbl];
  const b = new Box();
  console.log(`${twice(ops[next(b)], 1)} ${b.n}`);
};
