import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const tab: i32[] = [11, 22, 33];
  const a = tab[0] + tab[2];
  const ys = parallelFrom(5, (i) => tab[1] + i);
  console.log(`${a} ${ys[4]}`);
  return 0;
};
