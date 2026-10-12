import { parallelMapInto } from "nish/threads";
const g = <T>(xs: i32[], z: T): T => {
  const d: T[] = [];
  for (let i: i32 = 0; i < xs.length; i++) d.push(z);
  parallelMapInto(xs, d, (x) => d[x % 4]);
  return d[0];
};
export const main = (): i32 => {
  const xs: i32[] = [0, 1, 2, 3, 4, 5, 6, 7];
  console.log(`${g(xs, toF64(1) / toF64(2))} ${g(xs, "s")}`);
  return 0;
};
