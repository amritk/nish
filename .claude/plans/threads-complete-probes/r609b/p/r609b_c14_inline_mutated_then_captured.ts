import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const t: i32[] = [1, 2, 3];
  t[1] = 50;
  t[2] = t[0] + t[1];
  const ys = parallelFrom(3000000, (i) => t[i % 3]);
  let s: i32 = 0;
  for (const y of ys) s = (s + y) % 1000003;
  console.log(`${s} ${t[2]}`);
  return 0;
};
