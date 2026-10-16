// A fresh atomic that no task of the scope reaches is the parent's alone, so
// it may be updated between the spawn and the join (R7 judges an atomic by
// the types a task holds, not by the write its method makes).
import { AtomicI32, scope } from "nish/threads";
const sq = (x: i32): i32 => x * x;
export const main = (): i32 => {
  const p = new AtomicI32(0);
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(sq, 3, out, 0);
    p.add(4);
  }
  console.log(`${out[0]} ${p.load()}`);
  return 0;
};
