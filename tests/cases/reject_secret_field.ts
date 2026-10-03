// A field of a class cannot be a `Secret`: the field outlives the function that made it.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
class Holder {
  key: Secret<u8[]>;
  constructor(k: Secret<u8[]>) {
    this.key = k;
  }
}
export const main = (): i32 => 0;
