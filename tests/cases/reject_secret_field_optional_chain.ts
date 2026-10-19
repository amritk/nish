// A `Secret` field read through `?.` is refused, even when the chain is then compared with `null`;
// the `.err` pins that read, the one field read in the file.
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
const peek = (a: Holder | null): boolean => (a?.k ?? null) === null;
export const main = (): i32 => 0;
