// A `break` out of the loop that declares a `Secret` leaves it unwiped.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  for (let i: i32 = 0; i < 3; i++) {
    const k = secret(bytes());
    if (i === 1) {
      break;
    }
    wipe(k);
  }
  return 0;
};
