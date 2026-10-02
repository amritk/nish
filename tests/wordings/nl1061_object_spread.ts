// NL1061: An object literal sets each field by name; spread would copy a layout it cannot see.
interface Point {
  x: i32;
}

export const main = (): i32 => {
  const a: Point = { x: 1 };
  const p: Point = { ...a };
  return p.x;
};
