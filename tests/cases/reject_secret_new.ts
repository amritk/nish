// A `Secret` is made by `secret(v)`, never by `new`.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  const k = new Secret<u8[]>(bytes());
  wipe(k);
  return 0;
};
