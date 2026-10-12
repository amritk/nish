import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const tab = new Int32Array(10);
  tab.fill(7);
  const ys = parallelFrom(12, (i) => tab[i]);
  console.log(`${ys[11]}`);
  return 0;
};
