// A task's `console.error` writes to a stream the scope's other tasks share: a
// panic's message is not output, and this is.
import { scope } from "nish/threads";

const shout = (xs: i32[]): i32 => {
  console.error("x");
  return xs.length;
};

export const main = (): i32 => {
  const xs: i32[] = [1, 2];
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(shout, xs, out, 0);
  }
  return out[0];
};
