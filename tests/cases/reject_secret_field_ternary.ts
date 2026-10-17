// A `Secret` field cannot be an arm of a conditional.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  constructor(seed: u8) {
    this.k = secret([seed, toU8(2)]);
  }
  wipe(): void {
    wipe(this.k);
  }
}
const pick = (a: Holder, b: Holder, first: boolean): i32 => expose(first ? a.k : b.k, sum);
export const main = (): i32 => 0;
