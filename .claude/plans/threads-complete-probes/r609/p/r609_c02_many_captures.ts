import { parallelMap } from "nish/threads";
const run = (n: i32, a: i32, b: i32, c: i32): i32 => {
  const d: i32 = a + 1;
  const e: i32 = b + 2;
  const f: i32 = c + 3;
  const g: i32 = 4;
  const h: i32 = 5;
  const t1: i32[] = [1, 2, 3];
  const t2: i32[] = [7, 11, 13];
  const xs = new Int32Array(n);
  const ys = parallelMap(xs, (x) => (x + a * 1 + b * 2 + c * 3 + d * 4 + e * 5 + f * 6 + g * 7 + h * 8 + t1[2] + t2[1]) % 1000);
  let s: i32 = 0;
  for (const y of ys) s = (s + y) % 1000000;
  return s + ys.length;
};
export const main = (): i32 => {
  console.log(`${run(5, 1, 2, 3)} ${run(3000000, 4, 5, 6)}`);
  return 0;
};
