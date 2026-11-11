// WP51 stage 2: a reference argument is read at each call the arrow makes,
// so an argument that calls a function as it is read is refused (NL2734).
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
