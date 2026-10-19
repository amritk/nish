// A `Secret<u8[]>[]` field is refused: one slot per field, not a collection of keys.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly ks: Secret<u8[]>[];
  constructor() {
    this.ks = [];
  }
  wipe(): void {}
}
export const main = (): i32 => 0;
