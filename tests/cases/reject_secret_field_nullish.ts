// A `Secret` field cannot be the default of `??`, which would be a second owner of the key. `??`
// comes only after `?.`, so `a?.k` is refused too; the `.err` pins the default, `h.k`.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  constructor(seed: u8) {
    this.k = secret([seed, toU8(2)]);
  }
  wipe(): void {
    wipe(this.k);
  }
}
const pick = (a: Holder | null, h: Holder): i32 => expose(a?.k ?? h.k, sum);
export const main = (): i32 => 0;
