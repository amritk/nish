// A nullable `Secret` is narrowed before it is wiped.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const maybe = (): Secret<u8[]> | null => secret(bytes());
export const main = (): i32 => {
  const k = maybe();
  wipe(k);
  return 0;
};
