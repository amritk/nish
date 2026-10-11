// A task's own array handed to a function that keeps it is private no
// longer: `pass` hands the array back, writing nothing itself, so after the
// call more than the task may hold it, and the task's store into it, before
// the call, is a shared write.
import { scope } from "nish/threads";

const pass = (xs: i32[]): i32[] => xs;

const keep = (n: i32): i32 => {
  const xs = new Array<i32>(n);
  xs[0] = 1;
  pass(xs);
  return 0;
};

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(keep, 4, out, 0);
  }
  return out[0];
};
