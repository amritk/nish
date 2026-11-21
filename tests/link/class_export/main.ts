import { Point, Size, area } from "./shapes";

const origin = (): Point => {
  return new Point(0, 0);
};

export const main = (): number => {
  const p = origin().shifted(5);
  console.log(p.x);
  const s: Size = { width: p.x, height: 3 };
  console.log(area(s));
  return p.x + p.y;
};
