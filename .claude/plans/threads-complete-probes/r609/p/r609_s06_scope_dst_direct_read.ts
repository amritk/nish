import { scope } from "nish/threads";
const work = (n: i32): i32 => n * 2;
export const main = (): i32 => {
  const sums: i32[] = [0];
  {
    using s = scope();
    s.spawn(work, 21, sums, 0);
    const y = sums[0] + 2;
    console.log(`in block: ${y}`);
  }
  console.log(`after: ${sums[0]}`);
  return 0;
};
