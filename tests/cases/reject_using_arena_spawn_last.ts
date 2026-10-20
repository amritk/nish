// A `using` statement disposes its declarators in reverse: in
// `using a = arena(), s = scope(), b = arena()`, `b` releases before `s`
// joins, so `s` is held to the rule of a scope declared outside the block
// although an `arena()` precedes it. Its tasks would read `ys` after `b` had
// released it.
import { scope } from "nish/threads";

const size = (ys: i32[]): i32 => ys.length;

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using a = arena(),
      s = scope(),
      b = arena();
    const ys = new Array<i32>(8);
    s.spawn(size, ys, out, 0);
  }
  console.log(`${out[0]}`);
  return 0;
};
