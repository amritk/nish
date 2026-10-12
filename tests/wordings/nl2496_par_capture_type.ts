// NL2496: an arrow passed to a data-parallel form reads a local whose type a
// body cannot capture: here a `Result`.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const r: Result<i32, string> = Ok(3);
  const ys = parallelMap([1, 2], (x) => (r.isOk() ? x : 0));
  return ys[0];
};
