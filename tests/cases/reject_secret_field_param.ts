// A `Secret` field is set from `secret(...)` in the constructor, not from a parameter.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  constructor(k: Secret<u8[]>) {
    this.k = k;
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => 0;
