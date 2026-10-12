import { parallelFrom } from "nish/threads";
const fillWith = <T>(n: i32, v: T): T[] => parallelFrom(n, (i) => v);
export const main = (): i32 => {
  const h: f64 = 2.5;
  const a = fillWith(3000000, 7);
  const b = fillWith(5, h);
  const c = fillWith(4, true);
  console.log(`${a.length} ${a[2999999]} ${b[4]} ${c[3]}`);
  return 0;
};
