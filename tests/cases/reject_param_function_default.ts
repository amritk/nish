// A function parameter names the function a call passes; it has no default.
const twice = (x: i32): i32 => {
  return x * 2
};
const apply = (x: i32, g: (a: i32) => i32 = twice): i32 => {
  return g(x)
};
export const main = (): void => {
  console.log(apply(1, twice))
};
