// A `Result` is read through the test that narrowed it: capture what it holds.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const r: Result<i32, string> = Ok(3);
  const ys = parallelMap([1, 2], (x) => (r.isOk() ? x : 0));
  return ys[0];
};
