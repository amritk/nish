// An arrow handed on to `spawn` is checked by the task rules where it runs:
// a push onto a captured array would race with the caller.
import { scope } from "nish/threads";
const run = (f: (x: i32) => i32, x: i32): i32 => {
  const out = new Array<i32>(1);
  {
    using s = scope();
    s.spawn(f, x, out, 0);
  }
  return out[0];
};
export const main = (): i32 => {
  const seen: i32[] = [];
  const k = 4;
  console.log(`${run((x) => x + k, 1)}`);
  return run((x) => {
    seen.push(x);
    return x;
  }, 1);
};
