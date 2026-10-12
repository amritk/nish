import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("a", 5);
  const v: i32 | undefined = m.get("a");
  const ys = parallelFrom(3, (i) => (v !== undefined ? v + i : i));
  console.log(`${ys[2]}`);
  return 0;
};
