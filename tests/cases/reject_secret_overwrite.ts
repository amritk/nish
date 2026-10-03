// Assigning a `Secret` local again loses the secret it held, unwiped.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  let k = secret(bytes());
  k = secret(bytes());
  wipe(k);
  return 0;
};
