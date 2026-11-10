// NL2709: A field set by name and then always overwritten by a later spread is
// TypeScript's TS2783; the name was dead, so it is refused.
interface Point {
  x: i32;
  y: i32;
}

export const main = (): i32 => {
  const a: Point = { x: 1, y: 2 };
  const p: Point = { x: 5, ...a };
  return p.x;
};
