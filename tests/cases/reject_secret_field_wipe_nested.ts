// An outer object's `wipe()` cannot wipe a field of a holder it keeps: that holder's own `wipe()` ends it.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  constructor() {
    this.k = secret(bytes());
  }
  wipe(): void {
    wipe(this.k);
  }
}
class Outer {
  readonly h: Holder;
  constructor() {
    this.h = new Holder();
  }
  wipe(): void {
    wipe(this.h.k);
  }
}
export const main = (): i32 => {
  const o = new Outer();
  o.wipe();
  return 0;
};
