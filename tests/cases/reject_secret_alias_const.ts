// `secret(raw)` moves `raw`, and a `const` that names the same array first would
// read the wiped bytes: `secret` takes only a value nothing else holds.
import { Secret, secret, wipe } from "nish:secret";
export const main = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const alias = raw;
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(alias[0]);
};
