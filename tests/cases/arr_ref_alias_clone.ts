// #646: a helper given an element returns a copy, so its result holds no
// reference; neither the pushes nor the slot store reach it.
interface P {
  x: i32;
}
const readX = (p: P): i32 => p.x;
const clone = (p: P): P => ({ x: p.x });
export const main = (): i32 => {
  const ps: P[] = [];
  for (let i: i32 = 0; i < 4; i++) {
    ps.push({ x: 1 });
  }
  const c = clone(ps[0]);
  ps[0] = { x: 9 };
  for (let i: i32 = 0; i < 1000; i++) {
    ps.push({ x: 5 });
  }
  console.log(`${readX(c)}`);
  return 0;
};
