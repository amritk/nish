import { parallelMap } from "nish/threads";
const use = (d: Disposable): i32 => 1;
export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  let r: i32 = 0;
  {
    using a = arena();
    const ys = parallelMap(xs, (x) => x + use(a));
    r = ys[2];
  }
  console.log(`${r}`); return 0;
};
