// A holder is not a `Secret` payload: `wipe` would zero its bytes, not its key.
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
export const main = (): i32 => {
  const s = secret(new Holder(toU8(1)));
  wipe(s);
  return 0;
};
