import { scope } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0];
  const a = done;
  {
    using s = scope();
    s.spawn(work, 21, done, 0);
    console.log(`${a[0] + 2}`);
  }
  console.log(`${done[0]}`);
  return 0;
};
