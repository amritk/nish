// A scope is only ever the receiver of a `spawn` statement: handed to another
// function it could be stored, and given a task after its block joined it.
import { scope, ThreadScope } from "nish/threads";

const one = (n: i32): i32 => n + 1;

const later = (s: ThreadScope): i32 => {
  const out: i32[] = [0];
  s.spawn(one, 1, out, 0);
  return out[0];
};

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    out[0] = later(s);
  }
  return out[0];
};
