// An object spread copies a declared class's or interface's fields one by one;
// a number has none, and Node would copy nothing at all from it.
interface Point {
  x: i32;
}

export const main = (): i32 => {
  const a: i32 = 1;
  const p: Point = { ...a, x: 2 };
  return p.x;
};
