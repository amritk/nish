// Too few or too many arguments for a signature with defaults or a rest.
const f = (x: i32, y: i32 = 2): i32 => {
  return x + y
};
const g = (x: i32, ...rest: i32[]): i32 => {
  return x + rest.length
};
export const main = (): void => {
  console.log(f())
  console.log(f(1, 2, 3))
  console.log(g())
};
