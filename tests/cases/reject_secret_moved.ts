// The local handed to `secret` is moved: the plain bytes may not be read again.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  const raw: u8[] = bytes();
  const k = secret(raw);
  raw[0] = 7;
  wipe(k);
  return 0;
};
