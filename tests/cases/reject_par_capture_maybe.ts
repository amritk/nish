// A value that may be absent is read through the test that found it, which
// the body cannot repeat, so it is not captured (NL2496).
import { parallelFrom } from "nish/threads";

export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.set("a", 5);
  const v: i32 | undefined = m.get("a");
  const ys = parallelFrom(3, (i) => (v !== undefined ? v + i : i));
  return ys[2];
};
