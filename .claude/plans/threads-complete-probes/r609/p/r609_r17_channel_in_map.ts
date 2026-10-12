import { Channel, parallelMap } from "nish/threads";
export const main = (): i32 => {
  const cs = new Map<string, Channel<i32>>();
  cs.set("a", new Channel<i32>());
  const ys = parallelMap([1, 2], (x): i32 => {
    for (const c of cs.values()) {
      c.send(x);
    }
    return x;
  });
  console.log(`${ys[1]}`);
  return 0;
};
