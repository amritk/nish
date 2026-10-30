// A task may wipe a `Secret` of a record it makes, but not a record whose
// constructor is handed an object: what a constructor does with `p` is not
// followed, so the record is not known to be the task's own. Pass the
// constructor integers.
import { secret, wipe } from "nish:secret";
import { scope } from "nish/threads";
class Pair {
  a: u32;
  b: u32;
  constructor(p: u32[]) {
    this.a = p[0];
    this.b = p[1];
  }
}
const clear = (xs: u32[]): i32 => {
  const k = secret(new Pair(xs));
  wipe(k);
  return 0;
};
export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(clear, [toU32(1), toU32(2)], out, 0);
  }
  return out[0];
};
