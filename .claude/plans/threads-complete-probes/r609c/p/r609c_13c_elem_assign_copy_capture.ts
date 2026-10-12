import { parallelFrom } from "nish/threads";
interface P { v: i32; }
export const main = (): i32 => {
  const ps: P[] = [{ v: 0 }];
  const p: P = { v: 1 };
  ps[0] = p;
  ps[0].v = 5;
  const ys = parallelFrom(1, (i) => p.v + i);
  console.log(`${ys[0]}`);
  return 0;
};
