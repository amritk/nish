// NL2223: An object literal's keys are identifiers, because the key is the field slot.
interface Point {
  x: i32;
}

export const main = (): i32 => {
  const p: Point = { "x": 1 };
  return p.x;
};
