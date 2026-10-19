// A `Secret` field set in a loop of the constructor: the second iteration finds the first key still held.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  constructor() {
    this.k = secret(bytes());
    wipe(this.k);
    for (let i: i32 = 0; i < 2; i++) {
      this.k = secret(bytes());
    }
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => 0;
