import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const n: i32 = 3000000;
  const xs = new Int32Array(n);
  for (let i: i32 = 0; i < n; i++) xs[i] = (i * 13) % n;
  const ys = parallelMap(xs, (x) => xs[x] % 1000);
  let s: i32 = 0;
  for (const y of ys) s = (s + y) % 1000003;
  console.log(`${s}`);
  return 0;
};
