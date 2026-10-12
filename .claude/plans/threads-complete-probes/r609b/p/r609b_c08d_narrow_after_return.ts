import { parallelMap } from "nish/threads";
class P { v: i32 = 3; }
const pick = (b: boolean): P | null => (b ? new P() : null);
const f = (b: boolean): i32 => {
  const xs: i32[] = [1, 2, 3];
  const p = pick(b);
  if (p === null) return -1;
  return parallelMap(xs, (x) => p.v + x)[2];
};
export const main = (): i32 => { console.log(`${f(true)} ${f(false)}`); return 0; };
