// NL2345: the same rule for a reducer, which writes the caller's `log` as it folds.
import { parallelReduce } from "nish/threads";

class Log {
  last: i32 = 0;
}

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3];
  const log = new Log();
  const sum = parallelReduce(src, (a: i32, b: i32): i32 => {
    log.last = b;
    return a + b;
  }, 0);
  return sum + log.last;
};
