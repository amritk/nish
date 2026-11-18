// NL2597: A parameter after one with a default has a default too.
const f = (x: i32 = 1, y: i32): i32 => {
  return x + y
};
export const main = (): void => {
  console.log(f(1, 2))
};
