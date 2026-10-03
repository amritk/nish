// `wipe` zeroes integers only: a string cannot be zeroed in place.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  wipe("text");
  return 0;
};
