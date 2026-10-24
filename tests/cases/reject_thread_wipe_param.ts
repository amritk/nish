// A task may not wipe the array it is handed: the argument is shared memory.
import { wipe } from "nish:secret";
import { scope } from "nish/threads";
const clear = (xs: u8[]): i32 => {
  wipe(xs);
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
