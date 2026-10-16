// A task's argument is handed to the scope, which keeps it until the task has
// run: `s.spawn(first, raw, out, 0)` leaves the scope a second name for `raw`.
import { scope } from "nish/threads";
import { Secret, secret, wipe } from "nish:secret";
const first = (b: u8[]): i32 => toI32(b[0]);
export const main = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(first, raw, out, 0);
  }
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return out[0];
};
