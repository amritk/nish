// A method cannot replace a `Secret` field: it is `readonly`, and the old key would be lost.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  constructor(v: u8[]) {
    this.k = secret(bytes());
  }
  reset(v: u8[]): void {
    this.k = secret(bytes());
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => 0;
