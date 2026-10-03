// A borrowed `Secret` parameter is not copied into a local: its caller still owns it.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const f = (k: Secret<u8[]>): i32 => {
  const mine = k;
  wipe(mine);
  return 0;
};
export const main = (): i32 => 0;
