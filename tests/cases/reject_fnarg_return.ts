// WP29: nor returned, which would hand a function value to the caller.
const pick = (f: (x: i32) => i32): i32 => {
  return f;
};

const square = (x: i32): i32 => x * x;

export const main = (): i32 => pick(square);
