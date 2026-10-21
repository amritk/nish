// #646: an assignment inside a `case` binds `q`, which outlives the `switch`.
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
  switch (ps.length) {
    case 4:
      q = p;
      break;
    default:
      break;
  }
  for (let i: i32 = 0; i < 1000; i++) {
    ps.push({ x: 5 });
  }
  console.log(`${readX(q)}`);
  return 0;
};
