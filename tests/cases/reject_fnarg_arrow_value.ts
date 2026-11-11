// WP29: an arrow is legal as the argument for a function-typed parameter;
// bound to a local it is a value, which WP51 stage 1 does not lift yet.
export const main = (): i32 => {
  const inc = (x: i32): i32 => x + 1;
  return 0;
};
