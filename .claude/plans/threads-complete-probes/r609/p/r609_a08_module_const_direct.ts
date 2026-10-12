import { parallelMapInto } from "nish/threads";
const G: i32[] = new Array<i32>(3000000);
export const main = (): i32 => {
  const n: i32 = 3000000;
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  parallelMapInto(src, G, (x) => (x === 0 ? 1 : (G[x - 1] % 1000) + 1));
  let s: f64 = 0.0;
  for (const y of G) s = s + toF64(y);
  console.log(`${s}`);
  return 0;
};
