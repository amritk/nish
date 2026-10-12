import { parallelMap } from "nish/threads";
const add = (a: i32[], v: i32): void => {
  a.push(v);
};
export const main = (): i32 => {
  const cap: i32[] = [];
  const xs = new Array<i32>(3000000);
  const ys = parallelMap(xs, (x): i32 => {
    add(cap, x);
    return x;
  });
  console.log(`${cap.length} ${ys.length}`);
  return 0;
};
