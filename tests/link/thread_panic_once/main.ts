// Two tasks of one scope both panic. Only the first panic prints: it claims
// the process, writes its whole message and exits, and the second parks
// until that exit ends the program (`nish_panic_claim`, runtime/runtime.c).
// Both messages are the same, so a second print or an interleaved one would
// show in stderr, which `tests/run.js` reads over many runs.
import { scope } from "nish/threads";

const fail = (xs: i32[]): i32 => {
  if (xs.length > 0) {
    panic("a task failed");
  }
  return 0;
};

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const out: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(fail, xs, out, 0);
    s.spawn(fail, xs, out, 1);
  }
  console.log(`${out[0]} ${out[1]}`);
  return 0;
};
