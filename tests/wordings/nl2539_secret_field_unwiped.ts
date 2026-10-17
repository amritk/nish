// NL2539: A holder's `wipe()` that forgets one of its fields.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  readonly j: Secret<u8[]>;
  constructor(v: u8[]) {
    this.k = secret(bytes());
    this.j = secret([toU8(9)]);
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => 0;
