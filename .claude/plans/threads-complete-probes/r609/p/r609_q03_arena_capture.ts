import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  let r: i32 = 0;
  {
    using a = arena();
    const ys = parallelMap(xs, (x) => (a === a ? x + 1 : x));
    r = ys[2];
  }
  console.log(`${r}`); return 0;
};
