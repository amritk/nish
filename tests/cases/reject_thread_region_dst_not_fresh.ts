// A destination is a `const` local bound to a fresh array: a parameter could be
// an array a task reads, so a task could see another's answer early or late.
import { scope } from "nish/threads";

const one = (n: i32): i32 => n + 1;

const fill = (out: i32[]): void => {
  using s = scope();
  s.spawn(one, 1, out, 0);
};

export const main = (): i32 => {
  const out: i32[] = [0];
  fill(out);
  return out[0];
};
