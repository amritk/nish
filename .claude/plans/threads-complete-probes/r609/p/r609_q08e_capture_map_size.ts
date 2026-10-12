import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("a", 5);
  const ys = parallelFrom(3, (i) => i + m.size);
  console.log(`${ys[2]}`);
  return 0;
};
