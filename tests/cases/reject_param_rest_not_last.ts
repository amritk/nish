// A rest parameter is the last one.
const f = (...xs: i32[], y: i32): i32 => {
  return xs.length + y
};
export const main = (): void => {
  console.log(f(1, 2))
};
