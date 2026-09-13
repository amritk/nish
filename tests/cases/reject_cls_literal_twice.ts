// A field is set once in an object literal: twice is a typo or a lost write.
export interface Point {
  x: number;
}

export const make = (): number => {
  const p: Point = { x: 1, x: 2 };
  return p.x;
};
