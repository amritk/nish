// A `break` out of a labelled block skips the `wipe` after it.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  const k = secret(bytes());
  blk: {
    if (k === k) {
      break blk;
    }
    wipe(k);
  }
  return 0;
};
