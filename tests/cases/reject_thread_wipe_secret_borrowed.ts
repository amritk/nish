// A task may wipe a `Secret` it makes, but not one it borrows: the parent's
// `Secret` is shared memory, and the parent wipes it once the scope joins. The
// rule that a `Secret` parameter is its caller's to wipe refuses it first.
import { Secret, secret, wipe } from "nish:secret";
import { scope } from "nish/threads";
const clear = (k: Secret<u8[]>): i32 => {
  wipe(k);
  return 0;
};
export const main = (): i32 => {
  const k = secret([toU8(7), toU8(2)]);
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(clear, k, out, 0);
  }
  wipe(k);
  return out[0];
};
