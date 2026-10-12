import { parallelMapInto } from "nish/threads";
export const main = (): i32 => {
  const n: i32 = 3000000;
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  const dst = new Array<i32>(n);
  const view = dst;
  {
    const dst = new Array<i32>(n);
    parallelMapInto(src, view, (x) => (x === 0 ? 1 : (dst[x - 1] % 1000) + 1));
  }
  let s: f64 = 0.0;
  for (const y of dst) s = s + toF64(y);
  console.log(`${s}`);
  return 0;
};
