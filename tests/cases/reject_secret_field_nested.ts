// A field read through a chain of fields is still a read that binds it.
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
}
export const main = (): i32 => {
  const o = new Outer();
  const x = o.h.k;
  o.h.wipe();
  return 0;
};
