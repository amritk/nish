import { Channel, parallelMap } from "nish/threads";
export const main = (): i32 => {
  const c = new Channel<i32>();
  const ys = parallelMap([1, 2, 3], (x) => x + (c === c ? 1 : 0));
  console.log(`${ys[2]}`);
  return 0;
};
