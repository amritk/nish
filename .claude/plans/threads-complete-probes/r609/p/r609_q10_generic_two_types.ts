import { parallelMap } from "nish/threads";
const wrap = <T>(xs: T[], probe: T): i32[] => {
  const k: i32 = 3;
  const tab: i32[] = [10, 20];
  return parallelMap(xs, (x) => (x === probe ? tab[1] : tab[0]) + k);
};
export const main = (): i32 => {
  const a: i32[] = [1, 2, 3];
  const b: f64[] = [1.5, 2.5];
  const ra = wrap(a, 2);
  const h: f64 = 2.5;
  const rb = wrap(b, h);
  console.log(`${ra[0]} ${ra[1]} ${rb[0]} ${rb[1]}`);
  return 0;
};
