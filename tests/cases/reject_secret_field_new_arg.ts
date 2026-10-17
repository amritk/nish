// A `Secret` made as a `new` argument: the constructor only borrows it, so nobody owns it (NL2439).
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
class Box {
  readonly n: i32;
  constructor(k: Secret<u8[]>) {
    this.n = expose(k, sum);
  }
}
export const main = (): i32 => {
  const b = new Box(secret(bytes()));
  return b.n;
};
