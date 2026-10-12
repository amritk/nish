import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const k: i32 = 2;
  const a = parallelFrom(0, (i) => i * k);
  const b = parallelFrom(1, (i) => i * k + 9);
  console.log(`${a.length} ${b.length} ${b[0]}`);
  return 0;
};
