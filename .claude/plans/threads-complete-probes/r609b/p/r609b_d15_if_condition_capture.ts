import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(work, 21, done, 0);
    if (parallelFrom(1, (i) => done[0] + i)[0] > 0) {
      console.log("seen");
    } else {
      console.log("not seen");
    }
  }
  console.log(`${done[0]}`);
  return 0;
};
