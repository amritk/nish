import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  let r: i32[] = [];
  {
    using a = arena();
    const t: i32[] = [1, 2, 3];
    r = parallelFrom(10, (i) => t[i % 3]);
  }
  const junk: string[] = [];
  for (let i: i32 = 0; i < 100; i++) junk.push(`j${i}`);
  console.log(`${r[9]} ${junk.length}`);
  return 0;
};
