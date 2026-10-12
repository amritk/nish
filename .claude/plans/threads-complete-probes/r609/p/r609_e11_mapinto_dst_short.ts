import { parallelMapInto } from "nish/threads";
export const main = (): i32 => {
  const k: i32 = 2;
  const dst: i32[] = [0];
  parallelMapInto([1, 2, 3], dst, (x) => x * k);
  console.log(`${dst[0]}`);
  return 0;
};
