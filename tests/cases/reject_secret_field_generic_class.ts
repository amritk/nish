// A `Secret` field of a generic class is refused: the owner is a non-generic class.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder<T> {
  readonly k: Secret<u8[]>;
  readonly t: T;
  constructor(t: T) {
    this.k = secret(bytes());
    this.t = t;
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => {
  const h = new Holder<i32>(1);
  h.wipe();
  return 0;
};
