// NL2290 at the join for a task's argument: the task reads `p` when the scope
// joins, after the `push` written between the spawn and the end of the block.
import { scope } from "nish/threads";

interface P {
  x: i32;
}

const readX = (p: P): i32 => p.x;

export const main = (): i32 => {
  const ps: P[] = [{ x: 1 }];
  const p = ps[0];
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(readX, p, out, 0);
    ps.push({ x: 2 });
  }
  return out[0];
};
