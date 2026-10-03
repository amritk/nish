// A `Secret` made and dropped is a key nobody wipes.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  secret(bytes());
  return 0;
};
