// A default is a number, a boolean, a string or an enum member.
const f = (x: i32, ys: i32[] = []): i32 => {
  return x + ys.length
};
export const main = (): void => {
  console.log(f(1))
};
