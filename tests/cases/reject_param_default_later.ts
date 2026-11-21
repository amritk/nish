// A default names an earlier parameter only.
const f = (x: i32 = y, y: i32 = 2): i32 => {
  return x + y
};
export const main = (): void => {
  console.log(f())
};
