import { parallelMapInto } from "nish/threads";
class Holder {
  arr: i32[];
  constructor(a: i32[]) {
    this.arr = a;
  }
}
export const main = (): i32 => {
  const n: i32 = 3000000;
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  const dst = new Array<i32>(n);
  const o = new Holder(dst);
  parallelMapInto(src, dst, (x) => (x === 0 ? 1 : (o.arr[x - 1] % 1000) + 1));
  let s: f64 = 0.0;
  for (const y of dst) s = s + toF64(y);
  console.log(`${s}`);
  return 0;
};
