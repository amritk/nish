import { parallelMapInto } from "nish/threads";
const run = (dst: i32[], other: i32[]): void => {
  parallelMapInto([1, 2], dst, (x) => other[0] + x);
};
export const main = (): i32 => {
  const a: i32[] = [0, 0];
  run(a, a);
  console.log(`${a[1]}`);
  return 0;
};
