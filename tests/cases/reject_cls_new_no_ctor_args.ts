// The class has no constructor, so `new` takes no arguments.
export class Point {
  x: number = 0;
}

export const make = (): number => {
  const p = new Point(1);
  return p.x;
};
