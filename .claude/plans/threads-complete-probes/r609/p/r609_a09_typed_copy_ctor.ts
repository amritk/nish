import { parallelMapInto } from "nish/threads";
export const main = (): i32 => {
  const n: i32 = 3000000;
  const src = new Int32Array(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  const dst = new Int32Array(n);
  const alias = new Int32Array(dst);
  parallelMapInto(src, dst, (x) => (x === 0 ? 1 : (alias[x - 1] % 1000) + 1));
  let s: f64 = 0.0;
  for (const y of dst) s = s + toF64(y);
  console.log(`${s} ${alias[5]}`);
  return 0;
};
