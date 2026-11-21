// A parameter of a type parameter's type has no one constant default.
const f = <T>(x: T, y: T = 0): T => {
  return x
};
export const main = (): void => {
  console.log(f(1))
};
