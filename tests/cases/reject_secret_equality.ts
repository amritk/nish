// A `Secret` is compared only with another `Secret` or with `null`.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  const k = secret(bytes());
  const plain: u8[] = bytes();
  const same = k === plain;
  wipe(k);
  return same ? 1 : 0;
};
