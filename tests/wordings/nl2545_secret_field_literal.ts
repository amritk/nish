// NL2545: A holder cannot be built from an object literal: only its constructor sets a `Secret` field.
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
  const h: Holder = { k: secret(bytes()) };
  h.wipe();
  return 0;
};
