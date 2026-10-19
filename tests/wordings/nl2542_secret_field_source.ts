// NL2542: A `Secret` field is set from `secret(...)`, not from a function that returns a `Secret`.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
const make = (): Secret<u8[]> => secret([toU8(1)]);
class Holder {
  readonly k: Secret<u8[]>;
  constructor() {
    this.k = make();
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => 0;
