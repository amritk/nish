// A rest parameter has an array type.
const f = (...xs: i32): i32 => {
  return xs
};
export const main = (): void => {
  console.log(f(1))
};
