import { parallelFrom } from "nish/threads";
const neg = (): i32 => -1;
export const main = (): i32 => {
  const a = parallelFrom(neg(), (i) => i);
  console.log(`${a.length}`);
  return 0;
};
