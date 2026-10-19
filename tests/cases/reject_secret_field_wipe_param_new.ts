// A constructor reached by `new` borrows its `Secret` argument: wiping it would leave the holder reading zeros.
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
class Ender {
  readonly n: i32;
  constructor(s: Secret<u8[]>) {
    wipe(s);
    this.n = 0;
  }
}
export const main = (): i32 => {
  const h = new Holder();
  const e = new Ender(h.k);
  const n = expose(h.k, sum);
  h.wipe();
  return n + e.n;
};
