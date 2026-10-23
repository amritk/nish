// A record put into an array is copied in, as the slot holds it inline: a
// write to the record afterwards leaves the element alone, and a write to
// the element leaves the record alone.
interface Point {
  x: i32;
  y: i32;
}

export const main = (): number => {
  const p: Point = { x: 1, y: 2 };
  const ps: Point[] = [];
  ps.push(p);
  p.x = 10;
  ps[0].y = 20;
  const qs: Point[] = [p, p];
  qs[1].x = 30;
  console.log(`${p.x} ${p.y} ${ps[0].x} ${ps[0].y} ${qs[0].x} ${qs[1].x}`);
  return 0;
};
