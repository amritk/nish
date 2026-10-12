import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const s = new Set<i32>();
  s.add(2);
  const ys = parallelFrom(3, (i) => (s.has(i) ? 10 : i));
  console.log(`${ys[2]}`);
  return 0;
};
