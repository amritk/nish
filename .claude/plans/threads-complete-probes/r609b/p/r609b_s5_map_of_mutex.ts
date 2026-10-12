import { Mutex, parallelMap } from "nish/threads";
export const main = (): i32 => {
  const ms = new Map<i32, Mutex<i32>>();
  ms.set(1, new Mutex<i32>(0));
  const ys = parallelMap([1, 2, 3], (x): i32 => {
    const m = ms.get(1);
    if (m !== undefined) {
      using g = m.lock();
      return x + 1;
    }
    return x;
  });
  console.log(`${ys[2]}`);
  return 0;
};
