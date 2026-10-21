// #646: either arm of the conditional may be the element reference.
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
  const p2 = ps[1];
  const q = ps.length > 2 ? p : p2;
  for (let i: i32 = 0; i < 1000; i++) {
    ps.push({ x: 5 });
  }
  ps[0].x = 42;
  console.log(`${readX(q)}`);
  return 0;
};
