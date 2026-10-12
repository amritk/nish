import { parallelFrom } from "nish/threads";
interface P { x: i32; y: i32; }
export const main = (): i32 => {
  const p: P = { x: 3, y: 4 };
  const ps: P[] = [{ x: 1, y: 2 }, { x: 5, y: 6 }];
  ps[1].x = 70;
  const ys = parallelFrom(3000000, (i) => p.x + ps[i % 2].x + ps[1].y);
  let s: i32 = 0;
  for (const y of ys) s = (s + y) % 1000003;
  console.log(`${s}`);
  return 0;
};
