import { parallelMap } from "nish/threads";
class Counter {
  n: i32 = 0;
}
export const main = (): i32 => {
  const c = new Counter();
  const xs = new Array<i32>(3000000);
  const ys = parallelMap(xs, (x): i32 => {
    c.n += 1;
    return x;
  });
  console.log(`${c.n} ${ys.length}`);
  return 0;
};
