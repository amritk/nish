// A `Secret` field cannot be the payload of a `Result`.
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
const take = (h: Holder): Result<Secret<u8[]>, string> => ok(h.k);
export const main = (): i32 => 0;
