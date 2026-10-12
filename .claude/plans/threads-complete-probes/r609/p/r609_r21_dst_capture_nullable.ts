import { parallelMapInto } from "nish/threads";
export const main = (): i32 => {
  const dst: i32[] = [0, 0];
  const alias: i32[] | null = dst;
  parallelMapInto([1, 2], dst, (x) => (alias !== null ? alias[0] + x : x));
  console.log(`${dst[1]}`);
  return 0;
};
