import { Mutex, parallelMap } from "nish/threads";
class Counter { n: i32 = 0; }
export const main = (): i32 => {
  const ms = new Map<i32, Mutex<Counter>>();
  ms.set(1, new Mutex<Counter>(new Counter()));
  const ys = parallelMap([1, 2, 3], (x) => x + ms.size);
  console.log(`${ys[2]}`);
  return 0;
};
