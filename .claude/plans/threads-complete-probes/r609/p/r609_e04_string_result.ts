import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const a = parallelFrom(3, (i) => `${i}`);
  console.log(`${a.length}`);
  return 0;
};
