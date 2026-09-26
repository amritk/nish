// A reduce's `T` is its element, its identity and its result, and a join hands
// back only a number, a `boolean` or an enum: a string reduce is refused at this
// call, before `nish/threads` is instantiated for an element it cannot hold.
import { parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const xs: string[] = ["a", "b"];
  const s = parallelReduce(xs, (a, b) => a + b, "");
  return 0;
};
