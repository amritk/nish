// A task with no destination keeps its argument too: `s.spawn(sum, raw)` leaves
// the scope a second name for `raw` until the task has run.
import { scope } from "nish/threads";
import { Secret, secret, wipe } from "nish:secret";
const sum = (b: u8[]): void => {
  let t: i32 = 0;
  for (const x of b) {
    t = t + toI32(x);
  }
};
export const main = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  {
    using s = scope();
    s.spawn(sum, raw);
  }
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return 0;
};
