// A task may not wipe an array it captures from the function that runs the
// scope: the parent reads it after the join, and a sibling could read it now.
import { wipe } from "nish:secret";
import { scope } from "nish/threads";
export const main = (): i32 => {
  const key: u8[] = [toU8(1), toU8(2)];
  {
    using s = scope();
    s.spawn((): void => {
      wipe(key);
    });
  }
  return toI32(key.length);
};
