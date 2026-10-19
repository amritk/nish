// `secret(raw)` in a constructor still refuses a `raw` a field keeps (NL2512).
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  readonly raw: u8[];
  constructor(seed: u8) {
    const raw: u8[] = [seed, toU8(2)];
    this.raw = raw;
    this.k = secret(raw);
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => 0;
