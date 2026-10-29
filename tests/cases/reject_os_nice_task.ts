// `setNice` changes the calling thread's priority, which Linux keeps per
// thread, so a `scope()` task may not change it for one worker.
import { scope } from "nish/threads";

const lower = (n: i32): i32 => setNice(n);

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(lower, 10, out, 0);
  }
  return out[0];
};
