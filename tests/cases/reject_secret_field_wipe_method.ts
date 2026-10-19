// A method other than `wipe()` cannot wipe the field: the holder's other methods would read zeros.
import { Secret, expose, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  constructor() {
    this.k = secret(bytes());
  }
  burn(): void {
    wipe(this.k);
  }
  size(): i32 {
    return expose(this.k, sum);
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => {
  const h = new Holder();
  h.burn();
  const n = h.size();
  h.wipe();
  return n;
};
