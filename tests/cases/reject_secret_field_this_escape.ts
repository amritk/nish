// Once the fields are set, a constructor still cannot set a `Secret` field through another name for `this`.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  constructor() {
    this.k = secret(bytes());
    const self = this;
    self.k = secret(bytes());
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => 0;
