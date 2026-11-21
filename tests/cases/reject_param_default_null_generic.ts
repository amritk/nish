// A parameter of a type parameter's type has no one constant default, `null` included.
class Point {
  x: i32 = 0
}
const f = <T>(x: T, y: T | null = null): T => {
  return y !== null ? y : x
};
export const main = (): void => {
  console.log(f(new Point()).x)
};
