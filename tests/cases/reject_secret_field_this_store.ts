// `this` stored into another object by the constructor: the field is still wiped only by `wipe()`.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Other {
  l: Holder | null = null;
}
class Holder {
  readonly k: Secret<u8[]>;
  constructor(o: Other) {
    this.k = secret(bytes());
    o.l = this;
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => {
  const o = new Other();
  const h = new Holder(o);
  const l = o.l;
  if (l !== null) {
    wipe(l.k);
  }
  const n = expose(h.k, sum);
  h.wipe();
  return n;
};
