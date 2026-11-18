// A function-typed parameter's own parameters take no default or rest (#1115).
const apply = (g: (a: i32, b: i32 = 1) => i32): i32 => {
  return g(1, 2)
};
export const main = (): void => {
  console.log(apply((a: i32, b: i32): i32 => a + b))
};
