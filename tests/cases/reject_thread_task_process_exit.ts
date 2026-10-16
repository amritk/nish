// A task's `process.exit` ends the program with a code of its own choosing: a
// panic's exit is not output, and this is.
import { scope } from "nish/threads";

const shout = (xs: i32[]): i32 => {
  if (xs.length < 0) {
    process.exit(3);
  }
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
