// NL2708: A spread copies its source's fields into the target's layout, so the literal
// needs a declared class or interface type to copy into.
interface Point {
  x: i32;
}

export const main = (): i32 => {
  const a: Point = { x: 1 };
  const p = { ...a };
  return p.x;
};
