// A labelled `break` out of two loops leaves the `Secret` the outer one made unwiped.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  outer: for (let i: i32 = 0; i < 3; i++) {
    const k = secret(bytes());
    for (let j: i32 = 0; j < 3; j++) {
      if (j === 1) {
        break outer;
      }
    }
    wipe(k);
  }
  return 0;
};
