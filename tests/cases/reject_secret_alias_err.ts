// `Err(raw)` builds a `Result` whose error is `raw` itself: a second name for
// the array, which `secret(raw)` cannot move.
import { Secret, secret, wipe } from "nish:secret";
export const main = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const r: Result<i32, u8[]> = Err(raw);
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return r.ok ? 0 : toI32(r.error[0]);
};
