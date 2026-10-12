// The same rule after a `pop` that frees the slot `last` points at.
import { parallelFrom } from "nish/threads";

interface P {
  v: i32;
}

export const main = (): i32 => {
  const ps: P[] = [{ v: 1 }, { v: 2 }];
  const last = ps[1];
  ps.pop();
  ps.push({ v: 50 });
  return parallelFrom(1, (i) => last.v + i)[0];
};
