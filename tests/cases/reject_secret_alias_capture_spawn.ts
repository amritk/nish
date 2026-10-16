// A task spawned as an arrow reads the local it captures where the task runs:
// a second name for the array, which `secret(raw)` cannot move.
import { scope } from "nish/threads";
import { Secret, secret, wipe } from "nish:secret";
const first = (b: u8[]): i32 => toI32(b[0]);
export const main = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  {
    using s = scope();
    s.spawn(() => {
      first(raw);
    });
  }
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return 0;
};
