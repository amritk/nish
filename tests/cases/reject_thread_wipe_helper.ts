// A helper's own scratch is private, but the array it wipes here is the one
// the task is handed, so the wipe still writes shared memory.
import { wipe } from "nish:secret";
import { scope } from "nish/threads";
const clearInto = (xs: u8[]): void => {
  wipe(xs);
};
const clear = (xs: u8[]): i32 => {
  clearInto(xs);
  return 0;
};
export const main = (): i32 => {
  const key: u8[] = [toU8(1), toU8(2)];
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(clear, key, out, 0);
  }
  return out[0];
};
