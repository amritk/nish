// An assignment answers the array it stores: `alias = raw = [1, 2, 3]` gives
// `alias` the array `raw` holds, which `secret(raw)` cannot move.
import { Secret, secret, wipe } from "nish:secret";
export const main = (): i32 => {
  let raw: u8[] = [9];
  let alias: u8[] = [0];
  alias = raw = [1, 2, 3];
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(alias[0]);
};
