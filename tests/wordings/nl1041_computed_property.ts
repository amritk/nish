// NL1041: An object literal's keys are names, because each key is a field slot fixed at compile time.
interface Point {
  x: i32;
}

export const main = (): i32 => {
  const k: string = "x";
  const p: Point = { [k]: 1 };
  return p.x;
};
