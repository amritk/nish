import { parallelMap } from "nish/threads";
const setAt = (a: i32[], i: i32, v: i32): void => {
  a[i] = v;
};
export const main = (): i32 => {
  const cap: i32[] = [0];
  const xs = new Array<i32>(3000000);
  const ys = parallelMap(xs, (x): i32 => {
    setAt(cap, 0, cap[0] + 1);
    return x + 1;
  });
  console.log(`${cap[0]} ${ys.length}`);
  return 0;
};
