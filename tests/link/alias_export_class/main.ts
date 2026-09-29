// An imported alias of a class the exporter declares: `Pt` is `Point` here,
// so it is a parameter type, a return type, a local and an array element, and
// a `Point` from `new` passes where a `Pt` is declared.
import { at, Point, Pt } from "./shapes";

const manhattan = (p: Pt): i32 => p.x + p.y;

const mirror = (p: Pt): Pt => at(p.y, p.x);

export const main = (): number => {
  const points: Pt[] = [at(1, 2), new Point(3, 4)];
  let total = 0;
  for (const p of points) {
    total = total + manhattan(mirror(p));
  }
  const q: Point = mirror(points[0]);
  console.log(`${total} ${q.x} ${q.y}`);
  return total === 10 ? 0 : 1;
};
