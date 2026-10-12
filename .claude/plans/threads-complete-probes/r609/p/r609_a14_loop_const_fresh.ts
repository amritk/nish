import { parallelMapInto } from "nish/threads";
export const main = (): i32 => {
  const n: i32 = 3000000;
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  let s: f64 = 0.0;
  for (let r: i32 = 0; r < 2; r++) {
    const dst = new Array<i32>(n);
    const prev = new Array<i32>(n);
    prev.fill(0);
    parallelMapInto(src, dst, (x) => (x === 0 ? 1 : (prev[x - 1] % 1000) + 1));
    for (const y of dst) s = s + toF64(y);
  }
  console.log(`${s}`);
  return 0;
};
