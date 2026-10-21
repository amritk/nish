// #646: an assignment inside an `if` body binds `q`, which outlives the block.
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
  if (ps.length > 2) { q = p; }
  for (let i: i32 = 0; i < 1000; i++) {
    ps.push({ x: 5 });
  }
  console.log(`${readX(q)}`);
  return 0;
};
