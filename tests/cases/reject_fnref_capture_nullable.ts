// WP51 stage 2: an arrow that calls a nullable reference of the function
// around it is refused until a test narrows it, as a direct call is.
type F = (x: i32) => i32;
const sq = (x: i32): i32 => x * x;
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);
const pick = (n: i32): F | null => (n > 0 ? sq : null);
export const main = (): i32 => {
  const h: F | null = pick(1);
  return apply((y: i32): i32 => h(y) + 1, 3);
};
