import { parallelMap } from "nish/threads";
class Scaler {
  base: i32 = 10;
  apply(xs: Int32Array, k: i32): i32[] {
    const b = this.base;
    return parallelMap(xs, (x) => x * k + b);
  }
}
export const main = (): i32 => {
  const xs = new Int32Array(3000000);
  for (let i: i32 = 0; i < 3000000; i++) xs[i] = i % 7;
  const ys = new Scaler().apply(xs, 3);
  let s: i32 = 0;
  for (const y of ys) s = (s + y) % 1000003;
  console.log(`${s}`);
  return 0;
};
