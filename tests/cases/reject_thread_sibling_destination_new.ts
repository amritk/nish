// A destination read by a constructor reached by `new` in the other scope's
// arrow task: a constructor is a call, and the capture hands `out` on.
import { scope } from "nish/threads";
class D {
  v: i32;
  constructor(o: i32[]) {
    this.v = o[0];
  }
}
const f = (x: i32): i32 => x + 5;
export const main = (): i32 => {
  const out: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(f, 1, out, 0);
    t.spawn((k: i32): i32 => new D(out).v + k, 0, seen, 0);
  }
  console.log(`${seen[0]}`);
  return 0;
};
