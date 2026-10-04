// --deny-panics refuses every unproven signed operator, each with the hint
// that names its drop-in `nish:unsafe` form and the unsigned type of its
// width: unary `-` on `i32` and `i64`, `++`, `--`, `-=` and `*=`.
export const negate = (a: i32): i32 => -a;

export const negateWide = (a: i64): i64 => -a;

export const step = (a: i32): i32 => {
  let x = a;
  x++;
  return x;
};

export const back = (a: i32): i32 => {
  let x = a;
  x--;
  return x;
};

export const less = (a: i32, b: i32): i32 => {
  let x = a;
  x -= b;
  return x;
};

export const scale = (a: i64, b: i64): i64 => {
  let x = a;
  x *= b;
  return x;
};
