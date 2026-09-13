// An object literal's keys are the field names, spelled as identifiers.
export interface Point {
  x: number;
}

export const run = (): number => {
  const p: Point = { "x": 1 };
  return p.x;
};
