// A compound assignment to a `Secret` field is refused.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  constructor() {
    this.k = secret(bytes());
    this.k += secret(bytes());
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => 0;
