import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const lim: i32 = 1234567;
  const on: boolean = true;
  const ys = parallelFrom(3000000, (i) => on && i < lim);
  let c: i32 = 0;
  for (const y of ys) if (y) c = c + 1;
  console.log(`${c}`);
  return 0;
};
