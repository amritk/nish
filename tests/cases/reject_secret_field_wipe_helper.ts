// A holder's `wipe()` that hands its field to a helper: a borrow, not a wipe.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
const scrub = (k: Secret<u8[]>): void => {
  exposeWith(k, 0, (v: u8[], z: i32): i32 => {
    v.fill(0);
    return z;
  });
};
class Holder {
  readonly k: Secret<u8[]>;
  constructor(v: u8[]) {
    this.k = secret(bytes());
  }
  wipe(): void {
    scrub(this.k);
  }
}
export const main = (): i32 => 0;
