import { parallelMap, parallelMapInto } from "nish/threads";
export const main = (): i32 => {
  const n: i32 = 3000000;
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  const weights = parallelMap(src, (x) => x % 13);
  const d = new Array<i32>(n);
  parallelMapInto(src, d, (x) => weights[(x + 1) % n] + 1);
  let s: i32 = 0;
  for (const v of d) s = (s + v) % 1000003;
  console.log(`${s}`);
  return 0;
};
