// NL2348: a reduce hands back only a number, a `boolean` or an enum. Strings
// would be folded on several threads, each with an arena of its own.
import { parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const words: string[] = ["a", "b", "c"];
  const joined = parallelReduce(words, (a: string, b: string): string => a + b, "");
  return joined.length;
};
