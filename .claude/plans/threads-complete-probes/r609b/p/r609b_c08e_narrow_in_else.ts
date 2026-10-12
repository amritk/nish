import { parallelMap } from "nish/threads";
class P { v: i32 = 3; }
const pick = (b: boolean): P | null => (b ? new P() : null);
export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const p = pick(false);
  let r: i32 = 0;
  if (p !== null) {
    r = 1;
  } else {
    r = parallelMap(xs, (x) => p.v + x)[2];
  }
  console.log(`${r}`);
  return 0;
};
