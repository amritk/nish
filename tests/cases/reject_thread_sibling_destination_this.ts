// A destination handed out of a constructor through `this`: `D` keeps `out` and
// pushes itself into `reg`, so `t`'s task could read `s`'s answer as
// `reg[0].o[0]`. Handing `out` to `new` is handing it on.
import { scope } from "nish/threads";
class D {
  o: i32[];
  constructor(o: i32[], reg: D[]) {
    this.o = o;
    reg.push(this);
  }
}
const f = (x: i32): i32 => x + 5;
const read = (reg: D[]): i32 => reg[0].o[0];
export const main = (): i32 => {
  const out: i32[] = [0];
  const seen: i32[] = [0];
  const reg: D[] = [];
  const d = new D(out, reg);
  {
    using s = scope(), t = scope();
    s.spawn(f, 1, out, 0);
    t.spawn(read, reg, seen, 0);
  }
  console.log(`${seen[0]} ${d.o[0]}`);
  return 0;
};
