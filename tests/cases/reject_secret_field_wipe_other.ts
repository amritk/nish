// A holder's `wipe()` ends its own field, not another holder's.
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
class Twin {
  readonly k: Secret<u8[]>;
  constructor() {
    this.k = secret(bytes());
  }
  wipe(): void {
    const o = new Holder();
    wipe(o.k);
    wipe(this.k);
  }
}
export const main = (): i32 => {
  const t = new Twin();
  t.wipe();
  return 0;
};
