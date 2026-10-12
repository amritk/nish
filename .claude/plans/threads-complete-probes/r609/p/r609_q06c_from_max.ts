import { parallelFrom } from "nish/threads";
const big = (): i32 => 2147483647;
export const main = (): i32 => {
  const k: u8 = toU8(1);
  const a = parallelFrom(big(), (i) => k);
  console.log(`${a.length} ${a[2147483646]}`);
  return 0;
};
