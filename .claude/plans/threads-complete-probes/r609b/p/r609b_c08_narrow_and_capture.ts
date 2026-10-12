import { parallelMap } from "nish/threads";
class P { v: i32 = 3; }
const pick = (b: boolean): P | null => (b ? new P() : null);
export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const p = pick(true);
  const ok = p !== null && parallelMap(xs, (x) => p.v + x)[2] > 0;
  console.log(`${ok}`);
  return 0;
};
