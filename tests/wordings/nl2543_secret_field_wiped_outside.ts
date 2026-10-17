// NL2543: A holder's field is wiped only by its own `wipe()`: here it would then be read as zeros.
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
export const main = (): i32 => {
  const h = new Holder();
  wipe(h.k);
  const n = expose(h.k, sum);
  h.wipe();
  return n;
};
