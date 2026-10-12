import { Mutex, parallelMap } from "nish/threads";
class Counter {
  n: i32 = 0;
}
export const main = (): i32 => {
  const ms = new Map<string, Mutex<Counter>>();
  ms.set("a", new Mutex<Counter>(new Counter()));
  const ys = parallelMap([1, 2], (x) => x + ms.size);
  console.log(`${ys[1]}`);
  return 0;
};
