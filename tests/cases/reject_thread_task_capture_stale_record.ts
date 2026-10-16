// NL2290 through a task's capture: `p` is the address of an inline record of
// `ps`, and the `push` before the spawn may have moved that storage.
import { scope } from "nish/threads";

interface P {
  x: i32;
}

const readX = (p: P): i32 => p.x;

export const main = (): i32 => {
  const ps: P[] = [{ x: 1 }];
  const p = ps[0];
  ps.push({ x: 2 });
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn((n: i32): i32 => readX(p) + n, 1, out, 0);
  }
  return out[0];
};
