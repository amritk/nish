// A holder's `wipe()` that wipes its field only inside a loop, which may run no times.
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
    for (let i: i32 = 0; i < this.n; i++) {
      wipe(this.k);
    }
  }
}
export const main = (): i32 => 0;
