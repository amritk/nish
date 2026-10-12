import { parallelMap } from "nish/threads";
class Counter {
  n: i32 = 0;
  bump(): i32 {
    this.n = this.n + 1;
    return this.n;
  }
}
export const main = (): i32 => {
  const c = new Counter();
  const xs = new Array<i32>(3000000);
  const ys = parallelMap(xs, (x) => (c.bump() % 7) + x);
  let s: i32 = 0;
  for (const y of ys) s = s + y;
  console.log(`${c.n} ${s}`);
  return 0;
};
