import { parallelMap, parallelFrom } from "nish/threads";
const make = (n: i32, k: i32): i32[] => {
  const tab: i32[] = [k, k + 1, k + 2];
  return parallelFrom(n, (i) => tab[i % 3] * i);
};
const churn = (): i32 => {
  let t: i32 = 0;
  for (let r: i32 = 0; r < 200; r++) {
    const junk = new Int32Array(10000);
    junk.fill(r);
    t = t + junk[9999];
  }
  return t;
};
export const main = (): i32 => {
  const a = make(3000000, 2);
  const b = make(10, 5);
  const c = churn();
  const k: i32 = 3;
  const d = parallelMap(b, (x) => x + k);
  console.log(`${a[2999999]} ${a[5]} ${b[9]} ${d[9]} ${c}`);
  return 0;
};
