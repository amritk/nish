// A holder's `wipe()` that hands its field to a constructor: a borrow, not a wipe.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Ender {
  n: i32 = 0;
  constructor(k: Secret<u8[]>) {
    this.n = exposeWith(k, 0, (v: u8[], z: i32): i32 => {
      v.fill(0);
      return z;
    });
  }
}
class Holder {
  readonly k: Secret<u8[]>;
  constructor() {
    this.k = secret(bytes());
  }
  wipe(): void {
    new Ender(this.k);
  }
}
export const main = (): i32 => 0;
