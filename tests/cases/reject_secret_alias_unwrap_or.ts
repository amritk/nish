// `r.unwrapOr(d)` answers `d` when `r` holds an error, so `secret` of it would
// take an array the local `d` still names.
import { Secret, secret, wipe } from "nish:secret";
const none = (): Result<u8[], string> => Err("no key");
export const main = (): i32 => {
  const d: u8[] = [9];
  const key: Secret<u8[]> = secret(none().unwrapOr(d));
  wipe(key);
  return toI32(d[0]);
};
