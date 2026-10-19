// `this.k = this.j = secret(...)`: two fields would own one key.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  readonly j: Secret<u8[]>;
  constructor() {
    this.k = this.j = secret(bytes());
  }
  wipe(): void {
    wipe(this.k);
    wipe(this.j);
  }
}
export const main = (): i32 => 0;
