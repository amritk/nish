// #646: `q` aliases the element reference `p`, so it points into `ps`'s
// storage too, and the pushes may move that storage before `q` is read.
interface P {
  x: i32;
}
const readX = (p: P): i32 => p.x;

export const main = (): i32 => {
  const ps: P[] = [];
  for (let i: i32 = 0; i < 4; i++) {
    ps.push({ x: 1 });
  }
  const p = ps[0];
  const q = p;
  for (let i: i32 = 0; i < 1000; i++) {
    ps.push({ x: 5 });
  }
  ps[0].x = 42;
  console.log(`${readX(q)}`);
  return 0;
};
