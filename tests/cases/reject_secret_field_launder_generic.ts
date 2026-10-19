// A generic identity, instantiated at `Secret`, is checked as that instantiation: it returns what it borrows.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  constructor() {
    this.k = secret(bytes());
  }
  wipe(): void {
    wipe(this.k);
  }
}
function id<T>(x: T): T {
  return x;
}
export const main = (): i32 => {
  const h = new Holder();
  const a = id(h.k);
  wipe(a);
  h.wipe();
  return 0;
};
