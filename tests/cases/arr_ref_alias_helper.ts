// #646: a helper that returns a record of the element's class may hand back
// the reference it was given, so its result is taken to be one.
interface P {
  x: i32;
}
const readX = (p: P): i32 => p.x;
const same = (p: P): P => p;
export const main = (): i32 => {
  const ps: P[] = [];
  for (let i: i32 = 0; i < 4; i++) {
    ps.push({ x: 1 });
  }
  const p = ps[0];
  const q = same(p);
  for (let i: i32 = 0; i < 1000; i++) {
    ps.push({ x: 5 });
  }
  ps[0].x = 42;
  console.log(`${readX(q)}`);
  return 0;
};
