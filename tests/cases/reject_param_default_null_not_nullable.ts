// `null` is a default only of a parameter whose type is a `T | null`.
class Point {
  x: i32 = 0
}
const f = (p: Point = null): i32 => {
  return p.x
};
export const main = (): void => {
  console.log(f())
};
