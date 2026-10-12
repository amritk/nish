import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  let s: i32 = 0;
  const ks: i32[] = [1, 2, 3];
  for (const k of ks) {
    const ys = parallelMap([1, 2], (x) => x * k);
    s = s + ys[1];
  }
  console.log(`${s}`);
  return 0;
};
