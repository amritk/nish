import { parallelMap } from "nish/threads";
class Cfg {
  k: f64 = 1.5;
}
const run = (c: Cfg | null, xs: Float64Array): f64 => {
  if (c === null) return -1.0;
  const ys = parallelMap(xs, (x) => x * c.k);
  let s: f64 = 0.0;
  for (const y of ys) s = s + y;
  return s;
};
export const main = (): i32 => {
  const xs = new Float64Array(3000000);
  for (let i: i32 = 0; i < 3000000; i++) xs[i] = toF64(i % 100);
  console.log(`${run(new Cfg(), xs)} ${run(null, xs)}`);
  return 0;
};
