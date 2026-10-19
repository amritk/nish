// A constructor sets its fields; it does not wipe them.
import { Secret, expose, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  constructor() {
    this.k = secret(bytes());
    wipe(this.k);
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => 0;
