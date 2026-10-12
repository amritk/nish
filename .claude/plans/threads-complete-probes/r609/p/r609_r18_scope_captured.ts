import { parallelMap, scope } from "nish/threads";
export const main = (): i32 => {
  using s = scope();
  const ys = parallelMap([1, 2], (x): i32 => (s === s ? x : 0));
  console.log(`${ys[1]}`);
  return 0;
};
