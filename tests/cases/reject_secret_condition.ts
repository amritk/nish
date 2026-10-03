// A `Secret` cannot be a condition: a branch on key material is a timing channel.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  const k = secret(bytes());
  while (k) {
    break;
  }
  wipe(k);
  return 0;
};
