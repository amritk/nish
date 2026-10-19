// A class with a `Secret` field declares `wipe(): void`, which ends it.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  constructor(v: u8[]) {
    this.k = secret(bytes());
  }
}
export const main = (): i32 => 0;
