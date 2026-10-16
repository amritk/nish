// `Ok(raw)` builds a `Result` whose payload is `raw` itself: a second name for
// the array, which `secret(raw)` cannot move.
import { Secret, secret, wipe } from "nish:secret";
export const main = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const r: Result<u8[], string> = Ok(raw);
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return r.ok ? toI32(r.value[0]) : 0;
};
