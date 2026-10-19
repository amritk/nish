// A function that returns the `Secret` it borrows would hand back a second owner of a holder's key.
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
function id(s: Secret<u8[]>): Secret<u8[]> {
  return s;
}
export const main = (): i32 => {
  const h = new Holder();
  const a = id(h.k);
  wipe(a);
  h.wipe();
  return 0;
};
