// A holder's `wipe()` that returns before it wipes its field.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  readonly n: i32;
  constructor(v: u8[]) {
    this.k = secret(bytes());
    this.n = 0;
  }
  wipe(): void {
    if (this.n > 0) {
      return;
    }
    wipe(this.k);
  }
}
export const main = (): i32 => 0;
