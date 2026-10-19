// `this` handed out of the constructor reaches a function that cannot wipe the field either.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
const fin = (h: Holder): i32 => {
  wipe(h.k);
  return expose(h.k, sum);
};
class Holder {
  readonly k: Secret<u8[]>;
  n: i32 = 0;
  constructor() {
    this.k = secret(bytes());
    this.n = fin(this);
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => 0;
