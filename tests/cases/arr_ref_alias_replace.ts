// #646: reassigning `q` in the block that bound it drops the element it held.
interface P {
  x: i32;
}
const readX = (p: P): i32 => p.x;
export const main = (): i32 => {
  const ps: P[] = [];
  for (let i: i32 = 0; i < 4; i++) {
    ps.push({ x: 1 });
  }
  let q: P = ps[0];
  q = { x: 3 };
  for (let i: i32 = 0; i < 1000; i++) {
    ps.push({ x: 5 });
  }
  console.log(`${readX(q)}`);
  return 0;
};
