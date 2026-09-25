// WP29: an arrow is legal only as the argument for a function-typed
// parameter; bound to a local it would be a function value.
export const main = (): i32 => {
  const inc = (x: i32): i32 => x + 1;
  return 0;
};
