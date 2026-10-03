// A `Secret` cannot be printed.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  const k = secret(bytes());
  console.log(k);
  wipe(k);
  return 0;
};
