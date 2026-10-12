import { Mutex, parallelMap } from "nish/threads";
class Counter {
  n: i32 = 0;
}
export const main = (): i32 => {
  const ms: Mutex<Counter>[] = [new Mutex<Counter>(new Counter())];
  const ys = parallelMap([1, 2], (x) => x + ms.length);
  console.log(`${ys[1]}`);
  return 0;
};
