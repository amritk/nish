// A task may wipe an array it makes with `new Array` or a literal, but not one
// a call answers: a call result is memory the task does not know, which may be
// anyone's. Make the scratch with `new Array` in the task and fill it there.
import { wipe } from "nish:secret";
import { scope } from "nish/threads";
const make = (n: i32): u8[] => {
  const xs = new Array<u8>(n);
  xs.fill(9);
  return xs;
};
const clear = (n: i32): i32 => {
  const xs = make(n);
  const first = toI32(xs[0]);
  wipe(xs);
  return first;
};
export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(clear, 4, out, 0);
  }
  return out[0];
};
