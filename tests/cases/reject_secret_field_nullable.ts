// A nullable `Secret` field is refused: only exactly `Secret<T>` is a slot `wipe()` ends.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]> | null;
  constructor() {
    this.k = null;
  }
  wipe(): void {}
}
export const main = (): i32 => 0;
