// A task answers a number, a `boolean` or an enum: its thread's arena is freed
// when the thread exits, so a string it built would point into freed memory.
import { scope } from "nish/threads";

const label = (n: i32): string => `#${n}`;

export const main = (): i32 => {
  const out: string[] = [""];
  {
    using s = scope();
    s.spawn(label, 1, out, 0);
  }
  return out[0].length;
};
