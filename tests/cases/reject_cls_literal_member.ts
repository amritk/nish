// An object literal sets fields; a method in one would be a function value.
export interface Point {
  x: number;
}

export const run = (): number => {
  const p: Point = { x: 1, scale(): number { return 2; } };
  return p.x;
};
