// #646: a reassignment that may not run leaves `q` the element reference it held.
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
  let q: P = { x: 7 };
  q = p;
  if (ps.length > 9) { q = { x: 3 }; }
  for (let i: i32 = 0; i < 1000; i++) {
    ps.push({ x: 5 });
  }
  console.log(`${readX(q)}`);
  return 0;
};
