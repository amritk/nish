// A ternary over two borrowed `Secret`s copies the one it picks, and the copy rule refuses it before the return could.
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
const pick = (c: boolean, s: Secret<u8[]>, t: Secret<u8[]>): Secret<u8[]> => {
  return c ? s : t;
};
export const main = (): i32 => {
  const h = new Holder();
  const g = new Holder();
  const a = pick(true, h.k, g.k);
  wipe(a);
  h.wipe();
  g.wipe();
  return 0;
};
