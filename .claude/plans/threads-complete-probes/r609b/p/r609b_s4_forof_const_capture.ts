import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const n: i32 = 2000000;
  const xs = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) xs[i] = i % 1000;
  const ks: i32[] = [1, 3, 7];
  let total: i32 = 0;
  for (const k of ks) {
    const ys = parallelMap(xs, (x) => x * k);
    let s: i32 = 0;
    for (const y of ys) s = (s + y) % 1000003;
    console.log(`k=${k} ${s} ${ys[n - 1]}`);
    total = (total + s) % 1000003;
  }
  console.log(`${total}`);
  return 0;
};
