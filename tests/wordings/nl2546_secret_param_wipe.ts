// NL2546: A function handed the field borrows it: wiping it would leave the holder reading zeros.
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
const end = (s: Secret<u8[]>): void => {
  wipe(s);
};
export const main = (): i32 => {
  const h = new Holder();
  end(h.k);
  const n = expose(h.k, sum);
  h.wipe();
  return n;
};
