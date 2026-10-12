// `a ?? b` answers one of its operands, so `maybe ?? raw` is a second name for
// `raw` whenever `maybe` is null, as a ternary arm is.
import { Secret, secret, wipe } from "nish:secret";
const none = (): u8[] | null => null;
export const main = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const maybe: u8[] | null = none();
  const alias: u8[] = maybe ?? raw;
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(alias[0]);
};
