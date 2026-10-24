// A task may wipe a `Secret` it makes from a fresh value written in the call,
// but not one made from a local it moves in: the analysis follows the value
// `secret` is handed only when it is allocated right there. Write
// `secret(new Array<u8>(n))` and fill it inside `exposeWith`.
import { secret, wipe } from "nish:secret";
import { scope } from "nish/threads";
const clear = (n: i32): i32 => {
  const buf = new Array<u8>(n);
  buf.fill(9);
  const k = secret(buf);
  wipe(k);
  return 0;
};
export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(clear, 4, out, 0);
  }
  return out[0];
};
