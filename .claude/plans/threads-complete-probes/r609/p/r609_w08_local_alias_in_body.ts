import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const cap: i32[] = [0];
  const xs = new Array<i32>(3000000);
  const ys = parallelMap(xs, (x): i32 => {
    const t = cap;
    t[0] = t[0] + 1;
    return x;
  });
  console.log(`${cap[0]} ${ys.length}`);
  return 0;
};
