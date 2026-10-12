import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const xs = new Int32Array(3000000);
  for (let i: i32 = 0; i < 3000000; i++) xs[i] = i % 100;
  const ys = parallelMap(xs, (x) => xs[0] + xs[2999999] + x);
  ys[5] = -1;
  let s: i32 = 0;
  for (const y of ys) s = (s + y) % 1000003;
  console.log(`${s} ${xs[5]}`);
  return 0;
};
