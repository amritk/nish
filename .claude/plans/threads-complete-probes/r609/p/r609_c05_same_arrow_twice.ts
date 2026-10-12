import { parallelMap } from "nish/threads";
const scaled = (xs: Int32Array, k: i32): i32[] => parallelMap(xs, (x) => (x + k) % 977);
export const main = (): i32 => {
  const xs = new Int32Array(3000000);
  for (let i: i32 = 0; i < 3000000; i++) xs[i] = i;
  const a = scaled(xs, 3);
  const b = scaled(xs, 5);
  const k: i32 = 9;
  const c = parallelMap(xs, (x) => (x + k) % 977);
  const d = parallelMap(xs, (x) => (x + k) % 977);
  let s: i32 = 0;
  for (let i: i32 = 0; i < 3000000; i++) s = (s + a[i] + b[i] * 3 + c[i] * 5 + d[i] * 7) % 1000003;
  console.log(`${s} ${a[2999999]} ${b[2999999]}`);
  return 0;
};
