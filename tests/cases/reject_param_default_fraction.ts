// A default is a value of the parameter's type: `0.5` is no `i32`.
const f = (x: i32, y: i32 = 0.5): i32 => {
  return x + y
};
export const main = (): void => {
  console.log(f(1))
};
