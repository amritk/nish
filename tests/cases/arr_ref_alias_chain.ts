// #646: an alias of an alias still points into `ps`'s storage.
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
  const r = q;
  for (let i: i32 = 0; i < 1000; i++) {
    ps.push({ x: 5 });
  }
  ps[0].x = 42;
  console.log(`${readX(r)}`);
  return 0;
};
