import { parallelMap } from "nish/threads";
const helper = (xs: i32[]): i32[] => {
  const t: i32[] = [];
  for (let i: i32 = 0; i < 1000; i++) t.push(i * 3);
  return parallelMap(xs, (x) => t[x % 1000] + 1);
};
const churn = (): i32 => {
  const junk: i32[][] = [];
  for (let i: i32 = 0; i < 2000; i++) { const a = new Array<i32>(100); a.fill(9); junk.push(a); }
  return junk.length;
};
export const main = (): i32 => {
  const n: i32 = 2000000;
  const xs = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) xs[i] = i;
  const ys = helper(xs);
  const c = churn();
  let s: i32 = 0;
  for (const y of ys) s = (s + y) % 1000003;
  console.log(`${s} ${c}`);
  return 0;
};
