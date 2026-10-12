import { parallelFrom, parallelMap, parallelReduce } from "nish/threads";
const rowSum = (row: i32, w: i32, k: i32): i32 => {
  const cells = parallelFrom(w, (j) => ((row * w + j) * k) % 101);
  return parallelReduce(cells, (a, b) => a + b, 0);
};
export const main = (): i32 => {
  const w: i32 = 2000;
  const k: i32 = 7;
  const rows = new Int32Array(1500);
  for (let i: i32 = 0; i < 1500; i++) rows[i] = i;
  const sums = parallelMap(rows, (r) => rowSum(r, w, k));
  let s: i32 = 0;
  for (const v of sums) s = (s + v) % 1000003;
  console.log(`${s} ${sums[0]} ${sums[1499]}`);
  return 0;
};
