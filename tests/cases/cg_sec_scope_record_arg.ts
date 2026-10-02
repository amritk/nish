// An element of a record array handed to `spawn` is the address of its slot,
// and the task reads it when the scope joins. `ps[0]` kept `ps` private, so
// the store below was accepted and the task saw `{ 100, 200 }` (300) where
// Node, which runs the task at the spawn, prints 3; under `--threads` the two
// raced. docs/security/codegen.md, CG-7.
import { scope } from "nish/threads";

interface Pt {
  x: i32;
  y: i32;
}

const sumPt = (p: Pt): i32 => p.x + p.y;

export const main = (): i32 => {
  const ps: Pt[] = [{ x: 1, y: 2 }];
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(sumPt, ps[0], out, 0);
    ps[0] = { x: 100, y: 200 };
  }
  console.log(`${out[0]}`);
  return 0;
};
