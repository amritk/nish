import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const k: i32 = 4;
  const tab: i32[] = [1];
  const a = parallelFrom(0, (i) => i * k + tab[0]);
  console.log(`${a.length}`);
  return 0;
};
