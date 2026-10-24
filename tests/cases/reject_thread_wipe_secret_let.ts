// A task may wipe a `Secret` it makes and holds in a `const`, but not one
// held in a `let`: a `let` may be rebound to anyone's `Secret` before the
// wipe. Hold it in a `const`.
import { secret, wipe } from "nish:secret";
import { scope } from "nish/threads";
const clear = (n: i32): i32 => {
  let k = secret(new Array<u8>(n));
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
