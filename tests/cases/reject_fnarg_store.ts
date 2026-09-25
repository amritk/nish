// WP29: a function parameter names a callee and is never a value, so it
// cannot be stored in a local (wp23 §6, the rule wp22 §5 states for a name).
const apply = (f: (x: i32) => i32, x: i32): i32 => {
  const g = f;
  return x;
};

const square = (x: i32): i32 => x * x;

export const main = (): i32 => apply(square, 2);
